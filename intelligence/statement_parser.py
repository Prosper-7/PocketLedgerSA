# ============================================================
#  statement_parser.py
#  Reads bank statement PDFs or Excel exports and returns a
#  list of raw transaction dicts ready for the categoriser.
#
#  Supported SA banks: FNB, ABSA, Nedbank, Standard Bank, Capitec
# ============================================================

import re
import uuid
import pdfplumber
import pandas as pd
from datetime import date, datetime
from typing import Optional
from io import BytesIO


# ── Helpers ──────────────────────────────────────────────────

def _parse_date(raw: str) -> Optional[date]:
    """Try common SA bank date formats."""
    formats = ["%d %b %Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %B %Y"]
    for fmt in formats:
        try:
            return datetime.strptime(raw.strip(), fmt).date()
        except ValueError:
            continue
    return None

def _parse_amount(raw: str) -> Optional[float]:
    """Clean rand amount strings like 'R 1,234.56' or '-1234.56 Cr'."""
    if not raw:
        return None
    cleaned = re.sub(r"[R,\s]", "", str(raw))
    is_credit = "Cr" in cleaned or "CR" in cleaned
    cleaned = re.sub(r"[CrDd]", "", cleaned)
    try:
        amount = float(cleaned)
        return amount if is_credit else -abs(amount)
    except ValueError:
        return None

def _detect_bank(text: str) -> str:
    """Identify which bank the statement belongs to."""
    text_lower = text.lower()
    if "fnb" in text_lower or "first national" in text_lower:
        return "FNB"
    if "absa" in text_lower:
        return "ABSA"
    if "nedbank" in text_lower:
        return "Nedbank"
    if "standard bank" in text_lower:
        return "Standard Bank"
    if "capitec" in text_lower:
        return "Capitec"
    return "Unknown"


# ── PDF Parser ────────────────────────────────────────────────

def _parse_pdf(file_bytes: bytes) -> list[dict]:
    """
    Extract transactions from a PDF bank statement.
    Uses pdfplumber to extract text, then regex to find transaction rows.
    """
    transactions = []
    batch_id = str(uuid.uuid4())

    with pdfplumber.open(BytesIO(file_bytes)) as pdf:
        full_text = ""
        for page in pdf.pages:
            full_text += page.extract_text() or ""

        bank = _detect_bank(full_text)

        # Generic pattern: date, description, optional debit, optional credit
        # This covers most SA bank statement formats
        pattern = re.compile(
            r"(\d{1,2}\s+\w{3}\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})"  # date
            r"\s+"
            r"(.+?)"            # description (non-greedy)
            r"\s+"
            r"([\d,]+\.\d{2})"  # amount
            r"(?:\s+(Cr|Dr))?", # optional Cr/Dr suffix
            re.MULTILINE
        )

        for match in pattern.finditer(full_text):
            raw_date, description, raw_amount, dr_cr = match.groups()
            parsed_date = _parse_date(raw_date)
            if not parsed_date:
                continue

            amount_str = raw_amount + (" Cr" if dr_cr == "Cr" else "")
            amount = _parse_amount(amount_str)
            if amount is None:
                continue

            transactions.append({
                "import_batch_id": batch_id,
                "date": parsed_date,
                "description": description.strip(),
                "amount": amount,
                "source_bank": bank,
                "merchant": _extract_merchant(description),
            })

    return transactions


# ── Excel Parser ──────────────────────────────────────────────

def _parse_excel(file_bytes: bytes) -> list[dict]:
    """
    Extract transactions from an Excel bank export.
    Looks for columns named Date, Description, Amount (case-insensitive).
    """
    batch_id = str(uuid.uuid4())
    transactions = []

    df = pd.read_excel(BytesIO(file_bytes), engine="openpyxl")

    # Normalise column names
    df.columns = [str(c).strip().lower() for c in df.columns]

    # Find the right columns flexibly
    date_col = next((c for c in df.columns if "date" in c), None)
    desc_col = next((c for c in df.columns if "desc" in c or "narr" in c or "detail" in c), None)
    amt_col  = next((c for c in df.columns if "amount" in c or "amt" in c), None)
    bank_col = next((c for c in df.columns if "bank" in c), None)

    if not all([date_col, desc_col, amt_col]):
        raise ValueError(
            f"Could not find required columns in Excel file. "
            f"Found: {list(df.columns)}. "
            f"Need columns for: date, description, amount."
        )

    for _, row in df.iterrows():
        raw_date = row[date_col]
        description = str(row[desc_col]).strip()
        raw_amount = row[amt_col]
        bank = str(row[bank_col]).strip() if bank_col else "Unknown"

        if pd.isna(raw_date) or pd.isna(raw_amount):
            continue

        if isinstance(raw_date, str):
            parsed_date = _parse_date(raw_date)
        else:
            parsed_date = pd.Timestamp(raw_date).date()

        try:
            amount = float(raw_amount)
        except (ValueError, TypeError):
            amount = _parse_amount(str(raw_amount))

        if parsed_date and amount is not None:
            transactions.append({
                "import_batch_id": batch_id,
                "date": parsed_date,
                "description": description,
                "amount": amount,
                "source_bank": bank,
                "merchant": _extract_merchant(description),
            })

    return transactions


# ── Merchant Extractor ────────────────────────────────────────

def _extract_merchant(description: str) -> Optional[str]:
    """
    Pull a clean merchant name from a messy bank description.
    Bank descriptions often look like:
    'POS PURCHASE WOOLWORTHS FOOD SANDTON #1234 09JUL'
    This tries to extract just 'Woolworths Food'.
    """
    # Strip common prefixes
    noise = r"^(POS\s+PURCHASE\s+|CARD\s+PURCHASE\s+|DEBIT\s+ORDER\s+|PAYMENT\s+TO\s+|EFT\s+TO\s+)"
    cleaned = re.sub(noise, "", description, flags=re.IGNORECASE).strip()

    # Remove trailing reference numbers and dates
    cleaned = re.sub(r"\s+#\d+.*$", "", cleaned)
    cleaned = re.sub(r"\s+\d{2}[A-Z]{3}.*$", "", cleaned)
    cleaned = re.sub(r"\s{2,}", " ", cleaned)

    return cleaned.strip()[:255] if cleaned else None


# ── Public Interface ──────────────────────────────────────────

def parse_statement(file_bytes: bytes, filename: str) -> list[dict]:
    """
    Main entry point called by the API endpoint.
    Detects file type and returns a list of transaction dicts.

    Each dict contains:
        import_batch_id, date, description, amount,
        source_bank, merchant
    """
    filename_lower = filename.lower()

    if filename_lower.endswith(".pdf"):
        return _parse_pdf(file_bytes)
    elif filename_lower.endswith((".xlsx", ".xls")):
        return _parse_excel(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {filename}. Upload a PDF or Excel file.")
