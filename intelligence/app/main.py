# ============================================================
#  main.py — FastAPI application entry point
#  Run with: uvicorn app.main:app --reload --port 8000
#
#  All routes the React Native app and C# Tax Engine will call:
#    POST /statements/upload    — parse + save a bank statement
#    POST /receipts/upload      — upload a receipt image + OCR
#    GET  /transactions/{uid}   — list transactions for a user
#    GET  /audit-flags/{uid}    — list open flags for a user
#    PUT  /audit-flags/{id}/resolve — mark a flag as resolved
#    GET  /health               — database + S3 health check
# ============================================================

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Path, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from app.database import get_db, health_check
from app.config import settings
from app.services.statement_parser import parse_statement
from app.services.categoriser import categorise_batch
from app.services.duplicate_detector import detect_duplicates
from app.services.audit_service import run_audit_checks
from app.services.s3_service import upload_receipt, extract_text_from_receipt, get_presigned_url

app = FastAPI(
    title="PocketLedger SA — Intelligence Service",
    description="Python backend for statement parsing, OCR, categorisation, and audit flagging.",
    version="1.0.0",
)

# Allow the React Native app (running on Expo) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # Tighten this to your domain in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health", tags=["System"])
def health():
    """Quick check that the API, database, and AWS are reachable."""
    db_ok = health_check()
    return {
        "api":      "ok",
        "database": "ok" if db_ok else "unreachable",
        "version":  "1.0.0",
    }


# ============================================================
# STATEMENT UPLOAD
# Upload a PDF or Excel bank statement.
# Pipeline: parse → categorise → deduplicate → save → audit
# ============================================================

@app.post("/statements/upload", tags=["Statements"])
async def upload_statement(
    user_id: int = Query(..., description="The logged-in user's ID"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Full statement import pipeline.
    Returns a summary of what was imported and any flags raised.
    """
    file_bytes = await file.read()
    filename   = file.filename or "statement"

    # ── Step 1: Parse ─────────────────────────────────────────
    try:
        transactions = parse_statement(file_bytes, filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not transactions:
        return {"message": "No transactions found in file.", "imported": 0}

    # ── Step 2: Categorise ────────────────────────────────────
    transactions = categorise_batch(db, transactions, use_ai_fallback=True)

    # ── Step 3: Detect duplicates ─────────────────────────────
    transactions = detect_duplicates(db, user_id, transactions)

    # ── Step 4: Save to database ──────────────────────────────
    saved = []
    for txn in transactions:
        # Look up is_deductible from category
        is_deductible = False
        if txn.get("category_id"):
            row = db.execute(
                text("SELECT is_deductible FROM categories WHERE category_id = :cid"),
                {"cid": txn["category_id"]}
            ).fetchone()
            is_deductible = bool(row[0]) if row else False

        result = db.execute(
            text("""
                INSERT INTO transactions
                    (user_id, category_id, [date], amount, [description],
                     merchant, source_bank, is_duplicate, import_batch_id, imported_at)
                OUTPUT INSERTED.transaction_id
                VALUES
                    (:user_id, :category_id, :date, :amount, :description,
                     :merchant, :source_bank, :is_duplicate, :batch_id, GETDATE())
            """),
            {
                "user_id":      user_id,
                "category_id":  txn.get("category_id"),
                "date":         txn["date"],
                "amount":       txn["amount"],
                "description":  txn.get("description", "")[:500],
                "merchant":     txn.get("merchant"),
                "source_bank":  txn.get("source_bank"),
                "is_duplicate": 1 if txn.get("is_duplicate") else 0,
                "batch_id":     txn.get("import_batch_id"),
            }
        )
        txn_id = result.fetchone()[0]
        saved.append({**txn, "transaction_id": txn_id, "is_deductible": is_deductible})

    db.commit()

    # ── Step 5: Audit checks ──────────────────────────────────
    flags_raised = run_audit_checks(db, user_id, saved)

    duplicates   = sum(1 for t in saved if t.get("is_duplicate"))
    imported     = len(saved) - duplicates

    return {
        "message":      f"Statement imported successfully.",
        "total_parsed": len(saved),
        "imported":     imported,
        "duplicates":   duplicates,
        "flags_raised": flags_raised,
        "batch_id":     saved[0]["import_batch_id"] if saved else None,
    }


# ============================================================
# RECEIPT UPLOAD
# Upload a receipt image — saves to S3 and runs OCR.
# ============================================================

@app.post("/receipts/upload", tags=["Receipts"])
async def upload_receipt_image(
    user_id: int = Query(...),
    transaction_id: int | None = Query(None, description="Link to an existing transaction"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload a receipt image to S3 and run Amazon Textract OCR.
    If transaction_id is provided, links the receipt to that transaction.
    """
    file_bytes = await file.read()
    filename   = file.filename or "receipt.jpg"
    mime_type  = file.content_type or "image/jpeg"

    # Upload to S3
    s3_result = upload_receipt(user_id, file_bytes, filename, mime_type)

    # Run OCR
    ocr_result = extract_text_from_receipt(s3_result["s3_key"])

    # Save receipt record
    result = db.execute(
        text("""
            INSERT INTO receipts
                (transaction_id, user_id, file_url, s3_bucket, s3_key,
                 file_name, mime_type, ocr_text, ocr_confidence,
                 amount_detected, date_detected, uploaded_at)
            OUTPUT INSERTED.receipt_id
            VALUES
                (:txn_id, :user_id, :file_url, :bucket, :key,
                 :file_name, :mime_type, :ocr_text, :ocr_confidence,
                 :amount_detected, :date_detected, GETDATE())
        """),
        {
            "txn_id":          transaction_id,
            "user_id":         user_id,
            "file_url":        f"s3://{s3_result['s3_bucket']}/{s3_result['s3_key']}",
            "bucket":          s3_result["s3_bucket"],
            "key":             s3_result["s3_key"],
            "file_name":       filename,
            "mime_type":       mime_type,
            "ocr_text":        ocr_result["ocr_text"],
            "ocr_confidence":  ocr_result["ocr_confidence"],
            "amount_detected": ocr_result["amount_detected"],
            "date_detected":   ocr_result["date_detected"],
        }
    )
    receipt_id = result.fetchone()[0]
    db.commit()

    return {
        "receipt_id":      receipt_id,
        "ocr_confidence":  ocr_result["ocr_confidence"],
        "amount_detected": ocr_result["amount_detected"],
        "date_detected":   str(ocr_result["date_detected"]) if ocr_result["date_detected"] else None,
        "preview_url":     get_presigned_url(s3_result["s3_key"], expires_in=3600),
    }


# ============================================================
# TRANSACTIONS
# ============================================================

@app.get("/transactions/{user_id}", tags=["Transactions"])
def get_transactions(
    user_id: int = Path(...),
    limit: int = Query(50),
    offset: int = Query(0),
    category_id: int | None = Query(None),
    db: Session = Depends(get_db),
):
    """Return paginated transactions for a user, newest first."""
    filters = "WHERE t.user_id = :user_id"
    params  = {"user_id": user_id, "limit": limit, "offset": offset}

    if category_id:
        filters += " AND t.category_id = :category_id"
        params["category_id"] = category_id

    rows = db.execute(
        text(f"""
            SELECT t.transaction_id, t.[date], t.amount, t.[description],
                   t.merchant, t.source_bank, t.is_duplicate,
                   c.[name] AS category_name, c.is_deductible
            FROM   transactions t
            LEFT   JOIN categories c ON c.category_id = t.category_id
            {filters}
            ORDER  BY t.[date] DESC
            OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY
        """),
        params
    ).fetchall()

    return {
        "transactions": [dict(r._mapping) for r in rows],
        "limit":  limit,
        "offset": offset,
    }


# ============================================================
# AUDIT FLAGS
# ============================================================

@app.get("/audit-flags/{user_id}", tags=["Audit"])
def get_audit_flags(
    user_id: int = Path(...),
    resolved: bool = Query(False),
    db: Session = Depends(get_db),
):
    """Return open (or resolved) audit flags for a user."""
    rows = db.execute(
        text("""
            SELECT flag_id, transaction_id, flag_type, severity,
                   [description], resolved, created_at
            FROM   audit_flags
            WHERE  user_id = :user_id AND resolved = :resolved
            ORDER  BY created_at DESC
        """),
        {"user_id": user_id, "resolved": 1 if resolved else 0}
    ).fetchall()

    return {"flags": [dict(r._mapping) for r in rows]}


@app.put("/audit-flags/{flag_id}/resolve", tags=["Audit"])
def resolve_flag(
    flag_id: int = Path(...),
    db: Session = Depends(get_db),
):
    """Mark an audit flag as resolved (user confirmed or dismissed it)."""
    db.execute(
        text("""
            UPDATE audit_flags
            SET    resolved = 1, resolved_at = GETDATE()
            WHERE  flag_id = :flag_id
        """),
        {"flag_id": flag_id}
    )
    db.commit()
    return {"message": f"Flag {flag_id} resolved."}
