import sqlite3
from typing import Optional, Dict, List
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class Database:
    """Simple SQLite database for users and conversations"""
    
    def __init__(self, db_path: str = "chatbot.db"):
        self.db_path = Path(db_path)
        self.init_db()
    
    def get_connection(self):
        """Get database connection"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        return conn
    
    def init_db(self):
        """Initialize database tables"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Users table - ADD auth0_sub field and metadata fields
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                auth0_sub TEXT UNIQUE,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                phone TEXT,
                age INTEGER,
                financial_goals TEXT,
                income_range TEXT,
                employment_status TEXT,
                marital_status TEXT,
                dependents INTEGER,
                investment_experience TEXT,
                risk_tolerance TEXT,
                education TEXT,
                location TEXT,
                username TEXT,
                metadata TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Add new columns if they don't exist (for existing databases)
        new_columns = [
            ("auth0_sub", "TEXT"),
            ("age", "INTEGER"),
            ("financial_goals", "TEXT"),
            ("income_range", "TEXT"),
            ("employment_status", "TEXT"),
            ("marital_status", "TEXT"),
            ("dependents", "INTEGER"),
            ("investment_experience", "TEXT"),
            ("risk_tolerance", "TEXT"),
            ("education", "TEXT"),
            ("location", "TEXT"),
            ("username", "TEXT"),
            ("metadata", "TEXT"),
            ("updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP")
        ]
        
        for column_name, column_type in new_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {column_name} {column_type}")
                conn.commit()
            except sqlite3.OperationalError as e:
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    pass  # Column already exists
                else:
                    logger.warning(f"Could not add {column_name} column: {e}")
        
        # Create unique index for auth0_sub
        try:
            cursor.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth0_sub ON users(auth0_sub)")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Index might already exist
        
        # Conversations table (temporary storage - auto cleanup old ones)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                messages TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {self.db_path}")
    
    # User methods
    def create_user(self, name: str, email: str, phone: Optional[str] = None) -> Optional[int]:
        """Create a new user"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO users (name, email, phone) VALUES (?, ?, ?)",
                (name, email, phone)
            )
            user_id = cursor.lastrowid
            conn.commit()
            conn.close()
            return user_id
        except sqlite3.IntegrityError:
            logger.error(f"User with email {email} already exists")
            return None
        except Exception as e:
            logger.error(f"Error creating user: {e}")
            return None
    
    def get_user(self, user_id: int) -> Optional[Dict]:
        """Get user by ID"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Error getting user: {e}")
            return None
    
    def get_user_by_email(self, email: str) -> Optional[Dict]:
        """Get user by email"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Error getting user by email: {e}")
            return None
    
    # Conversation methods
    def store_conversation(self, user_id: int, conversation_id: str, messages: List[Dict]):
        """Store conversation history"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            messages_json = json.dumps(messages)
            cursor.execute("""
                INSERT OR REPLACE INTO conversations (id, user_id, messages, updated_at)
                VALUES (?, ?, ?, ?)
            """, (conversation_id, user_id, messages_json, datetime.utcnow()))
            
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")
            return False
    
    def get_conversation(self, user_id: int, conversation_id: str) -> Optional[List[Dict]]:
        """Get conversation history"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "SELECT messages FROM conversations WHERE id = ? AND user_id = ?",
                (conversation_id, user_id)
            )
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return json.loads(row['messages'])
            return None
        except Exception as e:
            logger.error(f"Error getting conversation: {e}")
            return None
    
    def clear_conversation(self, user_id: int, conversation_id: str):
        """Delete a conversation"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute(
                "DELETE FROM conversations WHERE id = ? AND user_id = ?",
                (conversation_id, user_id)
            )
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error clearing conversation: {e}")
            return False
    
    def cleanup_old_conversations(self, days: int = 1):
        """Clean up conversations older than specified days"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cutoff = datetime.utcnow() - timedelta(days=days)
            cursor.execute(
                "DELETE FROM conversations WHERE updated_at < ?",
                (cutoff,)
            )
            deleted = cursor.rowcount
            conn.commit()
            conn.close()
            logger.info(f"Cleaned up {deleted} old conversations")
            return deleted
        except Exception as e:
            logger.error(f"Error cleaning up conversations: {e}")
            return 0
    
    def create_or_update_user_from_auth0(
        self, 
        auth0_sub: str, 
        name: str, 
        email: str, 
        picture: Optional[str] = None,
        phone: Optional[str] = None,
        age: Optional[int] = None,
        financial_goals: Optional[str] = None,
        income_range: Optional[str] = None,
        employment_status: Optional[str] = None,
        marital_status: Optional[str] = None,
        dependents: Optional[int] = None,
        investment_experience: Optional[str] = None,
        risk_tolerance: Optional[str] = None,
        education: Optional[str] = None,
        location: Optional[str] = None,
        username: Optional[str] = None
    ) -> Optional[int]:
        """Create or update user from Auth0 info with metadata"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Check if user exists by auth0_sub
            cursor.execute("SELECT id FROM users WHERE auth0_sub = ?", (auth0_sub,))
            existing = cursor.fetchone()
            
            if existing:
                # Update existing user with all metadata (ALWAYS update name from Auth0)
                user_id = existing['id']
                logger.info(f"Updating existing user {user_id} with Auth0 data - name: {name}, email: {email}")
                cursor.execute(
                    """UPDATE users SET name = ?, email = ?, phone = ?, age = ?, 
                       financial_goals = ?, income_range = ?, employment_status = ?, 
                       marital_status = ?, dependents = ?, investment_experience = ?, 
                       risk_tolerance = ?, education = ?, location = ?, username = ?,
                       updated_at = CURRENT_TIMESTAMP 
                       WHERE auth0_sub = ?""",
                    (name, email, phone, age, financial_goals, income_range,
                     employment_status, marital_status, dependents, investment_experience,
                     risk_tolerance, education, location, username, auth0_sub)
                )
                logger.info(f"User {user_id} updated successfully - new name: {name}")
            else:
                # Check if user exists by email (for migration)
                cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
                email_existing = cursor.fetchone()
                
                if email_existing:
                    # Update existing user with auth0_sub and metadata
                    user_id = email_existing['id']
                    cursor.execute(
                        """UPDATE users SET auth0_sub = ?, name = ?, phone = ?, age = ?, 
                           financial_goals = ?, income_range = ?, employment_status = ?, 
                           marital_status = ?, dependents = ?, investment_experience = ?, 
                           risk_tolerance = ?, education = ?, location = ?, username = ?,
                           updated_at = CURRENT_TIMESTAMP 
                           WHERE email = ?""",
                        (auth0_sub, name, phone, age, financial_goals, income_range,
                         employment_status, marital_status, dependents, investment_experience,
                         risk_tolerance, education, location, username, email)
                    )
                else:
                    # Create new user with all metadata
                    cursor.execute(
                        """INSERT INTO users (auth0_sub, name, email, phone, age, 
                           financial_goals, income_range, employment_status, 
                           marital_status, dependents, investment_experience, risk_tolerance,
                           education, location, username) 
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (auth0_sub, name, email, phone, age, financial_goals, income_range,
                         employment_status, marital_status, dependents, investment_experience,
                         risk_tolerance, education, location, username)
                    )
                    user_id = cursor.lastrowid
            
            conn.commit()
            conn.close()
            return user_id
        except Exception as e:
            logger.error(f"Error creating/updating user from Auth0: {e}")
            return None
    
    def get_user_by_auth0_sub(self, auth0_sub: str) -> Optional[Dict]:
        """Get user by Auth0 sub (subject) identifier"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE auth0_sub = ?", (auth0_sub,))
            row = cursor.fetchone()
            conn.close()
            
            if row:
                return dict(row)
            return None
        except Exception as e:
            logger.error(f"Error getting user by auth0_sub: {e}")
            return None
    
    def update_user_metadata(
        self,
        user_id: int,
        age: Optional[int] = None,
        financial_goals: Optional[str] = None,
        income_range: Optional[str] = None,
        employment_status: Optional[str] = None,
        marital_status: Optional[str] = None,
        dependents: Optional[int] = None,
        investment_experience: Optional[str] = None,
        risk_tolerance: Optional[str] = None,
        metadata: Optional[str] = None
    ) -> bool:
        """Update user metadata"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            updates = []
            values = []
            
            if age is not None:
                updates.append("age = ?")
                values.append(age)
            if financial_goals is not None:
                updates.append("financial_goals = ?")
                values.append(financial_goals)
            if income_range is not None:
                updates.append("income_range = ?")
                values.append(income_range)
            if employment_status is not None:
                updates.append("employment_status = ?")
                values.append(employment_status)
            if marital_status is not None:
                updates.append("marital_status = ?")
                values.append(marital_status)
            if dependents is not None:
                updates.append("dependents = ?")
                values.append(dependents)
            if investment_experience is not None:
                updates.append("investment_experience = ?")
                values.append(investment_experience)
            if risk_tolerance is not None:
                updates.append("risk_tolerance = ?")
                values.append(risk_tolerance)
            if metadata is not None:
                updates.append("metadata = ?")
                values.append(metadata)
            
            if updates:
                updates.append("updated_at = CURRENT_TIMESTAMP")
                values.append(user_id)
                
                query = f"UPDATE users SET {', '.join(updates)} WHERE id = ?"
                cursor.execute(query, values)
                conn.commit()
            
            conn.close()
            return True
        except Exception as e:
            logger.error(f"Error updating user metadata: {e}")
            return False
