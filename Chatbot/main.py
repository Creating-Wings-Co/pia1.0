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
db = Database(db_path=Config.DATABASE_PATH)

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

# Request/Response Models
class ChatMessage(BaseModel):
    role: str
    content: str
    timestamp: Optional[str] = None


class ChatRequest(BaseModel):
    user_id: str  # Accept as string, convert to int
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
    phone: Optional[str] = None


class Auth0UserInfo(BaseModel):
    sub: str  # Auth0 user ID
    name: str
    email: str
    picture: Optional[str] = None
    # Registration metadata (optional)
    phone: Optional[str] = None
    age: Optional[int] = None
    financial_goals: Optional[str] = None
    income_range: Optional[str] = None
    employment_status: Optional[str] = None
    marital_status: Optional[str] = None
    dependents: Optional[int] = None
    investment_experience: Optional[str] = None
    risk_tolerance: Optional[str] = None
    education: Optional[str] = None
    location: Optional[str] = None
    username: Optional[str] = None


class UserResponse(BaseModel):
    user_id: int
    name: str
    email: str
    created_at: str


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
    picture: Optional[str] = None,
    phone: Optional[str] = None,
    age: Optional[str] = None,
    financial_goals: Optional[str] = None,
    income_range: Optional[str] = None,
    employment_status: Optional[str] = None,
    marital_status: Optional[str] = None,
    dependents: Optional[str] = None,
    investment_experience: Optional[str] = None,
    risk_tolerance: Optional[str] = None,
    education: Optional[str] = None,
    location: Optional[str] = None,
    username: Optional[str] = None,
    isRegistration: Optional[str] = None
):
    """
    Handle Auth0 callback via GET (workaround for HTTPS → HTTP mixed content)
    Redirects to chatbot with userId after saving user
    """
    if not sub or not name or not email:
        raise HTTPException(status_code=400, detail="Missing required user information")
    
    # Convert string params to proper types
    age_int = int(age) if age and age.isdigit() else None
    dependents_int = int(dependents) if dependents and dependents.isdigit() else None
    
    # Create or update user
    logger.info(f"Creating/updating user via GET - sub: {sub}, name: {name}, email: {email}")
    user_id = db.create_or_update_user_from_auth0(
        auth0_sub=sub,
        name=name,
        email=email,
        picture=picture,
        phone=phone if phone else None,
        age=age_int,
        financial_goals=financial_goals if financial_goals else None,
        income_range=income_range if income_range else None,
        employment_status=employment_status if employment_status else None,
        marital_status=marital_status if marital_status else None,
        dependents=dependents_int,
        investment_experience=investment_experience if investment_experience else None,
        risk_tolerance=risk_tolerance if risk_tolerance else None,
        education=education if education else None,
        location=location if location else None,
        username=username if username else None
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create/update user")
    
    # Redirect to chatbot with userId
    return RedirectResponse(url=f"/?userId={user_id}", status_code=302)


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
    
    # Create or update user in database with metadata
    logger.info(f"Creating/updating user - auth0_sub: {auth0_sub}, name: {name}, email: {email}")
    user_id = db.create_or_update_user_from_auth0(
        auth0_sub=auth0_sub,
        name=name,
        email=email,
        picture=user_info.picture,
        phone=user_info.phone,
        age=user_info.age,
        financial_goals=user_info.financial_goals,
        income_range=user_info.income_range,
        employment_status=user_info.employment_status,
        marital_status=user_info.marital_status,
        dependents=user_info.dependents,
        investment_experience=user_info.investment_experience,
        risk_tolerance=user_info.risk_tolerance,
        education=user_info.education,
        location=user_info.location,
        username=user_info.username
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create/update user")
    
    user = db.get_user(user_id)
    logger.info(f"User retrieved - id: {user_id}, name: {user.get('name')}, email: {user.get('email')}")
    
    return UserResponse(
        user_id=user_id,
        name=user['name'],
        email=user['email'],
        created_at=user['created_at']
    )


@app.get("/api/user/me")
async def get_current_user_info(user: Dict = Depends(get_user_from_token)):
    """Get current user info from token - creates user if doesn't exist"""
    auth0_sub = user.get("sub")
    if not auth0_sub:
        raise HTTPException(status_code=400, detail="Invalid user token")
    
    # Get user from database
    db_user = db.get_user_by_auth0_sub(auth0_sub) 
    
    # If user doesn't exist, create them from token info
    if not db_user:
        name = user.get("name", "User")
        email = user.get("email", "")
        
        if not email:
            raise HTTPException(status_code=400, detail="Email not found in token")
        
        # Create user in database
        user_id = db.create_or_update_user_from_auth0(
            auth0_sub=auth0_sub,
            name=name,
            email=email,
        )
        
        if not user_id:
            raise HTTPException(status_code=500, detail="Failed to create user")
        
        # Get the newly created user
        db_user = db.get_user(user_id)
        if not db_user:
            raise HTTPException(status_code=500, detail="Failed to retrieve created user")
    
    # Return full user info including metadata
    return {
        "user_id": db_user['id'],
        "name": db_user['name'],
        "email": db_user['email'],
        "picture": None,  # Can be added if stored
        "created_at": db_user['created_at']
    }


@app.get("/api/user/{user_id}")
async def get_user_by_id(user_id: int):
    """Get user info by ID (for chatbot display)"""
    db_user = db.get_user(user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "user_id": db_user['id'],
        "name": db_user['name'],
        "email": db_user['email'],
        "picture": None,
        "created_at": db_user['created_at']
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
        picture=None,
        phone=None,
        age=None,
        financial_goals=None,
        income_range=None,
        employment_status=None,
        marital_status=None,
        dependents=None,
        investment_experience=None,
        risk_tolerance=None,
        education=None,
        location=None,
        username=None
    )
    
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create anonymous user")
    
    user = db.get_user(user_id)
    return UserResponse(
        user_id=user_id,
        name=user['name'],
        email=user['email'],
        created_at=user['created_at']
    )


@app.post("/api/register", response_model=UserResponse)
async def register_user(user_data: UserRegistration):
    """Register a new user (legacy endpoint - kept for backwards compatibility)"""
    # Check if user already exists
    existing_user = db.get_user_by_email(user_data.email)
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")
    
    user_id = db.create_user(user_data.name, user_data.email, user_data.phone)
    if not user_id:
        raise HTTPException(status_code=500, detail="Failed to create user")
    
    user = db.get_user(user_id)
    
    return UserResponse(
        user_id=user_id,
        name=user['name'],
        email=user['email'],
        created_at=user['created_at']
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
                user_id = db_user['id']
        except HTTPException:
            # Token invalid, fall through to userId check
            pass
    
    # If no token or token invalid, use userId from request (fallback mode)
    if not user_id:
        try:
            user_id = int(request.user_id)
            # Verify user exists
            db_user = db.get_user(user_id)
            if not db_user:
                raise HTTPException(status_code=404, detail="User not found")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid user_id")
    
    conversation_id = request.conversation_id or str(uuid.uuid4())
    
    # Get conversation history
    conversation_history = db.get_conversation(user_id, conversation_id) or []
    
    # Get user metadata for personalized responses
    user_metadata = None
    if db_user:
        user_metadata = {
            'age': db_user.get('age'),
            'income_range': db_user.get('income_range'),
            'marital_status': db_user.get('marital_status'),
            'employment_status': db_user.get('employment_status'),
            'education': db_user.get('education'),
            'location': db_user.get('location'),
            'financial_goals': db_user.get('financial_goals'),
            'risk_tolerance': db_user.get('risk_tolerance'),
        }
    
    # Add user message to history
    user_message = {
        "role": "user",
        "content": request.message,
        "timestamp": datetime.utcnow().isoformat()
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
        "timestamp": datetime.utcnow().isoformat()
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


async def generate_streaming_response(user_id: int, conversation_id: str, message: str):
    """Generator function for streaming responses"""
    # Get conversation history
    conversation_history = db.get_conversation(user_id, conversation_id) or []
    
    # Get user metadata for personalized responses
    db_user = db.get_user(user_id)
    user_metadata = None
    if db_user:
        user_metadata = {
            'age': db_user.get('age'),
            'income_range': db_user.get('income_range'),
            'marital_status': db_user.get('marital_status'),
            'employment_status': db_user.get('employment_status'),
            'education': db_user.get('education'),
            'location': db_user.get('location'),
            'financial_goals': db_user.get('financial_goals'),
            'risk_tolerance': db_user.get('risk_tolerance'),
        }
    
    # Add user message to history
    user_message = {
        "role": "user",
        "content": message,
        "timestamp": datetime.utcnow().isoformat()
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
        "timestamp": datetime.utcnow().isoformat()
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
                user_id = db_user['id']
        except HTTPException:
            # Token invalid, fall through to userId check
            pass
    
    # If no token or token invalid, use userId from request (fallback mode)
    if not user_id:
        try:
            user_id = int(request.user_id)
            # Verify user exists
            db_user = db.get_user(user_id)
            if not db_user:
                raise HTTPException(status_code=404, detail="User not found")
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid user_id")
    
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
    
    if not db_user or str(db_user['id']) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        user_id_int = int(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    
    conversation = db.get_conversation(user_id_int, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation": conversation}


@app.delete("/api/conversation/{user_id}/{conversation_id}")
async def delete_conversation(user_id: str, conversation_id: str, user: Dict = Depends(get_user_from_token)):
    """Delete a conversation"""
    auth0_sub = user.get("sub")
    db_user = db.get_user_by_auth0_sub(auth0_sub)
    
    if not db_user or str(db_user['id']) != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    try:
        user_id_int = int(user_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid user_id")
    
    db.clear_conversation(user_id_int, conversation_id)
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
