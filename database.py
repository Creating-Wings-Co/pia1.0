# database.py - MongoDB database for users and conversations
# This module defines a Database class that provides methods to create and retrieve users and conversations.
# It uses pymongo to interact with a MongoDB database, and includes error handling and logging


# USE CHATGPT TO CONVERT SQLITE CODE TO MONGODB CODE, 
# ALSO ADD METHODS FOR CREATING/UPDATING USERS BASED ON AUTH0 SUB, 
# AND FOR UPDATING USER METADATA. MAKE SURE TO HANDLE DUPLICATE KEY ERRORS WHEN CREATING USERS, AND TO LOG ALL DATABASE OPERATIONS FOR DEBUGGING PURPOSES.

from typing import Optional, Dict, List
import logging
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient, ASCENDING
from pymongo.errors import DuplicateKeyError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Database:
    """MongoDB database for users and conversations"""

    def __init__(self, mongo_uri: str, db_name: str = "creating_wings"):
        self.client = MongoClient(mongo_uri)
        self.db = self.client[db_name]
        self.users = self.db["users"]
        self.conversations = self.db["chats"]
        self.init_db()

    def init_db(self):
        """Initialize collections and indexes"""
        self._ensure_index(self.users, "auth0_sub", unique=True)
        self._ensure_index(self.users, "email", unique=True)

        self._ensure_index(self.conversations, "auth0_sub", unique=True)
        self._ensure_index(self.conversations, "updatedAt")

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
            logger.error(f"User with email {email} already exists")
            return None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None

    def get_user(self, user_id: str) -> Optional[Dict]:
        try:
            return self.get_user_by_auth0_sub(user_id)
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            return None

    def get_user_by_email(self, email: str) -> Optional[Dict]:
        try:
            return self._serialize_user(self.users.find_one({"email": email}))
        except Exception as e:
            logger.error(f"Error getting user by email: {e}")
            return None

    def _to_chat_schema_messages(self, messages: List[Dict]) -> List[Dict]:
        schema_messages = []
        for item in messages[-20:]:
            timestamp = item.get("timestamp")
            if not isinstance(timestamp, datetime):
                timestamp = datetime.now(timezone.utc)
            schema_messages.append({
                "role": item.get("role"),
                "message": item.get("message") or item.get("content", ""),
                "timestamp": timestamp,
            })
        return schema_messages

    def store_conversation(self, auth0_sub: str, conversation_id: str, messages: List[Dict]):
        try:
            now = datetime.now(timezone.utc)
            self.conversations.update_one(
                {"auth0_sub": auth0_sub},
                {
                    "$set": {
                        "auth0_sub": auth0_sub,
                        "messages": self._to_chat_schema_messages(messages),
                        "updatedAt": now,
                    },
                },
                upsert=True,
            )
            return True
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")
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
            logger.error(f"Error getting conversation: {e}")
            return None

    def clear_conversation(self, auth0_sub: str, conversation_id: str):
        try:
            self.conversations.delete_one({"auth0_sub": auth0_sub})
            return True
        except Exception as e:
            logger.error(f"Error clearing conversation: {e}")
            return False

    def cleanup_old_conversations(self, days: int = 1):
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            result = self.conversations.delete_many({"updatedAt": {"$lt": cutoff}})
            logger.info(f"Cleaned up {result.deleted_count} old conversations")
            return result.deleted_count
        except Exception as e:
            logger.error(f"Error cleaning up conversations: {e}")
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
        except DuplicateKeyError as e:
            logger.error(f"Duplicate key while creating/updating Auth0 user: {e}")
            return None
        except Exception as e:
            logger.error(f"Error creating/updating user from Auth0: {e}")
            return None

    def get_user_by_auth0_sub(self, auth0_sub: str) -> Optional[Dict]:
        try:
            return self._serialize_user(self.users.find_one({"auth0_sub": auth0_sub}))
        except Exception as e:
            logger.error(f"Error getting user by auth0_sub: {e}")
            return None
