import chromadb
from chromadb.config import Settings
from chromadb.utils import embedding_functions
from typing import List, Dict, Optional
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VectorStore:
    """Manages vector database for document embeddings"""
    
    def __init__(self, db_path: str, embedding_model: str = "all-MiniLM-L6-v2"):
        self.db_path = Path(db_path)
        self.db_path.mkdir(parents=True, exist_ok=True)
        
        # Use sentence transformers for embeddings
        self.embedding_function = embedding_functions.SentenceTransformerEmbeddingFunction(
            model_name=embedding_model
        )
        
        # Initialize ChromaDB client
        self.client = chromadb.PersistentClient(
            path=str(self.db_path),
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Get or create collection
        self.collection = self.client.get_or_create_collection(
            name="finance_knowledge_base",
            embedding_function=self.embedding_function,
            metadata={"hnsw:space": "cosine"}
        )
    
    def add_documents(self, documents: List[Dict[str, str]], chunk_size: int = 500, chunk_overlap: int = 50):
        """Add documents to vector store with chunking"""
        all_ids = []
        all_texts = []
        all_metadatas = []
        
        for doc in documents:
            filename = doc["filename"]
            content = doc["content"]
            
            # Simple chunking by character count
            chunks = self._chunk_text(content, chunk_size, chunk_overlap)
            
            for i, chunk in enumerate(chunks):
                chunk_id = f"{filename}_chunk_{i}"
                all_ids.append(chunk_id)
                all_texts.append(chunk)
                all_metadatas.append({
                    "filename": filename,
                    "chunk_index": i,
                    "file_path": doc.get("file_path", "")
                })
        
        if all_texts:
            self.collection.add(
                ids=all_ids,
                documents=all_texts,
                metadatas=all_metadatas
            )
            logger.info(f"Added {len(all_texts)} document chunks to vector store")
    
    def _chunk_text(self, text: str, chunk_size: int, chunk_overlap: int) -> List[str]:
        """Split text into overlapping chunks"""
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + chunk_size
            chunk = text[start:end]
            
            # Try to break at sentence boundary
            if end < text_length:
                # Look for sentence ending in the last 100 characters
                last_period = chunk.rfind('.')
                last_newline = chunk.rfind('\n')
                break_point = max(last_period, last_newline)
                
                if break_point > start + chunk_size - 100:
                    chunk = chunk[:break_point + 1]
                    end = start + break_point + 1
            
            chunks.append(chunk.strip())
            start = end - chunk_overlap
        
        return [chunk for chunk in chunks if chunk]
    
    def search(self, query: str, n_results: int = 5) -> List[Dict]:
        """Search for similar documents"""
        results = self.collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        retrieved_docs = []
        if results['documents'] and len(results['documents'][0]) > 0:
            for i in range(len(results['documents'][0])):
                retrieved_docs.append({
                    "content": results['documents'][0][i],
                    "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                    "distance": results['distances'][0][i] if results['distances'] else 0
                })
        
        return retrieved_docs
    
    def delete_collection(self):
        """Delete the collection (use with caution)"""
        try:
            self.client.delete_collection("finance_knowledge_base")
            logger.info("Collection deleted")
        except Exception as e:
            logger.error(f"Error deleting collection: {e}")
    
    def get_collection_info(self) -> Dict:
        """Get information about the collection"""
        count = self.collection.count()
        return {
            "collection_name": "finance_knowledge_base",
            "document_count": count
        }

