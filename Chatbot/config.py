import os
from dotenv import load_dotenv

load_dotenv()

class Config:
    # Google Gemini API
    GOOGLE_GEMINI_API_KEY = os.getenv("GOOGLE_GEMINI_API_KEY", "").strip()
    
    # Database
    DATABASE_PATH = os.getenv("DATABASE_PATH", "chatbot.db")
    
    # Vector Database
    VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./vector_db")
    
    # Knowledge Base - use relative path by default, can be overridden via env var
    KNOWLEDGE_BASE_PATH = os.getenv("KNOWLEDGE_BASE_PATH", os.path.join(os.path.dirname(__file__), "DATABSE"))
    
    # Model Configuration
    GEMINI_MODEL = "gemini-2.5-flash"  # or "gemini-1.5-pro" for better quality
    EMBEDDING_MODEL = "all-MiniLM-L6-v2"
    
    # Auth0 Configuration
    AUTH0_DOMAIN = os.getenv("AUTH0_DOMAIN", "").strip()
    AUTH0_AUDIENCE = os.getenv("AUTH0_AUDIENCE", "").strip()
    AUTH0_CLIENT_ID = os.getenv("AUTH0_CLIENT_ID", "").strip()
    AUTH0_CLIENT_SECRET = os.getenv("AUTH0_CLIENT_SECRET", "").strip()
    AUTH0_NEXTJS_URL = os.getenv("AUTH0_NEXTJS_URL", "http://localhost:3000").strip()
    
    @classmethod
    def validate(cls):
        """Validate that required configuration is present"""
        if not cls.GOOGLE_GEMINI_API_KEY:
            raise ValueError("GOOGLE_GEMINI_API_KEY is required")
        if not cls.AUTH0_DOMAIN:
            raise ValueError("AUTH0_DOMAIN is required")
