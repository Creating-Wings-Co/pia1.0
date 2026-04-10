# Creating Wings Co - Women's Financial Empowerment Chatbot

A production-ready AI-powered chatbot application designed to provide personalized financial and wellness advice for women. The system uses Google OAuth for authentication, FastAPI for the backend, React for the frontend, and a RAG (Retrieval-Augmented Generation) system powered by Google Gemini AI.

## 🎯 Project Overview

This application provides a personalized chatbot experience where users:
1. **Register** with their metadata (age, location, income, education, etc.)
2. **Authenticate** via Google OAuth through Auth0
3. **Chat** with an AI assistant that uses their profile information to provide tailored financial and wellness advice
4. **View** their profile information displayed in the chat interface

## 🏗️ Architecture

```
┌─────────────────┐
│  React Frontend │  (Port 3000)
│  - Login        │
│  - Registration │
│  - Callback     │
└────────┬────────┘
         │
         │ Auth0 OAuth
         │
┌────────▼────────┐
│  FastAPI       │  (Port 8000)
│  Backend       │
│  - Auth        │
│  - Chat API    │
│  - User API    │
└────────┬────────┘
         │
    ┌────┴────┬──────────────┐
    │         │              │
┌───▼───┐ ┌──▼────┐    ┌────▼─────┐
│SQLite │ │Chroma │    │Google    │
│DB     │ │Vector │    │Gemini AI │
│       │ │Store  │    │          │
└───────┘ └───────┘    └──────────┘
```

## 🛠️ Technologies Used

### Backend
- **FastAPI** - Modern Python web framework for building APIs
- **SQLite** - Lightweight database for user and conversation storage
- **ChromaDB** - Vector database for semantic search
- **Google Gemini AI** - LLM for generating responses
- **Sentence Transformers** - For text embeddings
- **Auth0** - Authentication and authorization service
- **PyJWT** - JWT token verification

### Frontend
- **React** - UI library for building user interfaces
- **React Router DOM** - Client-side routing
- **Auth0 React SDK** - Auth0 integration for React
- **Vanilla JavaScript** - Chat interface logic

### Document Processing
- **PyPDF2** - PDF text extraction
- **python-docx** - Word document processing
- **openpyxl** - Excel file processing

## 📁 Project Structure

```
CWMVP/
├── Backend (Python)
│   ├── main.py                 # FastAPI application entry point
│   ├── database.py             # SQLite database operations
│   ├── rag_system.py           # RAG system with Gemini AI
│   ├── vector_store.py         # ChromaDB vector store wrapper
│   ├── document_processor.py   # Document processing utilities
│   ├── config.py               # Configuration management
│   ├── auth0_utils.py          # Auth0 token verification
│   ├── web_search.py           # Web search functionality
│   ├── initialize_db.py        # Database initialization script
│   └── requirements.txt        # Python dependencies
│
├── Frontend (React)
│   └── frontend/
│       ├── src/
│       │   ├── App.js          # Main React app component
│       │   ├── index.js        # React entry point
│       │   ├── components/
│       │   │   ├── Login.js           # Login page component
│       │   │   ├── Registration.js    # Registration form component
│       │   │   └── Callback.js        # Auth0 callback handler
│       │   ├── config/
│       │   │   └── auth0.js          # Auth0 configuration
│       │   └── utils/
│       │       └── validators.js     # Form validation utilities
│       └── package.json        # Node.js dependencies
│
└── Static Files (Chatbot Interface)
    └── static/
        ├── index.html          # Chatbot HTML page
        ├── script.js           # Chatbot JavaScript logic
        └── styles.css          # Chatbot styling
```

## 📄 Code Files Explained

### Backend Files

#### `main.py`
**Purpose**: FastAPI application entry point and API routes  
**Key Responsibilities**:
- Initializes FastAPI app with CORS middleware
- Serves static files (HTML, CSS, JS) for the chatbot interface
- Defines API endpoints:
  - `GET /` - Serves chatbot HTML page
  - `POST /api/auth/callback` - Handles Auth0 callback, creates/updates users
  - `GET /api/user/me` - Gets current user info from token
  - `GET /api/user/{user_id}` - Gets user info by ID
  - `POST /api/chat/stream` - Streaming chat endpoint with RAG system
- Manages user sessions and conversation history
- Integrates with database, vector store, and RAG system

#### `database.py`
**Purpose**: SQLite database operations and user management  
**Key Responsibilities**:
- Creates and manages `users` and `conversations` tables
- Stores user metadata (age, income, location, education, etc.)
- Handles user creation/updates from Auth0
- Manages conversation history per user
- Provides methods:
  - `create_or_update_user_from_auth0()` - Creates/updates user from Auth0 data
  - `get_user_by_auth0_sub()` - Retrieves user by Auth0 subject ID
  - `get_user()` - Gets user by database ID
  - `save_conversation()` - Saves chat messages
  - `get_conversation_history()` - Retrieves past conversations

#### `rag_system.py`
**Purpose**: RAG (Retrieval-Augmented Generation) system for AI responses  
**Key Responsibilities**:
- Integrates Google Gemini AI for generating responses
- Retrieves relevant context from vector database
- Personalizes responses based on user metadata
- Implements streaming responses for real-time chat
- Detects sensitive content requiring escalation
- Uses a warm, professional tone tailored for women's financial empowerment
- Methods:
  - `generate_response_stream()` - Generates streaming AI responses
  - `detect_sensitive_content()` - Identifies sensitive topics
  - `_build_prompt()` - Constructs personalized prompts with user context

#### `vector_store.py`
**Purpose**: ChromaDB vector store wrapper for semantic search  
**Key Responsibilities**:
- Manages document embeddings in ChromaDB
- Performs semantic similarity search
- Stores and retrieves knowledge base documents
- Uses sentence transformers for text embeddings
- Methods:
  - `add_documents()` - Adds documents to vector store
  - `search()` - Searches for similar documents
  - `get_collection()` - Gets ChromaDB collection

#### `document_processor.py`
**Purpose**: Processes various document formats for knowledge base  
**Key Responsibilities**:
- Extracts text from PDF, Word (.docx), and Excel (.xlsx) files
- Processes documents from knowledge base directory
- Returns structured document data for embedding
- Methods:
  - `extract_text_from_pdf()` - PDF text extraction
  - `extract_text_from_docx()` - Word document extraction
  - `extract_text_from_xlsx()` - Excel file extraction
  - `process_all_documents()` - Processes entire knowledge base

#### `config.py`
**Purpose**: Centralized configuration management  
**Key Responsibilities**:
- Loads environment variables from `.env` file
- Provides configuration for:
  - Google Gemini API key
  - Database paths (SQLite, ChromaDB)
  - Knowledge base path
  - Auth0 credentials
  - Model names
- Validates required configuration on startup

#### `auth0_utils.py`
**Purpose**: Auth0 token verification and user extraction  
**Key Responsibilities**:
- Verifies JWT tokens from Auth0
- Extracts user information from tokens
- Provides dependency functions for FastAPI routes
- Methods:
  - `verify_token()` - Verifies Auth0 JWT token
  - `get_current_user()` - FastAPI dependency for authenticated routes

#### `web_search.py`
**Purpose**: Web search functionality for real-time information  
**Key Responsibilities**:
- Performs web searches when needed
- Can be integrated for real-time information retrieval
- Currently available but not actively used in main flow

#### `initialize_db.py`
**Purpose**: Script to initialize vector database with knowledge base  
**Key Responsibilities**:
- Processes all documents in knowledge base directory
- Creates embeddings and stores in ChromaDB
- Run once to populate vector database
- Usage: `python initialize_db.py`

### Frontend Files

#### `frontend/src/App.js`
**Purpose**: Main React application component  
**Key Responsibilities**:
- Wraps entire app with `Auth0Provider` for authentication
- Sets up React Router for navigation
- Defines routes:
  - `/` and `/login` - Login page
  - `/register` - Registration page
  - `/callback` - Auth0 callback handler
- Validates Auth0 configuration on load
- Handles redirect URI configuration

#### `frontend/src/index.js`
**Purpose**: React application entry point  
**Key Responsibilities**:
- Renders React app to DOM
- Initializes React application

#### `frontend/src/components/Login.js`
**Purpose**: Login page component  
**Key Responsibilities**:
- Displays login interface
- Integrates with Auth0 `loginWithRedirect`
- Handles Google OAuth flow
- Supports both registration and login flows
- Redirects to `/callback` after authentication

#### `frontend/src/components/Registration.js`
**Purpose**: User registration form component  
**Key Responsibilities**:
- Collects user metadata:
  - Email, username, full name
  - Age range, location
  - Marital status, income range
  - Education, employment status
- Validates form inputs
- Stores registration data in `sessionStorage`
- Redirects to login with `?registration=true` flag
- **Note**: No password fields - uses OAuth only

#### `frontend/src/components/Callback.js`
**Purpose**: Auth0 callback handler component  
**Key Responsibilities**:
- Handles Auth0 redirect after authentication
- Retrieves user info from Auth0
- Reads registration data from `sessionStorage`
- Merges Auth0 user data with registration metadata
- Sends user data to FastAPI `/api/auth/callback` endpoint
- Redirects to FastAPI chatbot with `userId` parameter
- Cleans up session storage after processing

#### `frontend/src/config/auth0.js`
**Purpose**: Auth0 configuration module  
**Key Responsibilities**:
- Exports Auth0 configuration from environment variables
- Provides FastAPI backend URL
- Configures redirect URI for OAuth callback
- Used by all Auth0-related components

#### `frontend/src/utils/validators.js`
**Purpose**: Form validation utilities  
**Key Responsibilities**:
- `validateTerms()` - Validates terms and conditions acceptance
- Provides reusable validation functions
- Returns error messages for invalid inputs

### Static Files (Chatbot Interface)

#### `static/index.html`
**Purpose**: Chatbot interface HTML page  
**Key Responsibilities**:
- Main HTML structure for chatbot interface
- Contains chat header with user profile section
- Includes login modal for authentication
- Chat messages container
- Chat input form
- Links to `script.js` and `styles.css`

#### `static/script.js`
**Purpose**: Chatbot JavaScript logic  
**Key Responsibilities**:
- Handles user authentication flow
- Manages user sessions (localStorage)
- Loads and displays user profile in header
- Personalizes welcome message ("Hi [Name]!")
- Handles chat message sending
- Manages streaming responses from API
- Updates UI with chat messages
- Handles login/logout functionality
- Key functions:
  - `loadUserProfile()` - Fetches and displays user profile
  - `displayUserProfile()` - Shows user info in header
  - `updateWelcomeMessage()` - Personalizes greeting
  - `sendMessage()` - Sends chat messages to API
  - `enableChat()` - Enables chat interface

#### `static/styles.css`
**Purpose**: Chatbot interface styling  
**Key Responsibilities**:
- Styles chat container and messages
- User profile display styling
- Login modal styling
- Responsive design
- Color scheme and typography
- Chat message bubbles styling

## 🔄 Application Flow

### Registration Flow
1. User visits `/register` → Fills out registration form
2. Form data stored in `sessionStorage`
3. Redirects to `/login?registration=true`
4. User clicks "Sign in with Google"
5. Auth0 handles Google OAuth
6. Redirects to `/callback`
7. `Callback.js` merges Auth0 data with registration data
8. Sends to FastAPI `/api/auth/callback`
9. FastAPI creates/updates user in database
10. Redirects to FastAPI chatbot with `userId`

### Login Flow
1. User visits `/login` → Clicks "Sign in with Google"
2. Auth0 handles Google OAuth
3. Redirects to `/callback`
4. `Callback.js` sends user data to FastAPI
5. FastAPI creates/updates user in database
6. Redirects to FastAPI chatbot with `userId`

### Chat Flow
1. User lands on FastAPI chatbot (`/`)
2. `script.js` checks for `userId` in URL or localStorage
3. If `userId` present → Loads user profile and enables chat
4. If not → Shows login modal
5. User sends message → `script.js` calls `/api/chat/stream`
6. FastAPI uses RAG system to generate response
7. Response streams back to user in real-time
8. Messages saved to database

## 🔐 Authentication

- **Provider**: Auth0 with Google OAuth
- **Flow**: OAuth 2.0 Authorization Code Flow
- **Token Storage**: Browser localStorage
- **User Storage**: SQLite database with Auth0 subject ID
- **Session Management**: userId stored in localStorage

## 💾 Data Storage

### SQLite Database (`chatbot.db`)
- **users** table: User profiles with metadata
- **conversations** table: Chat message history

### ChromaDB Vector Store (`vector_db/`)
- Document embeddings for semantic search
- Knowledge base documents (PDFs, Word docs, Excel files)

## 🚀 Setup Instructions

### Prerequisites
- Python 3.8+
- Node.js 16+
- Google Gemini API key
- Auth0 account and application

### Backend Setup
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Create `.env` file:
   ```env
   GOOGLE_GEMINI_API_KEY=your_gemini_api_key
   DATABASE_PATH=chatbot.db
   VECTOR_DB_PATH=./vector_db
   KNOWLEDGE_BASE_PATH=./DATABSE
   AUTH0_DOMAIN=your_auth0_domain
   AUTH0_CLIENT_ID=your_auth0_client_id
   AUTH0_CLIENT_SECRET=your_auth0_client_secret
   AUTH0_AUDIENCE=your_auth0_audience
   ```

3. Initialize vector database:
   ```bash
   python initialize_db.py
   ```

4. Start FastAPI server:
   ```bash
   uvicorn main:app --reload
   ```

### Frontend Setup
1. Navigate to frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env` file:
   ```env
   REACT_APP_AUTH0_DOMAIN=your_auth0_domain
   REACT_APP_AUTH0_CLIENT_ID=your_auth0_client_id
   REACT_APP_AUTH0_AUDIENCE=your_auth0_audience
   REACT_APP_AUTH0_REDIRECT_URI=http://localhost:3000/callback
   REACT_APP_FASTAPI_URL=http://localhost:8000
   ```

4. Start React app:
   ```bash
   npm start
   ```

## 📝 Key Features

- ✅ **OAuth Authentication** - Google sign-in via Auth0
- ✅ **User Registration** - Collects comprehensive user metadata
- ✅ **Personalized Chat** - AI responses tailored to user profile
- ✅ **User Profile Display** - Shows user info in chat header
- ✅ **Streaming Responses** - Real-time chat experience
- ✅ **Conversation History** - Saves all chat messages
- ✅ **RAG System** - Context-aware responses from knowledge base
- ✅ **Production Ready** - Clean, professional UI/UX

## 🔧 Environment Variables

### Backend (.env)
- `GOOGLE_GEMINI_API_KEY` - Google Gemini API key (required)
- `DATABASE_PATH` - SQLite database path (default: `chatbot.db`)
- `VECTOR_DB_PATH` - ChromaDB path (default: `./vector_db`)
- `KNOWLEDGE_BASE_PATH` - Knowledge base directory (default: `./DATABSE`)
- `AUTH0_DOMAIN` - Auth0 domain (required)
- `AUTH0_CLIENT_ID` - Auth0 client ID (required)
- `AUTH0_CLIENT_SECRET` - Auth0 client secret (required)
- `AUTH0_AUDIENCE` - Auth0 API audience (required)

### Frontend (.env)
- `REACT_APP_AUTH0_DOMAIN` - Auth0 domain (required)
- `REACT_APP_AUTH0_CLIENT_ID` - Auth0 client ID (required)
- `REACT_APP_AUTH0_AUDIENCE` - Auth0 API audience (required)
- `REACT_APP_AUTH0_REDIRECT_URI` - OAuth callback URL (required)
- `REACT_APP_FASTAPI_URL` - Backend API URL (default: `http://localhost:8000`)

## 📚 Knowledge Base

The system uses documents stored in the `DATABSE/` directory:
- PDF files (financial guides, investment advice)
- Word documents (tax information, legal documents)
- Excel files (financial data, spreadsheets)

These documents are processed and embedded into the vector database for semantic search during chat responses.

## 🎨 UI Components

- **Login Page** - Google OAuth sign-in
- **Registration Page** - User metadata collection form
- **Chatbot Interface** - Main chat interface with:
  - User profile display (avatar, name, email)
  - Personalized welcome message
  - Chat message history
  - Input field for new messages
  - Streaming response display

## 🔍 API Endpoints

- `GET /` - Serves chatbot HTML page
- `POST /api/auth/callback` - Auth0 callback handler
- `GET /api/user/me` - Get current user info
- `GET /api/user/{user_id}` - Get user by ID
- `POST /api/chat/stream` - Streaming chat endpoint

## 📦 Dependencies

See `requirements.txt` for Python dependencies and `frontend/package.json` for Node.js dependencies.

---

**Built with ❤️ for women's financial empowerment**

