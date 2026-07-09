# ============================================================
#  categoriser.py
#  Assigns a category_id to each transaction based on keywords
#  in the description and merchant name.
#
#  Two-pass approach:
#    Pass 1 — fast keyword matching (no API call, free)
#    Pass 2 — fallback to AWS Bedrock / OpenAI for anything
#              that doesn't match (optional, costs fractions
#              of a cent per call)
# ============================================================

import re
from sqlalchemy.orm import Session
from sqlalchemy import text


# ── Keyword Rules ─────────────────────────────────────────────
# Maps category name → list of keywords to match against description.
# Order matters: more specific rules should come first.

KEYWORD_RULES: list[tuple[str, list[str]]] = [
    ("Salary income",           ["salary", "payroll", "wages", "remuneration"]),
    ("Freelance income",        ["freelance", "invoice", "consulting fee"]),
    ("Rental income",           ["rental income", "rent received", "tenant"]),
    ("Investment income",       ["dividend", "interest earned", "unit trust"]),
    ("Medical expenses",        ["pharmacy", "clicks", "dis-chem", "dischem",
                                  "doctor", "hospital", "dentist", "optometrist",
                                  "medihelp", "discovery health", "bonitas"]),
    ("Retirement contribution", ["old mutual", "sanlam", "liberty", "momentum",
                                  "retirement annuity", "pension", "provident"]),
    ("Travel - business",       ["uber", "bolt", "lyft", "taxi", "petrol",
                                  "shell", "engen", "bp ", "sasol", "caltex",
                                  "e-toll", "toll", "parking"]),
    ("Home office",             ["home office", "stationery", "office supplies",
                                  "makro", "officeworks"]),
    ("Software & subscriptions",["microsoft", "google workspace", "adobe",
                                  "github", "aws ", "amazon web", "netlify",
                                  "heroku", "digitalocean", "vercel"]),
    ("Professional development",["udemy", "coursera", "pluralsight", "manning",
                                  "oreilly", "skillshare", "conference"]),
    ("Business meals",          ["restaurant", "nando", "steers", "wimpy",
                                  "kfc", "mcdonalds", "mugg", "ocean basket"]),
    ("Groceries",               ["woolworths", "pick n pay", "checkers",
                                  "spar", "shoprite", "food lovers", "trader joe"]),
    ("Entertainment",           ["netflix", "showmax", "dstv", "spotify",
                                  "apple music", "steam", "playstation", "xbox",
                                  "movie", "cinema", "ster kinekor", "nu metro"]),
    ("Utilities",               ["eskom", "city power", "municipality", "vodacom",
                                  "mtn ", "cell c", "telkom", "rain ", "internet"]),
    ("Transport",               ["metrobus", "gautrain", "rea vaya", "minibus"]),
    ("Bank charges",            ["monthly fee", "bank charge", "service fee",
                                  "admin fee", "atm fee", "overdraft fee"]),
]


# ── Pass 1: Keyword Matching ──────────────────────────────────

def _keyword_match(description: str, merchant: str | None) -> str | None:
    """
    Check description and merchant against keyword rules.
    Returns category name if matched, None if not.
    """
    text_to_check = f"{description} {merchant or ''}".lower()

    for category_name, keywords in KEYWORD_RULES:
        for keyword in keywords:
            if keyword.lower() in text_to_check:
                return category_name

    return None


# ── Pass 2: AI Fallback ───────────────────────────────────────

def _ai_categorise(description: str, merchant: str | None) -> str:
    """
    Use AWS Bedrock (Claude) to categorise a transaction that
    didn't match any keyword rule.
    Returns a category name from our fixed list.
    Falls back to 'Uncategorised' if the API call fails.
    """
    try:
        import boto3, json
        from app.config import settings

        client = boto3.client("bedrock-runtime", region_name=settings.AWS_REGION)
        category_list = [name for name, _ in KEYWORD_RULES] + ["Uncategorised"]

        prompt = (
            f"You are a South African tax assistant. "
            f"Categorise this bank transaction into exactly one of these categories:\n"
            f"{', '.join(category_list)}\n\n"
            f"Transaction description: {description}\n"
            f"Merchant: {merchant or 'Unknown'}\n\n"
            f"Reply with only the category name, nothing else."
        )

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 50,
            "messages": [{"role": "user", "content": prompt}],
        })

        response = client.invoke_model(
            modelId="anthropic.claude-3-haiku-20240307-v1:0",
            body=body,
        )
        result = json.loads(response["body"].read())
        category = result["content"][0]["text"].strip()

        if category in category_list:
            return category
        return "Uncategorised"

    except Exception:
        return "Uncategorised"


# ── Category ID Lookup ────────────────────────────────────────

def _get_category_id(db: Session, category_name: str) -> int | None:
    """Look up category_id from the database by name."""
    row = db.execute(
        text("SELECT category_id FROM categories WHERE [name] = :name"),
        {"name": category_name}
    ).fetchone()
    return row[0] if row else None


# ── Public Interface ──────────────────────────────────────────

def categorise_transaction(
    db: Session,
    description: str,
    merchant: str | None,
    amount: float,
    use_ai_fallback: bool = True,
) -> tuple[int | None, str]:
    """
    Main entry point. Returns (category_id, category_name).

    Args:
        db:               SQLAlchemy session
        description:      Raw bank transaction description
        merchant:         Cleaned merchant name (may be None)
        amount:           Transaction amount (negative = expense)
        use_ai_fallback:  If True, call AWS Bedrock for unmatched transactions

    Returns:
        (category_id, category_name) — category_id is None if not found in DB
    """
    # Income transactions get income categories regardless of description
    if amount > 0:
        if any(k in description.lower() for k in ["salary", "payroll", "wages"]):
            name = "Salary income"
        elif any(k in description.lower() for k in ["freelance", "invoice"]):
            name = "Freelance income"
        elif "rent" in description.lower():
            name = "Rental income"
        else:
            name = "Investment income"
        return _get_category_id(db, name), name

    # Pass 1: keyword match
    matched_name = _keyword_match(description, merchant)

    # Pass 2: AI fallback
    if matched_name is None and use_ai_fallback:
        matched_name = _ai_categorise(description, merchant)

    final_name = matched_name or "Uncategorised"
    return _get_category_id(db, final_name), final_name


def categorise_batch(
    db: Session,
    transactions: list[dict],
    use_ai_fallback: bool = True,
) -> list[dict]:
    """
    Categorise a list of transaction dicts in one call.
    Adds 'category_id' and 'category_name' keys to each dict.
    """
    for txn in transactions:
        cat_id, cat_name = categorise_transaction(
            db=db,
            description=txn.get("description", ""),
            merchant=txn.get("merchant"),
            amount=txn.get("amount", 0),
            use_ai_fallback=use_ai_fallback,
        )
        txn["category_id"] = cat_id
        txn["category_name"] = cat_name

    return transactions
