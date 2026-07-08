USE master;
GO

IF EXISTS (SELECT name FROM sys.databases WHERE name = N'Pocket_Ledger_SA')
BEGIN
    ALTER DATABASE Pocket_Ledger_SA SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE Pocket_Ledger_SA;
END
GO


CREATE DATABASE Pocket_Ledger_SA
COLLATE Latin1_General_100_CI_AS_SC_UTF8;
GO

USE Pocket_Ledger_SA;
GO

-- ==========================================
-- 1. Create Tables
-- ==========================================

CREATE TABLE users (
    user_id         INT IDENTITY(1,1) PRIMARY KEY,
    email           NVARCHAR(255) NOT NULL UNIQUE,
    password_hash   NVARCHAR(255) NOT NULL,
    tax_number      NVARCHAR(20)  NULL,           
    date_of_birth   DATE          NULL,
    created_at      DATETIME2     NOT NULL DEFAULT GETDATE(),
    updated_at      DATETIME2     NOT NULL DEFAULT GETDATE()
);

CREATE TABLE tax_year_config (
    tax_year_id              INT IDENTITY(1,1) PRIMARY KEY,
    tax_year                 NVARCHAR(9)  NOT NULL UNIQUE,   
    primary_rebate           DECIMAL(10,2) NOT NULL,
    secondary_rebate         DECIMAL(10,2) NOT NULL,        
    tertiary_rebate          DECIMAL(10,2) NOT NULL,        
    tax_threshold_under65   DECIMAL(12,2) NOT NULL,
    tax_threshold_65to74     DECIMAL(12,2) NOT NULL,
    tax_threshold_75plus     DECIMAL(12,2) NOT NULL,
    uif_monthly_cap          DECIMAL(10,2) NOT NULL,        
    uif_rate                 DECIMAL(5,4)  NOT NULL DEFAULT 0.0100,
    medical_credit_main      DECIMAL(10,2) NOT NULL,        
    medical_credit_dependant DECIMAL(10,2) NOT NULL,       
    retirement_deduction_pct DECIMAL(5,4)  NOT NULL DEFAULT 0.2750,
    retirement_annual_cap    DECIMAL(12,2) NOT NULL,
    cgt_inclusion_rate       DECIMAL(5,4)  NOT NULL DEFAULT 0.4000,
    cgt_annual_exclusion     DECIMAL(12,2) NOT NULL,
    is_active                BIT NOT NULL DEFAULT 1,
    created_at               DATETIME2 NOT NULL DEFAULT GETDATE()
);

CREATE TABLE tax_brackets (
    bracket_id      INT IDENTITY(1,1) PRIMARY KEY,
    tax_year_id     INT NOT NULL,
    bracket_order   TINYINT NOT NULL,          
    lower_bound     DECIMAL(12,2) NOT NULL,
    upper_bound     DECIMAL(12,2) NULL,        
    base_amount     DECIMAL(12,2) NOT NULL,
    rate            DECIMAL(5,4)  NOT NULL,    
    CONSTRAINT fk_bracket_tax_year FOREIGN KEY (tax_year_id)
        REFERENCES tax_year_config(tax_year_id) ON DELETE CASCADE,
    CONSTRAINT uq_bracket_order UNIQUE (tax_year_id, bracket_order)
);

CREATE TABLE income_sources (
    income_source_id INT IDENTITY(1,1) PRIMARY KEY,
    user_id          INT NOT NULL,
    [type]           NVARCHAR(20) NOT NULL,
    employer_name    NVARCHAR(255) NULL,
    is_provisional   BIT NOT NULL DEFAULT 0,
    start_date       DATE NULL,
    end_date         DATE NULL,
    created_at       DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_income_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT chk_income_type CHECK ([type] IN ('salary','freelance','rental','investment','other'))
);

CREATE TABLE categories (
    category_id          INT IDENTITY(1,1) PRIMARY KEY,
    [name]               NVARCHAR(100) NOT NULL UNIQUE, 
    sars_deduction_code  NVARCHAR(20)  NULL,
    is_deductible        BIT NOT NULL DEFAULT 0,
    [description]        NVARCHAR(255) NULL
);

CREATE TABLE transactions (
    transaction_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id          INT NOT NULL,
    income_source_id INT NULL,
    category_id      INT NULL,
    [date]           DATE NOT NULL,
    amount           DECIMAL(12,2) NOT NULL,
    [description]    NVARCHAR(500) NULL,
    source_bank      NVARCHAR(100) NULL,       
    is_duplicate     BIT NOT NULL DEFAULT 0,
    imported_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_txn_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_txn_income_source FOREIGN KEY (income_source_id)
        REFERENCES income_sources(income_source_id), 
    CONSTRAINT fk_txn_category FOREIGN KEY (category_id)
        REFERENCES categories(category_id) ON DELETE SET NULL
);
GO
CREATE NONCLUSTERED INDEX idx_txn_user_date ON transactions (user_id, [date]);
GO

CREATE TABLE receipts (
    receipt_id      INT IDENTITY(1,1) PRIMARY KEY,
    transaction_id  BIGINT NOT NULL,
    file_url        NVARCHAR(500) NOT NULL,   
    ocr_text        NVARCHAR(MAX) NULL,
    uploaded_at     DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_receipt_txn FOREIGN KEY (transaction_id)
        REFERENCES transactions(transaction_id) ON DELETE CASCADE
);

CREATE TABLE tax_calculations (
    calculation_id   BIGINT IDENTITY(1,1) PRIMARY KEY,
    user_id          INT NOT NULL,
    tax_year_id      INT NOT NULL,
    taxable_income   DECIMAL(12,2) NOT NULL,
    final_tax_owed   DECIMAL(12,2) NOT NULL,
    calculated_at    DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_calc_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_calc_tax_year FOREIGN KEY (tax_year_id)
        REFERENCES tax_year_config(tax_year_id)
);
GO
CREATE NONCLUSTERED INDEX idx_calc_user_year ON tax_calculations (user_id, tax_year_id);
GO

CREATE TABLE provisional_tax_payments (
    payment_id    INT IDENTITY(1,1) PRIMARY KEY,
    user_id       INT NOT NULL,
    tax_year_id   INT NOT NULL,
    [period]      NVARCHAR(10) NOT NULL,
    due_date      DATE NOT NULL,
    paid_amount   DECIMAL(12,2) NULL,
    paid_at       DATETIME2 NULL,
    CONSTRAINT fk_prov_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_prov_tax_year FOREIGN KEY (tax_year_id)
        REFERENCES tax_year_config(tax_year_id),
    CONSTRAINT uq_user_year_period UNIQUE (user_id, tax_year_id, [period]),
    CONSTRAINT chk_prov_period CHECK ([period] IN ('first','second','topup'))
);

CREATE TABLE audit_flags (
    flag_id         INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NOT NULL,
    transaction_id  BIGINT NULL,
    flag_type       NVARCHAR(20) NOT NULL,
    severity        NVARCHAR(10) NOT NULL DEFAULT 'medium',
    resolved        BIT NOT NULL DEFAULT 0,
    created_at      DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT fk_flag_user FOREIGN KEY (user_id)
        REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_flag_txn FOREIGN KEY (transaction_id)
        REFERENCES transactions(transaction_id), -- Fixed: Removed ON DELETE SET NULL to break the cycle
    CONSTRAINT chk_flag_type CHECK (flag_type IN ('duplicate','missing_receipt','outlier','other')),
    CONSTRAINT chk_severity CHECK (severity IN ('low','medium','high'))
);
GO

-- ==========================================
-- 2. Data Seeding Pipelines
-- ==========================================

MERGE categories AS target
USING (VALUES 
    ('Salary income',        NULL,   0, 'PAYE income from employment'),
    ('Freelance income',     NULL,   0, 'Income from freelance/sole-proprietor work'),
    ('Home office',          NULL,   1, 'Home office running costs, if conditions are met'),
    ('Medical expenses',     NULL,   1, 'Out-of-pocket medical costs beyond scheme cover'),
    ('Retirement contribution', NULL, 1, 'Retirement annuity / pension / provident contributions'),
    ('Travel — business',    NULL,   1, 'Business-related travel costs'),
    ('Bank charges',         NULL,   0, 'General bank fees'),
    ('Uncategorised',        NULL,   0, 'Default bucket before categorisation runs')
) AS source ([name], sars_deduction_code, is_deductible, [description])
ON (target.[name] = source.[name])
WHEN MATCHED THEN
    UPDATE SET sars_deduction_code = source.sars_deduction_code, is_deductible = source.is_deductible, [description] = source.[description]
WHEN NOT MATCHED THEN
    INSERT ([name], sars_deduction_code, is_deductible, [description])
    VALUES (source.[name], source.sars_deduction_code, source.is_deductible, source.[description]);

DECLARE @CurrentTaxYearID INT;

INSERT INTO tax_year_config (
    tax_year, 
    primary_rebate, secondary_rebate, tertiary_rebate,
    tax_threshold_under65, tax_threshold_65to74, tax_threshold_75plus,
    uif_monthly_cap, uif_rate,
    medical_credit_main, medical_credit_dependant,
    retirement_deduction_pct, retirement_annual_cap,
    cgt_inclusion_rate, cgt_annual_exclusion,
    is_active
) VALUES (
    '2026/2027',    
    17820.00,      
    9765.00,       
    3249.00,       
    99000.00,      
    153250.00,     
    171300.00,     
    17712.00,      
    0.0100,        
    464.00,        
    464.00,        
    0.2750,        
    350000.00,     
    0.4000,        
    40000.00,      
    1
);

SET @CurrentTaxYearID = SCOPE_IDENTITY();

INSERT INTO tax_brackets (tax_year_id, bracket_order, lower_bound, upper_bound, base_amount, rate) VALUES 
(@CurrentTaxYearID, 1, 1.00, 245100.00, 0.00, 0.1800),
(@CurrentTaxYearID, 2, 245101.00, 383100.00, 44118.00, 0.2600),
(@CurrentTaxYearID, 3, 383101.00, 530200.00, 79998.00, 0.3100),
(@CurrentTaxYearID, 4, 530201.00, 695800.00, 125599.00, 0.3600),
(@CurrentTaxYearID, 5, 695801.00, 887000.00, 185215.00, 0.3900),
(@CurrentTaxYearID, 6, 887001.00, 1878600.00, 259783.00, 0.4100),
(@CurrentTaxYearID, 7, 1878601.00, NULL, 666339.00, 0.4500);
GO