"""
Script to initialize the vector database with knowledge base documents
Run this once to populate the vector database
"""
import logging
from config import Config
from document_processor import DocumentProcessor
from vector_store import VectorStore

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def initialize_vector_db():
    """Initialize vector database with knowledge base documents"""
    logger.info("Starting vector database initialization...")
    
    # Initialize document processor
    processor = DocumentProcessor(Config.KNOWLEDGE_BASE_PATH)
    
    # Process all documents
    logger.info(f"Processing documents from {Config.KNOWLEDGE_BASE_PATH}")
    documents = processor.process_all_documents()
    
    if not documents:
        logger.warning("No documents found to process")
        return
    
    # Initialize vector store
    logger.info(f"Initializing vector store at {Config.VECTOR_DB_PATH}")
    vector_store = VectorStore(
        db_path=Config.VECTOR_DB_PATH,
        embedding_model=Config.EMBEDDING_MODEL
    )
    
    # Clear existing collection (optional - comment out if you want to add to existing)
    # vector_store.delete_collection()
    # vector_store = VectorStore(
    #     db_path=Config.VECTOR_DB_PATH,
    #     embedding_model=Config.EMBEDDING_MODEL
    # )
    
    # Add documents to vector store
    logger.info("Adding documents to vector store...")
    vector_store.add_documents(documents)
    
    # Get collection info
    info = vector_store.get_collection_info()
    logger.info(f"Vector database initialized successfully!")
    logger.info(f"Total document chunks: {info['document_count']}")


if __name__ == "__main__":
    try:
        Config.validate()
        initialize_vector_db()
    except Exception as e:
        logger.error(f"Error initializing vector database: {e}")
        raise

