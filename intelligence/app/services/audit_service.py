# ============================================================
#  audit_service.py
#  Raises audit_flags for anything suspicious:
#    - Outlier amounts (unusually large for that category)
#    - Missing receipts on deductible transactions
#    - Duplicate transactions (from duplicate_detector)
#    - Uncategorised transactions
# ============================================================

from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime


# ── Thresholds ────────────────────────────────────────────────
# If a single transaction exceeds this rand amount per category,
# it gets flagged as an outlier for manual review.

OUTLIER_THRESHOLDS: dict[str, float] = {
    "Medical expenses":          5000.00,
    "Travel - business":         3000.00,
    "Business meals":            2000.00,
    "Home office":               5000.00,
    "Software & subscriptions":  1000.00,
    "Professional development":  3000.00,
    "Retirement contribution":  15000.00,
    "Groceries":                 3000.00,
    "Entertainment":             1000.00,
    "default":                  10000.00,
}

# Deductible categories that SARS may ask for receipts on audit
RECEIPT_REQUIRED_CATEGORIES = {
    "Medical expenses",
    "Travel - business",
    "Business meals",
    "Home office",
    "Software & subscriptions",
    "Professional development",
    "Retirement contribution",
}


# ── Flag Writers ──────────────────────────────────────────────

def _write_flag(
    db: Session,
    user_id: int,
    transaction_id: int | None,
    flag_type: str,
    severity: str,
    description: str,
) -> None:
    db.execute(
        text("""
            INSERT INTO audit_flags
                (user_id, transaction_id, flag_type, severity, [description], resolved, created_at)
            VALUES
                (:user_id, :transaction_id, :flag_type, :severity, :description, 0, GETDATE())
        """),
        {
            "user_id":        user_id,
            "transaction_id": transaction_id,
            "flag_type":      flag_type,
            "severity":       severity,
            "description":    description,
        }
    )


# ── Individual Checks ─────────────────────────────────────────

def check_outlier(
    db: Session,
    user_id: int,
    transaction_id: int,
    amount: float,
    category_name: str,
) -> bool:
    """Flag if the absolute amount exceeds the category threshold."""
    threshold = OUTLIER_THRESHOLDS.get(category_name, OUTLIER_THRESHOLDS["default"])
    abs_amount = abs(amount)

    if abs_amount > threshold:
        _write_flag(
            db, user_id, transaction_id,
            flag_type="outlier",
            severity="high" if abs_amount > threshold * 2 else "medium",
            description=(
                f"Transaction of R{abs_amount:,.2f} in '{category_name}' "
                f"exceeds the expected threshold of R{threshold:,.2f}. "
                f"Verify this is legitimate before claiming as a deduction."
            )
        )
        return True
    return False


def check_missing_receipt(
    db: Session,
    user_id: int,
    transaction_id: int,
    category_name: str,
    is_deductible: bool,
) -> bool:
    """Flag deductible transactions that have no receipt attached."""
    if not is_deductible or category_name not in RECEIPT_REQUIRED_CATEGORIES:
        return False

    row = db.execute(
        text("SELECT COUNT(*) FROM receipts WHERE transaction_id = :txn_id"),
        {"txn_id": transaction_id}
    ).scalar()

    if row == 0:
        _write_flag(
            db, user_id, transaction_id,
            flag_type="missing_receipt",
            severity="medium",
            description=(
                f"No receipt found for a deductible '{category_name}' transaction. "
                f"SARS may disallow this deduction without supporting documentation."
            )
        )
        return True
    return False


def check_uncategorised(
    db: Session,
    user_id: int,
    transaction_id: int,
    category_name: str,
) -> bool:
    """Flag transactions the categoriser couldn't classify."""
    if category_name == "Uncategorised":
        _write_flag(
            db, user_id, transaction_id,
            flag_type="other",
            severity="low",
            description=(
                "This transaction could not be automatically categorised. "
                "Please assign a category manually to ensure accurate tax calculations."
            )
        )
        return True
    return False


def check_duplicate_flag(
    db: Session,
    user_id: int,
    transaction_id: int,
) -> bool:
    """Write an audit flag for a transaction already marked as duplicate."""
    _write_flag(
        db, user_id, transaction_id,
        flag_type="duplicate",
        severity="high",
        description=(
            "This transaction appears to be a duplicate of an existing record. "
            "It has been excluded from tax calculations. "
            "Review and delete if confirmed duplicate."
        )
    )
    return True


# ── Public Interface ──────────────────────────────────────────

def run_audit_checks(
    db: Session,
    user_id: int,
    saved_transactions: list[dict],
) -> int:
    """
    Run all audit checks against a list of saved transactions.
    Each dict must have: transaction_id, amount, category_name,
    is_deductible, is_duplicate.

    Returns the total number of flags raised.
    """
    flags_raised = 0

    for txn in saved_transactions:
        txn_id       = txn["transaction_id"]
        amount       = txn["amount"]
        category     = txn.get("category_name", "Uncategorised")
        is_deductible = txn.get("is_deductible", False)
        is_duplicate  = txn.get("is_duplicate", False)

        if is_duplicate:
            check_duplicate_flag(db, user_id, txn_id)
            flags_raised += 1
            continue   # No further checks on duplicates

        if check_outlier(db, user_id, txn_id, amount, category):
            flags_raised += 1

        if check_missing_receipt(db, user_id, txn_id, category, is_deductible):
            flags_raised += 1

        if check_uncategorised(db, user_id, txn_id, category):
            flags_raised += 1

    db.commit()
    return flags_raised
