-- ============================================================
--  PocketLedger SA — Patch V1
--  Run this AFTER Brooklyn's Pocket_Ledger_Script_V1.sql
--  Adds missing columns and the notifications table
-- ============================================================

USE Pocket_Ledger_SA;
GO

-- ============================================================
-- PATCH 1: users — add full_name and phone_number
--   The app needs to display the user's name and the Python
--   parser uses phone_number for SMS alert delivery via SNS.
-- ============================================================
ALTER TABLE users
    ADD full_name    NVARCHAR(255) NULL,
        phone_number NVARCHAR(20)  NULL,
        is_provisional BIT NOT NULL DEFAULT 0,
        deleted_at   DATETIME2     NULL;
GO

-- ============================================================
-- PATCH 2: transactions — add import_batch_id
--   The Python parser groups all transactions from a single
--   bank statement upload under one batch ID (a GUID).
--   This lets you query "show me everything from this import"
--   and makes duplicate detection across batches reliable.
-- ============================================================
ALTER TABLE transactions
    ADD import_batch_id NVARCHAR(36) NULL,
        merchant        NVARCHAR(255) NULL;
GO

CREATE NONCLUSTERED INDEX idx_txn_batch
    ON transactions (import_batch_id);
GO

-- ============================================================
-- PATCH 3: receipts — add OCR output columns
--   The Python Intelligence Service writes these after running
--   OCR on the uploaded receipt image via Amazon Textract.
-- ============================================================
ALTER TABLE receipts
    ADD ocr_confidence   DECIMAL(5,4)  NULL,   -- 0.0 to 1.0
        amount_detected  DECIMAL(12,2) NULL,   -- Amount parsed from receipt
        date_detected    DATE          NULL,   -- Date parsed from receipt
        s3_bucket        NVARCHAR(255) NULL,   -- AWS S3 bucket name
        s3_key           NVARCHAR(500) NULL,   -- Full S3 object key
        file_name        NVARCHAR(255) NULL,
        mime_type        NVARCHAR(100) NULL,
        user_id          INT           NULL;
GO

ALTER TABLE receipts
    ADD CONSTRAINT fk_receipt_user FOREIGN KEY (user_id)
        REFERENCES users(user_id);
GO

-- Also make transaction_id nullable so receipts can be uploaded
-- before being matched to a transaction
ALTER TABLE receipts
    DROP CONSTRAINT fk_receipt_txn;
GO

ALTER TABLE receipts
    ALTER COLUMN transaction_id BIGINT NULL;
GO

ALTER TABLE receipts
    ADD CONSTRAINT fk_receipt_txn FOREIGN KEY (transaction_id)
        REFERENCES transactions(transaction_id);
GO

-- ============================================================
-- PATCH 4: audit_flags — add description and resolved_at
--   The Python service writes a human-readable description
--   when it raises a flag. resolved_at tracks when it was cleared.
-- ============================================================
ALTER TABLE audit_flags
    ADD [description] NVARCHAR(500) NULL,
        resolved_at   DATETIME2     NULL;
GO

-- ============================================================
-- PATCH 5: notifications table (missing from Brooklyn's script)
--   AWS SNS sends the actual push/SMS. This table is the log —
--   it tracks what was sent, when, and whether it was read.
-- ============================================================
CREATE TABLE notifications (
    notification_id  BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id          INT           NOT NULL,
    [type]           NVARCHAR(50)  NOT NULL,
    title            NVARCHAR(255) NOT NULL,
    body             NVARCHAR(1000) NOT NULL,
    is_read          BIT           NOT NULL DEFAULT 0,
    sent_at          DATETIME2     NOT NULL DEFAULT GETDATE(),
    read_at          DATETIME2     NULL,
    related_id       NVARCHAR(36)  NULL,   -- ID of related flag/payment/calc
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_notif_type CHECK ([type] IN (
        'provisional_tax_reminder',
        'missing_receipt',
        'audit_flag',
        'calculation_complete',
        'general'
    ))
);
GO

CREATE NONCLUSTERED INDEX idx_notif_user_read
    ON notifications (user_id, is_read);
GO

-- ============================================================
-- PATCH 6: Fix the broken category seed
--   Brooklyn's file had an encoding issue on "Travel – business"
--   (the dash came through as a garbage character).
--   This corrects it and adds missing categories.
-- ============================================================
UPDATE categories
SET [name] = 'Travel - business'
WHERE [name] LIKE 'Travel%business';

MERGE categories AS target
USING (VALUES
    ('Rental income',              NULL,  0, 'Income from property rentals'),
    ('Investment income',          NULL,  0, 'Dividends, interest, capital gains'),
    ('Software & subscriptions',   NULL,  1, 'Work-related software and SaaS tools'),
    ('Professional development',   NULL,  1, 'Courses, books, and training'),
    ('Groceries',                  NULL,  0, 'Personal grocery shopping'),
    ('Entertainment',              NULL,  0, 'Personal entertainment'),
    ('Utilities',                  NULL,  0, 'Electricity, water, internet'),
    ('Transport',                  NULL,  0, 'Uber, fuel, public transport'),
    ('Business meals',             NULL,  1, 'Client entertainment and business meals')
) AS source ([name], sars_deduction_code, is_deductible, [description])
ON (target.[name] = source.[name])
WHEN NOT MATCHED THEN
    INSERT ([name], sars_deduction_code, is_deductible, [description])
    VALUES (source.[name], source.sars_deduction_code, source.is_deductible, source.[description]);
GO

PRINT 'Patch V1 applied successfully.';
GO
