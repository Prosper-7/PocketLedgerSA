# ============================================================
#  s3_service.py
#  Handles uploading receipt images to AWS S3 and triggering
#  Amazon Textract for OCR text extraction.
# ============================================================

import boto3
import uuid
from botocore.exceptions import ClientError
from app.config import settings


# ── S3 Client ─────────────────────────────────────────────────

def _get_s3():
    return boto3.client(
        "s3",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )

def _get_textract():
    return boto3.client(
        "textract",
        region_name=settings.AWS_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


# ── Upload Receipt ────────────────────────────────────────────

def upload_receipt(
    user_id: int,
    file_bytes: bytes,
    filename: str,
    mime_type: str,
) -> dict:
    """
    Upload a receipt image to S3.
    Returns dict with s3_bucket, s3_key, and file_url.

    S3 key format: receipts/{user_id}/{uuid}_{filename}
    This keeps each user's receipts in their own folder.
    """
    s3 = _get_s3()
    unique_name = f"{uuid.uuid4()}_{filename}"
    s3_key = f"receipts/{user_id}/{unique_name}"

    try:
        s3.put_object(
            Bucket=settings.S3_BUCKET_NAME,
            Key=s3_key,
            Body=file_bytes,
            ContentType=mime_type,
            # Receipts are private — never public
            ACL="private",
            Metadata={"user_id": str(user_id)},
        )
    except ClientError as e:
        raise RuntimeError(f"Failed to upload receipt to S3: {e}")

    return {
        "s3_bucket": settings.S3_BUCKET_NAME,
        "s3_key":    s3_key,
        "file_name": filename,
        "mime_type": mime_type,
    }


# ── Generate Presigned URL ────────────────────────────────────

def get_presigned_url(s3_key: str, expires_in: int = 3600) -> str:
    """
    Generate a temporary URL so the mobile app can display
    a receipt image. Default expiry: 1 hour.
    """
    s3 = _get_s3()
    try:
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
            ExpiresIn=expires_in,
        )
        return url
    except ClientError as e:
        raise RuntimeError(f"Failed to generate presigned URL: {e}")


# ── OCR via Amazon Textract ───────────────────────────────────

def extract_text_from_receipt(s3_key: str) -> dict:
    """
    Run Amazon Textract on a receipt already in S3.
    Returns dict with:
        ocr_text:        Full extracted text (joined lines)
        ocr_confidence:  Average confidence score (0.0 - 1.0)
        amount_detected: Largest rand amount found in the text
        date_detected:   First date found in the text (or None)
    """
    textract = _get_textract()

    try:
        response = textract.detect_document_text(
            Document={
                "S3Object": {
                    "Bucket": settings.S3_BUCKET_NAME,
                    "Name":   s3_key,
                }
            }
        )
    except ClientError as e:
        raise RuntimeError(f"Textract failed: {e}")

    blocks     = response.get("Blocks", [])
    lines      = []
    confidences = []

    for block in blocks:
        if block["BlockType"] == "LINE":
            lines.append(block.get("Text", ""))
            confidences.append(block.get("Confidence", 0) / 100)

    full_text        = "\n".join(lines)
    avg_confidence   = sum(confidences) / len(confidences) if confidences else 0.0
    amount_detected  = _extract_amount(full_text)
    date_detected    = _extract_date(full_text)

    return {
        "ocr_text":       full_text,
        "ocr_confidence": round(avg_confidence, 4),
        "amount_detected": amount_detected,
        "date_detected":   date_detected,
    }


# ── Text Parsers ──────────────────────────────────────────────

import re
from datetime import date
from dateutil import parser as dateutil_parser

def _extract_amount(text: str) -> float | None:
    """Find all rand amounts in OCR text, return the largest."""
    amounts = re.findall(r"R\s?[\d,]+\.?\d{0,2}", text, re.IGNORECASE)
    if not amounts:
        amounts = re.findall(r"\b\d{1,6}[.,]\d{2}\b", text)

    parsed = []
    for a in amounts:
        cleaned = re.sub(r"[R\s,]", "", a)
        try:
            parsed.append(float(cleaned))
        except ValueError:
            continue

    return max(parsed) if parsed else None

def _extract_date(text: str) -> date | None:
    """Find the first recognisable date in OCR text."""
    date_patterns = [
        r"\b\d{1,2}\s+\w{3,9}\s+\d{4}\b",
        r"\b\d{4}-\d{2}-\d{2}\b",
        r"\b\d{1,2}/\d{1,2}/\d{4}\b",
        r"\b\d{1,2}-\d{1,2}-\d{4}\b",
    ]
    for pattern in date_patterns:
        match = re.search(pattern, text)
        if match:
            try:
                return dateutil_parser.parse(match.group(), dayfirst=True).date()
            except Exception:
                continue
    return None
