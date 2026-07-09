# ============================================================
#  duplicate_detector.py
#  Detects duplicate transactions within a batch and against
#  transactions already stored in the database.
#
#  A duplicate is flagged when two transactions share:
#    - Same user_id
#    - Same amount (exact)
#    - Same date (or within 3 days)
#    - Same or very similar description
# ============================================================

from datetime import timedelta
from sqlalchemy.orm import Session
from sqlalchemy import text


# ── Similarity Helper ─────────────────────────────────────────

def _similar(desc_a: str, desc_b: str, threshold: float = 0.7) -> bool:
    """
    Simple word-overlap similarity between two descriptions.
    Returns True if overlap ratio exceeds threshold.
    No external libraries needed.
    """
    words_a = set(desc_a.lower().split())
    words_b = set(desc_b.lower().split())
    if not words_a or not words_b:
        return False
    overlap = len(words_a & words_b)
    shorter = min(len(words_a), len(words_b))
    return (overlap / shorter) >= threshold


# ── Within-Batch Duplicates ───────────────────────────────────

def flag_batch_duplicates(transactions: list[dict]) -> list[dict]:
    """
    Mark duplicates within the same import batch before
    anything is written to the database.
    The first occurrence is kept; subsequent ones are flagged.
    """
    seen: list[dict] = []

    for txn in transactions:
        is_dup = False
        for prior in seen:
            date_diff = abs((txn["date"] - prior["date"]).days)
            if (
                txn["amount"] == prior["amount"]
                and date_diff <= 3
                and _similar(txn["description"], prior["description"])
            ):
                is_dup = True
                break

        txn["is_duplicate"] = is_dup
        if not is_dup:
            seen.append(txn)

    return transactions


# ── Against-Database Duplicates ───────────────────────────────

def check_against_db(
    db: Session,
    user_id: int,
    transactions: list[dict],
) -> list[dict]:
    """
    For each non-duplicate transaction in the batch, check
    whether a very similar transaction already exists in the DB
    within a 3-day window for the same user.
    """
    for txn in transactions:
        if txn.get("is_duplicate"):
            continue

        date_from = txn["date"] - timedelta(days=3)
        date_to   = txn["date"] + timedelta(days=3)

        rows = db.execute(
            text("""
                SELECT [description], amount
                FROM   transactions
                WHERE  user_id = :user_id
                AND    [date] BETWEEN :date_from AND :date_to
                AND    amount = :amount
            """),
            {
                "user_id":   user_id,
                "date_from": date_from,
                "date_to":   date_to,
                "amount":    txn["amount"],
            }
        ).fetchall()

        for row in rows:
            if _similar(txn["description"], row[0]):
                txn["is_duplicate"] = True
                break

    return transactions


# ── Public Interface ──────────────────────────────────────────

def detect_duplicates(
    db: Session,
    user_id: int,
    transactions: list[dict],
) -> list[dict]:
    """
    Full duplicate detection pipeline:
      1. Flag duplicates within the incoming batch
      2. Flag duplicates against existing DB records

    Returns the same list with 'is_duplicate' set on each item.
    """
    transactions = flag_batch_duplicates(transactions)
    transactions = check_against_db(db, user_id, transactions)
    return transactions
