# ============================================================
#  database.py — SQL Server connection via SQLAlchemy
#  Both you and Brooklyn connect to the same AWS RDS instance.
# ============================================================

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings
import urllib

def get_connection_string() -> str:
    params = urllib.parse.quote_plus(
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={settings.DB_SERVER},{settings.DB_PORT};"
        f"DATABASE={settings.DB_NAME};"
        f"UID={settings.DB_USER};"
        f"PWD={settings.DB_PASSWORD};"
        f"Encrypt=yes;TrustServerCertificate=no;"
    )
    return f"mssql+pyodbc:///?odbc_connect={params}"

engine = create_engine(
    get_connection_string(),
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    echo=settings.DEBUG,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency — yields a DB session per request."""
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def health_check() -> bool:
    """Returns True if the database is reachable."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
