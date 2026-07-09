# PocketLedger SA — Python Intelligence Service

Handles bank statement parsing, receipt OCR, transaction categorisation,
duplicate detection, and audit flagging.

## Tech Stack
- **FastAPI** — REST API framework
- **SQLAlchemy + pyodbc** — connects to AWS RDS (SQL Server)
- **AWS S3** — receipt image storage
- **Amazon Textract** — OCR on receipt images
- **AWS Bedrock (Claude Haiku)** — AI fallback for categorisation
- **pdfplumber / openpyxl** — parse PDF and Excel bank statements

## Project Structure
```
intelligence/
├── app/
│   ├── main.py              ← FastAPI routes (start here)
│   ├── config.py            ← Environment variable loading
│   ├── database.py          ← SQL Server connection
│   └── services/
│       ├── statement_parser.py   ← PDF/Excel bank statement reader
│       ├── categoriser.py        ← Keyword + AI transaction tagger
│       ├── duplicate_detector.py ← Finds duplicate transactions
│       ├── audit_service.py      ← Raises audit flags
│       └── s3_service.py         ← S3 upload + Textract OCR
├── requirements.txt
└── .env.example             ← Copy to .env and fill in values
```

## Setup (PyCharm)

1. Open PyCharm → **File → Open** → select the `intelligence/` folder
2. PyCharm will detect `requirements.txt` — click **Install requirements**
3. Copy `.env.example` to `.env` and fill in your AWS and DB credentials
4. Run the server:
   ```
   uvicorn app.main:app --reload --port 8000
   ```
5. Open http://localhost:8000/docs to see all API endpoints

## API Endpoints

| Method | Route | What it does |
|--------|-------|--------------|
| GET | `/health` | Check DB and API are running |
| POST | `/statements/upload?user_id=1` | Upload PDF/Excel bank statement |
| POST | `/receipts/upload?user_id=1` | Upload receipt image (runs OCR) |
| GET | `/transactions/{user_id}` | Get user's transactions |
| GET | `/audit-flags/{user_id}` | Get open audit flags |
| PUT | `/audit-flags/{id}/resolve` | Resolve a flag |

## Statement Import Pipeline

```
Upload PDF/Excel
      ↓
parse_statement()      ← extract raw transactions
      ↓
categorise_batch()     ← keyword match → AI fallback
      ↓
detect_duplicates()    ← within batch + against DB
      ↓
Save to transactions   ← write to AWS RDS
      ↓
run_audit_checks()     ← flag outliers, missing receipts, duplicates
```

## Environment Variables

See `.env.example` for all required variables.
Ask Prosper for the AWS credentials — never share them on GitHub.
