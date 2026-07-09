# ============================================================
#  config.py — Loads environment variables from .env
# ============================================================

from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DB_SERVER: str
    DB_PORT: int = 1433
    DB_NAME: str = "Pocket_Ledger_SA"
    DB_USER: str
    DB_PASSWORD: str

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str = "af-south-1"
    S3_BUCKET_NAME: str

    COGNITO_USER_POOL_ID: str
    COGNITO_APP_CLIENT_ID: str
    COGNITO_REGION: str = "af-south-1"

    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    DEBUG: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
