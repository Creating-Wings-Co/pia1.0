import google.generativeai as genai
from typing import List, Dict, Optional, Generator
import logging
from datetime import datetime
import re

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class RAGSystem:
    """Enhanced RAG """
    
    def __init__(self, api_key: str, vector_store, model_name: str = "gemini-2.5-flash"):
        genai.configure(api_key=api_key)
        self.model = genai.GenerativeModel(model_name)
        self.vector_store = vector_store
        
        # Enhanced system prompt - Pia, AI assistant for Creating Wings
        self.system_prompt = """You are Pia, an AI assistant and part of Creating Wings, an NGO dedicated to empowering women through accessible, AI-powered financial guidance and career development resources.

ABOUT CREATING WINGS:
Creating Wings is dedicated to empowering women by providing accessible, AI-powered financial guidance and career development resources. Our mission is to bridge the financial literacy gap, support women in achieving self-sufficiency, and create a supportive ecosystem for economic growth. Through education, mentorship, and cutting-edge technology, we strive to uplift women and enable them to take control of their financial future with confidence.

YOUR ROLE AS PIA:
You are supportive, knowledgeable, and empowering—never condescending or patronizing. You treat every woman as capable and intelligent, meeting them where they are in their financial journey. Your communication style is warm yet professional, like a trusted advisor who believes in their potential. You're here to guide, educate, and support—not to lecture or talk down.

Your goal is to provide clear, actionable financial and career advice tailored to each woman's unique situation. You understand that financial decisions are deeply personal and often emotional, so you approach every conversation with empathy, respect, and genuine support.

IMPORTANT: You ONLY answer questions relevant to women's financial empowerment, career development, and related topics. Questions outside this scope will be handled by the system.

RESPONSE GUIDELINES:
1. **Tone & Style**: 
   - Be warm and professional—like a trusted advisor, not a salesperson
   - Use natural, conversational language while maintaining expertise
   - Avoid corporate jargon, emojis, or overly casual expressions
   - Be confident and clear, never apologetic or uncertain

2. **Personalization**: 
   - Reference the user's specific situation when known (age, income, goals, etc.)
   - Tailor advice to their life stage and circumstances
   - Acknowledge their unique challenges without making assumptions

3. **Structure & Clarity**:
   - Use **bold** for key terms and important points
   - Use bullet points for lists and actionable steps
   - Use numbered lists for sequential instructions
   - Break content into digestible paragraphs
   - Use section headings (###) for longer responses

4. **Context Awareness**:
   - Reference previous conversation naturally
   - Build on information shared earlier
   - Ask thoughtful, specific questions when more context is needed

5. **Action-Oriented**:
   - Provide specific, actionable advice—not just information
   - Give concrete next steps when possible
   - Explain the "why" behind recommendations

6. **Women's Unique Challenges**:
   - Consider career gaps, longer lifespans, investing confidence gaps
   - Address financial abuse, caregiving responsibilities, and pay gaps
   - Acknowledge systemic barriers while empowering action

7. **Escalation** (only when truly needed):
   - Immediate safety: "I'm concerned about your safety. Please contact 911 or the National Suicide Prevention Lifeline at 988."
   - Professional services: "For this situation, I'd recommend consulting with a certified financial planner. They can provide personalized guidance."
   - Be direct and helpful—no unnecessary disclaimers

8. **Honesty**:
   - If information isn't available, say so clearly
   - Offer to help find information or suggest next steps
   - Never make up information or guess

Remember: As Pia, you're part of Creating Wings' mission to empower women. You're helping women build financial confidence and independence through education and support. Every response should move them forward, even if it's just a small step. Be their ally, not their teacher—support their journey with respect and belief in their capabilities. You're here to bridge the financial literacy gap and help them achieve self-sufficiency with confidence.
"""
    
    def preprocess_query(self, query: str) -> List[str]:
        """Preprocess and chunk user query for better retrieval"""
        # Clean the query
        query = query.strip()
        
        # Split compound questions
        questions = re.split(r'[?]\s+', query)
        questions = [q.strip() + '?' if not q.endswith('?') and q else q.strip() 
                    for q in questions if q.strip()]
        
        # If it's a single question, try to extract key concepts
        if len(questions) == 1:
            # Extract key financial terms and concepts
            query_lower = query.lower()
            financial_keywords = [
                'investment', 'savings', 'retirement', 'budget', 'debt', 'credit',
                'insurance', 'tax', 'mortgage', 'loan', 'income', 'expense',
                'portfolio', '401k', 'ira', 'stocks', 'bonds', 'mutual fund'
            ]
            
            # Check if query needs expansion
            has_keywords = any(keyword in query_lower for keyword in financial_keywords)
            if not has_keywords and len(query.split()) < 5:
                # Query might be too vague
                return [query]  # Return as-is, let the system ask clarifying questions
        
        return questions if questions else [query]
    
    def analyze_query_completeness(self, query: str, conversation_history: List[Dict] = None) -> Dict:
        """Analyze if query has enough context or needs clarification"""
        query_lower = query.lower()
        
        # Patterns indicating incomplete queries
        vague_patterns = [
            r'^how\s+(do|can|should)',
            r'^what\s+is',
            r'^tell\s+me\s+about',
            r'^help\s+with',
        ]
        
        is_vague = any(re.match(pattern, query_lower) for pattern in vague_patterns)
        word_count = len(query.split())
        
        # Check if question is too short or vague
        needs_clarification = (is_vague and word_count < 5) or word_count < 3
        
        # Check for missing context indicators
        context_indicators = ['my', 'i', 'me', 'specific', 'situation', 'current']
        has_context = any(indicator in query_lower for indicator in context_indicators)
        
        return {
            "needs_clarification": needs_clarification and not has_context,
            "is_vague": is_vague,
            "has_context": has_context
        }
    
    def detect_sensitive_content(self, query: str) -> tuple:
        """Enhanced detection of sensitive or dangerous content"""
        sensitive_keywords = [
            'suicide', 'self-harm', 'kill myself', 'end my life', 'want to die',
            'abuse', 'domestic violence', 'violence', 'beaten', 'hurt me',
            'fraud', 'illegal', 'scam', 'stolen',
            'emergency', 'crisis', 'immediate danger', '911'
        ]
        
        query_lower = query.lower()
        
        # Check for immediate danger keywords
        danger_keywords = ['suicide', 'kill myself', 'end my life', 'want to die', 'harm myself']
        for keyword in danger_keywords:
            if keyword in query_lower:
                return True, "DANGER"
        
        # Check for abuse/violence
        abuse_keywords = ['abuse', 'violence', 'beaten', 'hurt me', 'threaten']
        for keyword in abuse_keywords:
            if keyword in query_lower:
                return True, "ABUSE"
        
        # Check for sensitive keywords (financial crisis, legal issues)
        sensitive_patterns = ['financial crisis', 'bankruptcy', 'losing everything', 'can\'t pay']
        for pattern in sensitive_patterns:
            if pattern in query_lower:
                return True, "SENSITIVE"
        
        return False, ""
    
    def is_query_contextual(self, retrieved_docs: List[Dict], threshold: float = 0.85) -> bool:
        """Check if query is contextual based on retrieved document relevance"""
        if not retrieved_docs:
            return False
        
        # Check if any document has a good similarity score (lower distance = better match)
        # Distance > threshold means not relevant enough
        best_match = min([doc.get('distance', 1.0) for doc in retrieved_docs])
        
        # If best match distance is less than threshold, it's contextual
        return best_match < threshold
    
    def extract_meaningful_questions(self, conversation_history: List[Dict], limit: int = 3) -> List[str]:
        """Extract meaningful user questions from conversation history"""
        meaningful_questions = []
        
        if not conversation_history:
            return meaningful_questions
        
        # Look for user questions that were followed by substantial assistant responses
        for i in range(len(conversation_history) - 1):
            msg = conversation_history[i]
            next_msg = conversation_history[i + 1]
            
            # Check if this is a user message (question)
            if msg.get('role') == 'user':
                user_q = msg.get('content', '').strip()
                assistant_r = next_msg.get('content', '') if next_msg.get('role') == 'assistant' else ''
                
                # Consider it meaningful if:
                # 1. It's a question (has ? or question words)
                # 2. It got a substantial response (>50 chars)
                # 3. It's not too generic
                if (user_q and 
                    len(user_q) > 10 and 
                    len(assistant_r) > 50 and
                    ('?' in user_q or any(word in user_q.lower() for word in ['what', 'how', 'why', 'when', 'where', 'can', 'should', 'do', 'does', 'is', 'are']))):
                    meaningful_questions.append(user_q)
        
        # Return most recent meaningful questions
        return meaningful_questions[-limit:] if len(meaningful_questions) > limit else meaningful_questions
    
    def build_context(self, retrieved_docs: List[Dict]) -> str:
        """Build intelligent context string from retrieved documents"""
        if not retrieved_docs:
            return "No relevant documents found in the knowledge base."
        
        # Sort by relevance (lower distance = more relevant)
        sorted_docs = sorted(retrieved_docs, key=lambda x: x.get('distance', 1.0))
        
        # Only use highly relevant documents (distance < 0.8)
        relevant_docs = [doc for doc in sorted_docs if doc.get('distance', 1.0) < 0.8]
        
        if not relevant_docs:
            # If no highly relevant docs, use top 3 anyway
            relevant_docs = sorted_docs[:3]
        
        context_parts = []
        for i, doc in enumerate(relevant_docs[:5], 1):  # Limit to top 5
            content = doc.get('content', '').strip()
            metadata = doc.get('metadata', {})
            filename = metadata.get('filename', 'Unknown')
            
            # Clean and format content
            if content:
                context_parts.append(f"[Source {i} from {filename}]:\n{content}\n")
        
        return "\n---\n".join(context_parts)
    
    def _generate_redirect_response(self, current_query: str, meaningful_questions: List[str]) -> str:
        """Generate a playful redirect response to previous meaningful questions"""
        if not meaningful_questions:
            return "Haha, that's an interesting question! 😄 I'm actually here to help with **women's financial and health empowerment**. Want to chat about **financial planning**, **investing**, **budgeting**, **retirement planning**, or **wellness** instead?"
        
        # Generate a playful, friendly response
        response_parts = [
            "Haha, you got me there! 😄 That's a bit outside my wheelhouse.",
            "",
            "I'm focused on **women's financial and health empowerment**, so I might not be the best person to answer that!",
            "",
            "We were chatting about some great topics earlier though. Want to dive deeper into one of these?",
            ""
        ]
        
        for i, q in enumerate(meaningful_questions[-3:], 1):  # Show max 3 recent questions
            # Truncate long questions for better readability
            display_q = q[:100] + "..." if len(q) > 100 else q
            response_parts.append(f"**{i}.** \"{display_q}\"")
        
        response_parts.append("")
        response_parts.append("Or feel free to ask me anything about **financial planning**, **investing**, **health**, **wellness**, or **women's empowerment**!")
        
        return "\n".join(response_parts)
    
    def generate_follow_up_questions(self, query: str, retrieved_docs: List[Dict], 
                                    conversation_history: List[Dict] = None) -> Optional[str]:
        """Generate clarifying questions when query needs more context"""
        analysis = self.analyze_query_completeness(query, conversation_history)
        
        if not analysis["needs_clarification"]:
            return None
        
        # Use a simple prompt to generate clarifying questions
        prompt = f"""The user asked: "{query}"

The retrieved context might not be enough. Generate 1-2 specific, helpful clarifying questions to better understand their situation. 
Keep questions short, empathetic, and focused on gathering essential information.

Example format:
- "What is your current age range?" (if retirement planning)
- "What is your primary financial goal right now?" (if vague)

Generate questions now:"""
        
        try:
            response = self.model.generate_content(prompt)
            questions = response.text.strip() if hasattr(response, 'text') else None
            
            # Extract questions from response
            if questions and len(questions) > 10:
                return questions
        except Exception as e:
            logger.error(f"Error generating follow-up questions: {e}")
        
        return None
    
    def generate_response_stream(self, query: str, conversation_history: List[Dict] = None, 
                                 use_web_search: bool = False, web_search_results: str = "",
                                 user_metadata: Optional[Dict] = None) -> Generator[str, None, None]:
        """Generate streaming response using RAG"""
        # Check for sensitive content
        is_sensitive, sensitivity_type = self.detect_sensitive_content(query)
        
        if is_sensitive:
            escalation_responses = {
                "DANGER": "I'm concerned about your safety. **Please contact 911 immediately** or the National Suicide Prevention Lifeline at **988** for immediate help.",
                "ABUSE": "I want to make sure you get the support you need. Please contact the **National Domestic Violence Hotline at 1-800-799-7233** for confidential support and resources.",
                "SENSITIVE": "I understand this is an important concern. For comprehensive support with this financial situation, I recommend connecting with a **certified financial planner** or calling the **Consumer Financial Protection Bureau at 1-855-411-2372** for guidance."
            }
            response_text = escalation_responses.get(sensitivity_type, 
                "I want to make sure you get the best support. Please contact **911 for emergencies** or a professional counselor for assistance.")
            
            for char in response_text:
                yield char
            return
        
        # Preprocess query for better retrieval
        query_chunks = self.preprocess_query(query)
        main_query = query_chunks[0] if query_chunks else query
        
        # Retrieve relevant documents
        retrieved_docs = self.vector_store.search(main_query, n_results=7)
        
        # Check if query is contextual (relevant to knowledge base)
        is_contextual = self.is_query_contextual(retrieved_docs, threshold=0.85)
        
        # Check if this is the first message in the conversation
        is_first_message = (
            not conversation_history or 
            len(conversation_history) == 0 or
            (len(conversation_history) == 1 and conversation_history[0].get('role') == 'user')
        )
        
        # If query is not contextual, redirect to previous meaningful questions
        # BUT: Allow first message to proceed even if off-topic (user might be exploring)
        if not is_contextual and not is_first_message:
            meaningful_questions = self.extract_meaningful_questions(conversation_history, limit=3)
            
            if meaningful_questions:
                redirect_response = self._generate_redirect_response(query, meaningful_questions)
                for char in redirect_response:
                    yield char
                return
            else:
                # No previous questions, give a playful response anyway
                playful_response = "Haha, that's an interesting question! 😄 I'm actually here to help with women's financial and health empowerment. Want to chat about **financial planning**, **investing**, **budgeting**, or **wellness** instead?"
                for char in playful_response:
                    yield char
                return
        
        context = self.build_context(retrieved_docs)
        
        # Determine if web search is needed
        needs_web_search = len(retrieved_docs) == 0 or all(
            doc.get('distance', 1.0) > 0.75 for doc in retrieved_docs
        )
        
        # Build conversation history context
        history_context = ""
        if conversation_history:
            recent_history = conversation_history[-6:]  # Last 6 messages for better context
            history_context = "\n".join([
                f"{'User' if msg['role'] == 'user' else 'Assistant'}: {msg['content']}"
                for msg in recent_history
            ])
        
        # Build user context from metadata
        user_context = ""
        if user_metadata:
            user_parts = []
            if user_metadata.get('age'):
                user_parts.append(f"Age: {user_metadata['age']}")
            if user_metadata.get('income_range'):
                user_parts.append(f"Income Range: {user_metadata['income_range']}")
            if user_metadata.get('marital_status'):
                user_parts.append(f"Marital Status: {user_metadata['marital_status']}")
            if user_metadata.get('employment_status'):
                user_parts.append(f"Employment: {user_metadata['employment_status']}")
            if user_metadata.get('education'):
                user_parts.append(f"Education: {user_metadata['education']}")
            if user_parts:
                user_context = f"\n\nUser Profile:\n" + "\n".join(f"- {part}" for part in user_parts)
        
        web_search_info = ""
        if needs_web_search and web_search_results:
            web_search_info = f"\n\nAdditional Information from Web Search:\n{web_search_results}\n"
        elif needs_web_search and not web_search_results:
            web_search_info = "\n\nNote: The requested information is not fully available in the knowledge base. Provide a helpful answer based on your knowledge while indicating limitations.\n"
        
        # Build the enhanced prompt
        full_prompt = f"""{self.system_prompt}

Based on the following context from the knowledge base, please answer the user's question about women's finance.

Context from Knowledge Base:
{context}
{web_search_info}
{user_context}

Previous Conversation:
{history_context if history_context else "No previous conversation."}

User Question: {query}

Instructions:
- Provide a helpful, empathetic, and accurate answer
- Use proper markdown formatting with **bold** for emphasis
- Structure your response with clear paragraphs and bullet points
- If you need more information, ask 1-2 specific clarifying questions
- If information is not fully available, be honest and suggest next steps
- Format for readability with proper line breaks

Now provide your response:"""
        
        try:
            # Generate streaming response
            response = self.model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.7,
                    top_p=0.8,
                    top_k=40,
                ),
                stream=True
            )
            
            for chunk in response:
                if hasattr(chunk, 'text') and chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            logger.error(f"Error generating streaming response: {e}")
            error_msg = "I apologize, but I encountered an error while processing your question. Please try again or rephrase your question."
            for char in error_msg:
                yield char
    
    def generate_response(self, query: str, conversation_history: List[Dict] = None, 
                         use_web_search: bool = False, web_search_results: str = "",
                         user_metadata: Optional[Dict] = None) -> Dict:
        """Generate non-streaming response using RAG (for backwards compatibility)"""
        full_response = ""
        for chunk in self.generate_response_stream(query, conversation_history, use_web_search, web_search_results, user_metadata):
            full_response += chunk
        
        # Check for escalation in the response
        is_sensitive, sensitivity_type = self.detect_sensitive_content(query)
        
        # Retrieve docs for metadata
        query_chunks = self.preprocess_query(query)
        main_query = query_chunks[0] if query_chunks else query
        retrieved_docs = self.vector_store.search(main_query, n_results=5)
        needs_web_search = len(retrieved_docs) == 0 or all(
            doc.get('distance', 1.0) > 0.75 for doc in retrieved_docs
        )
        
        return {
            "response": full_response,
            "escalate": is_sensitive,
            "escalation_type": sensitivity_type if is_sensitive else None,
            "requires_web_search": needs_web_search and not web_search_results,
            "context_used": len(retrieved_docs) > 0
        }

