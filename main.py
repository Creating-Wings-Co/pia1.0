from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse, RedirectResponse
from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime
import logging
import json
from urllib.parse import quote

from config import Config
from database import Database
from vector_store import VectorStore
from rag_system import RAGSystem
from web_search import WebSearchService
from auth0_utils import get_current_user, verify_token

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Validate configuration
try:
    Config.validate()
except ValueError as e:
    logger.error(f"Configuration error: {e}")

# Initialize FastAPI app
app = FastAPI(title="Women's Finance Chatbot", version="1.0.0")

# CORS middleware - Allow all origins for Amplify deployment
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact Amplify URL
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Initialize services
db = Database(
    mongo_uri=Config.MONGODB_URI,
    db_name=Config.MONGODB_DB,
)

vector_store = VectorStore(
    db_path=Config.VECTOR_DB_PATH,
    embedding_model=Config.EMBEDDING_MODEL
)

rag_system = RAGSystem(
    api_key=Config.GOOGLE_GEMINI_API_KEY,
    vector_store=vector_store,
    model_name=Config.GEMINI_MODEL
)

web_search_service = WebSearchService()

class ChatRequest(BaseModel):
    user_id: str
    conversation_id: Optional[str] = None
    message: str


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    escalate: bool = False
    escalation_type: Optional[str] = None


class UserRegistration(BaseModel):
    name: str
    email: EmailStr


class Auth0UserInfo(BaseModel):
    sub: str  # Auth0 user ID
    name: str
    email: str
    income_range: Optional[str] = None
    employment_status: Optional[str] = None
    marital_status: Optional[str] = None
    education: Optional[str] = None
    location: Optional[str] = None
    acceptedTerms: bool = True
    is18OrOlder: bool = True


class UserResponse(BaseModel):
    user_id: str
    name: str
    email: str


def build_user_metadata(db_user: Optional[Dict]) -> Optional[Dict]:
    if not db_user:
        return None
    return {
        "income_range": db_user.get("householdIncomeRange"),
        "marital_status": db_user.get("maritalStatus"),
        "employment_status": db_user.get("employmentStatus"),
        "education": db_user.get("educationLevel"),
        "location": db_user.get("location"),
    }


# Dependency to get current user from token
async def get_user_from_token(authorization: Optional[str] = Header(None)):
    """Dependency to extract and verify Auth0 token"""
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Authorization header required"
        )
    user_info = get_current_user(authorization)
    return user_info

# Dependency that allows optional token (for fallback when no token available)
async def get_user_optional_token(
    authorization: Optional[str] = Header(None),
    request: Optional[ChatRequest] = None
):
    """Dependency that works with or without token - for fallback authentication"""
    if authorization:
        # Try to verify token
        try:
            user_info = get_current_user(authorization)
            return user_info
        except HTTPException:
            # Token invalid, fall through to userId check
            pass
    
    # No token or token invalid - allow if userId is provided and valid
    # This is for the fallback case when token isn't available
    # In production, you might want to add additional security here
    return None  # Will be handled in the endpoint


# API Endpoints
@app.get("/")
async def root():
    """Serve the frontend"""
    import os
    html_path = os.path.join(os.path.dirname(__file__), "static", "index.html")
    response = FileResponse(html_path)
    # Add cache control headers to prevent caching of HTML
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response

# Mount static files AFTER the root route
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/health")
async def health_check():
    """Health check endpoint for ALB"""
    return {"status": "healthy", "service": "chatbot-api"}


@app.get("/api/auth/callback")
async def auth_callback_get(
    sub: Optional[str] = None,
    name: Optional[str] = None,
    email: Optional[str] = None,
    income_range: Optional[str] = None,
    employment_status: Optional[str] = None,
    marital_status: Optional[str] = None,
    education: Optional[str] = None,
    location: Optional[str] = None,
    isRegistration: Optional[str] = None
):
    """
    Handle Auth0 callback via GET (workaround for HTTPS → HTTP mixed content)
    Redirects to chatbot with userId after saving user
    """
    if not sub or not name or not email:
        raise HTTPException(status_code=400, detail="Missing required user information")

    # Create or update user
    logger.info(f"Creating/updating user via GET - sub: {sub}, name: {name}, email: {email}")
    user_id = db.create_or_update_user_from_auth0(
        auth0_sub=sub,
        name=name,
        email=email,
        income_range=income_range if income_range else None,
        employment_status=employment_status if employment_status else None,
        marital_status=marital_status if marital_status else None,
        education=education if education else None,
        location=location if location else None,
        accepted_terms=True,
        is_18_or_older=True,
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create/update user")
    
    # Redirect to chatbot with userId
    return RedirectResponse(url=f"/?userId={quote(user_id, safe='')}", status_code=302)


@app.post("/api/auth/callback")
async def auth_callback(user_info: Auth0UserInfo, authorization: Optional[str] = Header(None)):
    """
    Handle Auth0 callback - create/update user and return user_id
    
    This endpoint is called after successful Auth0 login
    Can work with or without token (for fallback when token not available)
    """
    # Verify token if provided
    if authorization:
        try:
            token_user = get_current_user(authorization)
            # Use token user info if available, otherwise use body
            auth0_sub = token_user.get("sub") or user_info.sub
            name = token_user.get("name") or user_info.name
            email = token_user.get("email") or user_info.email
        except HTTPException:
            # Token verification failed, use body info
            auth0_sub = user_info.sub
            name = user_info.name
            email = user_info.email
    else:
        # No token provided - use body info directly (trusted source from Next.js)
        auth0_sub = user_info.sub
        name = user_info.name
        email = user_info.email
    
    # Create or update user in database.
    logger.info(f"Creating/updating user - auth0_sub: {auth0_sub}, name: {name}, email: {email}")
    user_id = db.create_or_update_user_from_auth0(
        auth0_sub=auth0_sub,
        name=name,
        email=email,
        income_range=user_info.income_range,
        employment_status=user_info.employment_status,
        marital_status=user_info.marital_status,
        education=user_info.education,
        location=user_info.location,
        accepted_terms=user_info.acceptedTerms,
        is_18_or_older=user_info.is18OrOlder,
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create/update user")
    
    user = db.get_user(user_id)
    logger.info(f"User retrieved - auth0_sub: {user_id}, name: {user.get('fullName')}, email: {user.get('email')}")
    
    return UserResponse(
        user_id=user_id,
        name=user.get('fullName') or "",
        email=user['email'],
    )

@app.get("/api/user/me")
async def get_current_user_info(user: Dict = Depends(get_user_from_token)):
    auth0_sub = user.get("sub")
    if not auth0_sub:
        raise HTTPException(status_code=400, detail="Invalid user token")

    # Retrieve user from database using Auth0 sub
    db_user = db.get_user_by_auth0_sub(auth0_sub)

    # If user doesn't exist in database, create a new user record
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": db_user["auth0_sub"],
        "name": db_user["fullName"],
        "email": db_user["email"],
        "location": db_user.get("location"),
        "education": db_user.get("educationLevel"),
        "employment_status": db_user.get("employmentStatus"),
        "income_range": db_user.get("householdIncomeRange"),
        "marital_status": db_user.get("maritalStatus"),
    }



@app.get("/api/user/{user_id}")
async def get_user_by_id(user_id: str):
    """Get user info by ID (for chatbot display)"""
    db_user = db.get_user(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": db_user['auth0_sub'],
        "name": db_user.get('fullName') or "",
        "email": db_user['email'],
    }


@app.post("/api/user/anonymous")
async def create_anonymous_user():
    """Create an anonymous user for direct backend access"""
    # Create anonymous user with default values
    anonymous_sub = f"anonymous_{uuid.uuid4().hex[:12]}"
    user_id = db.create_or_update_user_from_auth0(
        auth0_sub=anonymous_sub,
        name="Guest User",
        email=f"guest_{uuid.uuid4().hex[:8]}@anonymous.local",
        income_range=None,
        employment_status=None,
        marital_status=None,
        education=None,
        location="Unknown, Unknown",
        accepted_terms=True,
        is_18_or_older=True,
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create anonymous user")
    
    user = db.get_user(user_id)
    return UserResponse(
        user_id=user_id,
        name=user.get('fullName') or "",
        email=user['email'],
    )


@app.post("/api/register", response_model=UserResponse)
async def register_user(user_data: UserRegistration):
    """Register a new user (legacy endpoint - kept for backwards compatibility)"""
    # Check if user already exists
    existing_user = db.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    user_id = db.create_user(user_data.name, user_data.email)
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    user = db.get_user(user_id)
    
    return UserResponse(
        user_id=user_id,
        name=user.get('fullName') or "",
        email=user['email'],
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    """Handle chat messages - works with or without Auth0 token"""
    user_id = None
    
    # Try to get user from token if available
    if authorization:
        try:
            user_info = get_current_user(authorization)
            auth0_sub = user_info.get("sub")
            db_user = db.get_user_by_auth0_sub(auth0_sub)
            if db_user:
                user_id = db_user["auth0_sub"]
        except HTTPException:
            # Token invalid, fall through to userId check
            pass
    
    # If no token or token invalid, use userId from request (fallback mode)
    if not user_id:
        user_id = request.user_id
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid user_id")
        db_user = db.get_user(user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
    
    conversation_id = request.conversation_id or str(uuid.uuid4())
    
    # Get conversation history
    conversation_history = db.get_conversation(user_id, conversation_id) or []
    
    # Get user metadata for personalized responses
    user_metadata = build_user_metadata(db_user)
    
    # Add user message to history
    user_message = {
        "role": "user",
        "content": request.message,
        "timestamp": datetime.utcnow()
    }
    conversation_history.append(user_message)
    
    # Generate response using RAG with user metadata
    rag_response = rag_system.generate_response(
        query=request.message,
        conversation_history=conversation_history,
        user_metadata=user_metadata
    )
    
    # If web search is needed
    if rag_response.get("requires_web_search"):
        logger.info("Performing web search for additional information")
        search_results = web_search_service.search(request.message)
        if search_results:
            formatted_results = web_search_service.format_search_results(search_results)
            rag_response = rag_system.generate_response(
                query=request.message,
                conversation_history=conversation_history,
                use_web_search=True,
                web_search_results=formatted_results,
                user_metadata=user_metadata
            )
    
    # Handle escalation
    if rag_response.get("escalate"):
        escalation_type = rag_response.get("escalation_type", "SENSITIVE")
        logger.warning(f"⚠️ ESCALATION: {escalation_type} - User {user_id}: {request.message}")
    
    # Add assistant response to history
    assistant_message = {
        "role": "assistant",
        "content": rag_response["response"],
        "timestamp": datetime.utcnow()
    }
    conversation_history.append(assistant_message)
    
    # Store updated conversation
    db.store_conversation(user_id, conversation_id, conversation_history)
    
    return ChatResponse(
        response=rag_response["response"],
        conversation_id=conversation_id,
        escalate=rag_response.get("escalate", False),
        escalation_type=rag_response.get("escalation_type")
    )


async def generate_streaming_response(user_id: str, conversation_id: str, message: str):
    """Generator function for streaming responses"""
    # Get conversation history
    conversation_history = db.get_conversation(user_id, conversation_id) or []
    
    # Get user metadata for personalized responses
    db_user = db.get_user(user_id)
    user_metadata = build_user_metadata(db_user)
    
    # Add user message to history
    user_message = {
        "role": "user",
        "content": message,
        "timestamp": datetime.utcnow()
    }
    conversation_history.append(user_message)
    
    # Check for sensitive content early
    is_sensitive, sensitivity_type = rag_system.detect_sensitive_content(message)
    
    full_response = ""
    escalation_detected = False
    
    # Generate streaming response with user metadata
    try:
        for chunk in rag_system.generate_response_stream(
            query=message,
            conversation_history=conversation_history,
            user_metadata=user_metadata
        ):
            full_response += chunk
            # Send chunk as JSON
            yield f"data: {json.dumps({'chunk': chunk, 'done': False})}\n\n"
        
        # Check if escalation happened
        escalation_detected = is_sensitive
        
        # If web search might be needed, we can add it here in future
        # For now, just send the complete response
        
    except Exception as e:
        logger.error(f"Error in streaming response: {e}")
        error_chunk = "I apologize, but I encountered an error. Please try again."
        full_response = error_chunk
        yield f"data: {json.dumps({'chunk': error_chunk, 'done': False, 'error': True})}\n\n"
    
    # Add assistant response to history
    assistant_message = {
        "role": "assistant",
        "content": full_response,
        "timestamp": datetime.utcnow()
    }
    conversation_history.append(assistant_message)
    
    # Store updated conversation
    db.store_conversation(user_id, conversation_id, conversation_history)
    
    # Send final message with metadata
    yield f"data: {json.dumps({'done': True, 'conversation_id': conversation_id, 'escalate': escalation_detected, 'escalation_type': sensitivity_type if escalation_detected else None})}\n\n"


@app.post("/api/chat/stream")
async def chat_stream(
    request: ChatRequest,
    authorization: Optional[str] = Header(None)
):
    """Handle streaming chat - works with or without Auth0 token"""
    user_id = None
    
    # Try to get user from token if available
    if authorization:
        try:
            user_info = get_current_user(authorization)
            auth0_sub = user_info.get("sub")
            db_user = db.get_user_by_auth0_sub(auth0_sub)
            if db_user:
                user_id = db_user["auth0_sub"]
        except HTTPException:
            # Token invalid, fall through to userId check
            pass
    
    # If no token or token invalid, use userId from request (fallback mode)
    if not user_id:
        user_id = request.user_id
        if not user_id:
            raise HTTPException(status_code=400, detail="Invalid user_id")
        db_user = db.get_user(user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
    
    # Get user metadata if not already retrieved
    if not db_user:
        db_user = db.get_user(user_id)
    
    conversation_id = request.conversation_id or str(uuid.uuid4())
    
    return StreamingResponse(
        generate_streaming_response(user_id, conversation_id, request.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.get("/api/conversation/{user_id}/{conversation_id}")
async def get_conversation(user_id: str, conversation_id: str, user: Dict = Depends(get_user_from_token)):
    """Get conversation history"""
    auth0_sub = user.get("sub")
    db_user = db.get_user_by_auth0_sub(auth0_sub)
    
    if not db_user or db_user["auth0_sub"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    conversation = db.get_conversation(user_id, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation": conversation}


@app.delete("/api/conversation/{user_id}/{conversation_id}")
async def delete_conversation(user_id: str, conversation_id: str, user: Dict = Depends(get_user_from_token)):
    """Delete a conversation"""
    auth0_sub = user.get("sub")
    db_user = db.get_user_by_auth0_sub(auth0_sub)
    
    if not db_user or db_user["auth0_sub"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    db.clear_conversation(user_id, conversation_id)
    return {"message": "Conversation deleted"}


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "database": "connected",
        "vector_store": "ready"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
