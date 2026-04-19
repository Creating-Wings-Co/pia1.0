# database.py - MongoDB database for users and conversations
# This module defines a Database class that provides methods to create and retrieve users and conversations.
# It uses pymongo to interact with a MongoDB database, and includes error handling and logging


from typing import Optional, Dict, List
import logging
import re
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError, OperationFailure

from config import Config

logger = logging.getLogger(__name__)

_EMAIL_RE = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
)
_PHONE_RE = re.compile(
    r"\b(?:\+?\d{1,3}[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}\b",
)
_SSN_RE = re.compile(r"\b\d{3}-\d{2}-\d{4}\b")
# 13–19 digit sequences (cards / long account numbers); allow separators
_LONG_DIGITS_RE = re.compile(
    r"\b(?:\d[-\s.]?){12,19}\d\b",
)


def _mask_pii_in_text(text: str) -> str:
    """Redact common PII patterns in user/assistant message bodies before persistence."""
    if not text or not isinstance(text, str):
        return text
    redacted = _EMAIL_RE.sub("[redacted]", text)
    redacted = _PHONE_RE.sub("[redacted]", redacted)
    redacted = _SSN_RE.sub("[redacted]", redacted)
    redacted = _LONG_DIGITS_RE.sub("[redacted]", redacted)
    return redacted


class Database:
    """MongoDB database for users and conversations"""

    def __init__(
        self,
        mongo_uri: str,
        db_name: str = "creating_wings",
        max_conversation_messages: Optional[int] = None,
    ):
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.users = self.db["users"]
        self.conversations = self.db["chats"]
        self.max_conversation_messages = (
            max_conversation_messages
            if max_conversation_messages is not None
            else Config.CONVERSATION_MAX_MESSAGES
        )
        self.init_db()

    def init_db(self):
        """Initialize collections and indexes"""
        self._ensure_index(self.users, "auth0_sub", unique=True)
        self._ensure_index(self.users, "email", unique=True)

        self._ensure_index(self.conversations, "auth0_sub", unique=True)
        self._ensure_index(self.conversations, "updatedAt")

        if not Config.DISABLE_CONSOLE_LOGS:
            logger.info("MongoDB initialized")

    def _ensure_index(self, collection, field: str, unique: bool = False):
        index_name = f"{field}_1"
        existing = collection.index_information().get(index_name)

        if existing:
            existing_unique = bool(existing.get("unique"))
            if existing_unique == unique:
                return

            logger.warning(
                "Index %s.%s already exists with unique=%s; expected unique=%s. "
                "Leaving existing index unchanged.",
                collection.name,
                index_name,
                existing_unique,
                unique,
            )
            return

        collection.create_index([(field, ASCENDING)], unique=unique)

    def _serialize_user(self, doc: Optional[Dict]) -> Optional[Dict]:
        if not doc:
            return None
        result = {k: v for k, v in doc.items() if k != "_id"}
        return result

    def create_user(self, name: str, email: str) -> Optional[str]:
        try:
            auth0_sub = f"legacy:{email}"
            self.users.insert_one({
                "auth0_sub": auth0_sub,
                "email": email,
                "fullName": name,
                "location": "Unknown, Unknown",
                "maritalStatus": None,
                "householdIncomeRange": None,
                "educationLevel": None,
                "employmentStatus": None,
                "acceptedTerms": True,
                "is18OrOlder": True,
            })
            return auth0_sub
        except DuplicateKeyError:
            logger.error("User create failed: duplicate email or auth0_sub")
            return None
        except Exception as e:
            logger.error("Error creating user: %s", type(e).__name__)
            return None

    def get_user(self, user_id: str) -> Optional[Dict]:
        try:
            return self.get_user_by_auth0_sub(user_id)
        except Exception as e:
            logger.error("Error getting user: %s", type(e).__name__)
            return None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        try:
            return self._serialize_user(self.users.find_one({"email": email}))
        except Exception as e:
            logger.error("Error getting user by email: %s", type(e).__name__)
            return None

    def _to_chat_schema_messages(self, messages: List[Dict]) -> List[Dict]:
        """Keep only the most recent turns; text is redacted for storage."""
        cap = max(1, self.max_conversation_messages)
        schema_messages = []
        for item in messages[-cap:]:
            timestamp = item.get("timestamp")
            if not isinstance(timestamp, datetime):
                timestamp = datetime.now(timezone.utc)
            raw = item.get("message") or item.get("content", "") or ""
            body = _mask_pii_in_text(str(raw))
            schema_messages.append({
                "role": item.get("role"),
                "message": body,
                "timestamp": timestamp,
            })
        return schema_messages

    def store_conversation(self, auth0_sub: str, conversation_id: str, messages: List[Dict]):
        try:
            now = datetime.now(timezone.utc)
            trimmed = self._to_chat_schema_messages(messages)
            self.conversations.update_one(
                {"auth0_sub": auth0_sub},
                {
                    "$set": {
                        "auth0_sub": auth0_sub,
                        # Omit conversation_id: Atlas (or other) JSON Schema on `chats` may use
                        # additionalProperties:false without this field; session id stays client-side.
                        "messages": trimmed,
                        "updatedAt": now,
                    },
                },
                upsert=True,
            )
            return True
        except Exception as e:
            if isinstance(e, OperationFailure):
                logger.error(
                    "Error storing conversation: %s code=%s details=%s",
                    type(e).__name__,
                    e.code,
                    e.details,
                )
            else:
                logger.error(
                    "Error storing conversation: %s: %s",
                    type(e).__name__,
                    e,
                )
            return False

    def get_conversation(self, auth0_sub: str, conversation_id: str) -> Optional[List[Dict]]:
        try:
            doc = self.conversations.find_one({"auth0_sub": auth0_sub})
            if not doc:
                return None
            return [
                {
                    "role": item.get("role"),
                    "content": item.get("message", ""),
                    "timestamp": item.get("timestamp"),
                }
                for item in doc.get("messages", [])
            ]
        except Exception as e:
            logger.error("Error getting conversation: %s", type(e).__name__)
            return None

    def clear_conversation(self, auth0_sub: str, conversation_id: str):
        try:
            self.conversations.delete_one({"auth0_sub": auth0_sub})
            return True
        except Exception as e:
            logger.error("Error clearing conversation: %s", type(e).__name__)
            return False

    def cleanup_old_conversations(self, days: int = 1):
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            result = self.conversations.delete_many({"updatedAt": {"$lt": cutoff}})
            if not Config.DISABLE_CONSOLE_LOGS:
                logger.info("Cleaned up %s stale conversation documents", result.deleted_count)
            return result.deleted_count
        except Exception as e:
            logger.error("Error cleaning up conversations: %s", type(e).__name__)
            return 0

    def create_or_update_user_from_auth0(
        self,
        auth0_sub: str,
        name: str,
        email: str,
        income_range: Optional[str] = None,
        employment_status: Optional[str] = None,
        marital_status: Optional[str] = None,
        education: Optional[str] = None,
        location: Optional[str] = None,
        accepted_terms: bool = True,
        is_18_or_older: bool = True,
    ) -> Optional[str]:
        try:
            updates = {
                "auth0_sub": auth0_sub,
                "email": email,
                "fullName": name,
                "location": location or "Unknown, Unknown",
                "maritalStatus": marital_status,
                "householdIncomeRange": income_range,
                "educationLevel": education,
                "employmentStatus": employment_status,
                "acceptedTerms": bool(accepted_terms),
                "is18OrOlder": bool(is_18_or_older),
            }

            existing = self.users.find_one({"auth0_sub": auth0_sub})
            if existing:
                self.users.update_one({"auth0_sub": auth0_sub}, {"$set": updates})
                return auth0_sub

            email_existing = self.users.find_one({"email": email})
            if email_existing:
                self.users.update_one({"email": email}, {"$set": updates})
                return auth0_sub

            self.users.insert_one(updates)
            return auth0_sub
        except DuplicateKeyError:
            logger.error("Auth0 user upsert failed: duplicate key")
            return None
        except Exception as e:
            logger.error("Error creating/updating user from Auth0: %s", type(e).__name__)
            return None

    def get_user_by_auth0_sub(self, auth0_sub: str) -> Optional[Dict]:
        try:
            return self._serialize_user(self.users.find_one({"auth0_sub": auth0_sub}))
        except Exception as e:
            logger.error("Error getting user by auth0_sub: %s", type(e).__name__)
            return None
