import logging
import os
from dotenv import load_dotenv


def _env_flag(name: str, default: bool = False) -> bool:
    v = os.getenv(name, "").strip().lower()
    if v in ("1", "true", "yes", "on"):
        return True
    if v in ("0", "false", "no", "off"):
        return False
    return default


# Set DOTENV_OVERRIDE=1 so .env wins over a wrong MONGODB_URI exported in the shell.
load_dotenv(override=_env_flag("DOTENV_OVERRIDE", default=False))


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name, str(default)).strip() or str(default)
    try:
        return int(raw)
    except ValueError:
        return 0


class Config:
    """Central environment configuration. See repository `env.example`."""

    # Google Gemini API
    GOOGLE_GEMINI_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY", "").strip()

    # Deployment / logging (set ENVIRONMENT=production on EC2)
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
    # When True, root logging is disabled (no console output from the logging module).
    DISABLE_CONSOLE_LOGS = _env_flag(
        "DISABLE_CONSOLE_LOGS",
        default=ENVIRONMENT == "production",
    )
    LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").strip().upper()

    # Rolling chat history persisted per user (MongoDB chats collection)
    CONVERSATION_MAX_MESSAGES = _int_env("CONVERSATION_MAX_MESSAGES", 15)

    # MongoDB
    MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
    MONGODB_DB = os.getenv("MONGODB_DB", "creating_wings").strip()

    # Vector Database
    VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./vector_db")

    # Knowledge Base - use relative path by default, can be overridden via env var
    KNOWLEDGE_BASE_PATH = os.getenv(
        "KNOWLEDGE_BASE_PATH",
        os.path.join(os.path.dirname(__file__), "DATABSE"),
    )

    # Model Configuration (RAG / embeddings)
    GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
    EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2").strip()

    # Auth0 Configuration (optional locally — see skip_auth0_env_requirement)
    AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "").strip()
    AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "").strip()
    AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID", "").strip()
    AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET", "").strip()
    AUTH0_NEXTJS_URL = os.getenv("AUTH0_NEXTJS_URL", "http://localhost:3000").strip()

    @classmethod
    def is_production(cls) -> bool:
        return cls.ENVIRONMENT == "production"

    @classmethod
    def is_development(cls) -> bool:
        return cls.ENVIRONMENT == "development"

    @classmethod
    def skip_auth0_env_requirement(cls) -> bool:
        """
        When True, startup validation does not require AUTH0_DOMAIN.
        Use for local chat via POST /api/user/anonymous + /api/chat with user_id.
        Production always requires Auth0 to be configured.
        Default: skip in non-production (AUTH_OPTIONAL defaults true); set AUTH_OPTIONAL=0 to require Auth0 in dev.
        """
        if cls.is_production():
            return False
        return _env_flag("AUTH_OPTIONAL", default=True)

    @classmethod
    def auth0_is_configured(cls) -> bool:
        return bool(cls.AUTH0_DOMAIN)

    @classmethod
    def configure_logging(cls) -> None:
        """Call once at process startup (e.g. from main)."""
        if cls.DISABLE_CONSOLE_LOGS:
            logging.disable(logging.CRITICAL)
            return
        logging.disable(logging.NOTSET)
        level = getattr(logging, cls.LOG_LEVEL, logging.INFO)
        logging.basicConfig(level=level)

    @classmethod
    def validate(cls, *, for_chat_api: bool = True):
        """Validate configuration. Use for_chat_api=False for offline tooling (e.g. vector index build)."""
        if not for_chat_api:
            return
        if not cls.GOOGLE_GEMINI_API_KEY:
            raise ValueError("GOOGLE_GEMINI_API_KEY is required")
        if not cls.MONGODB_URI:
            raise ValueError("MONGODB_URI is required")
        if not cls.MONGODB_URI.startswith(("mongodb://", "mongodb+srv://")):
            raise ValueError(
                "MONGODB_URI must start with mongodb:// or mongodb+srv:// (use your Atlas connection string)"
            )
        lowered = cls.MONGODB_URI.lower()
        _bad = (
            "your_mongodb_uri",
            "after_password_change",
            "<password>",
            "password_placeholder",
        )
        if any(b in lowered for b in _bad):
            raise ValueError(
                "MONGODB_URI looks like a placeholder or example text. "
                "Use Atlas → Connect → Drivers and set DOTENV_OVERRIDE=1 if your shell still exports an old MONGODB_URI."
            )
        if not cls.skip_auth0_env_requirement():
            if not cls.AUTH0_DOMAIN:
                raise ValueError(
                    "AUTH0_DOMAIN is required (production or AUTH_OPTIONAL=0). "
                    "For local chat without Auth0, use ENVIRONMENT=development and AUTH_OPTIONAL=1 (default in dev)."
                )
        if cls.CONVERSATION_MAX_MESSAGES < 1:
            raise ValueError(
                "CONVERSATION_MAX_MESSAGES must be a positive integer (check your .env)"
            )
