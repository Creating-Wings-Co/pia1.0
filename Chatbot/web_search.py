import requests
from bs4 import BeautifulSoup
from typing import List, Dict
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WebSearchService:
    """Service for real-time web search when information is not in database"""
    
    def __init__(self):
        self.search_url = "https://www.google.com/search"
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    
    def search(self, query: str, num_results: int = 5) -> List[Dict]:
        """Perform web search and extract relevant snippets"""
        try:
            params = {
                'q': query,
                'num': num_results
            }
            
            response = requests.get(
                self.search_url,
                params=params,
                headers=self.headers,
                timeout=10
            )
            
            if response.status_code == 200:
                soup = BeautifulSoup(response.text, 'html.parser')
                results = []
                
                # Extract search results
                search_results = soup.find_all('div', class_='g')[:num_results]
                
                for result in search_results:
                    title_elem = result.find('h3')
                    link_elem = result.find('a')
                    snippet_elem = result.find('span', class_='aCOpRe') or result.find('div', class_='VwiC3b')
                    
                    if title_elem and link_elem:
                        title = title_elem.get_text()
                        link = link_elem.get('href', '')
                        snippet = snippet_elem.get_text() if snippet_elem else ''
                        
                        results.append({
                            'title': title,
                            'url': link,
                            'snippet': snippet
                        })
                
                logger.info(f"Found {len(results)} web search results")
                return results
            else:
                logger.warning(f"Web search returned status code: {response.status_code}")
                return []
                
        except Exception as e:
            logger.error(f"Error performing web search: {e}")
            return []
    
    def format_search_results(self, results: List[Dict]) -> str:
        """Format search results into a readable string"""
        if not results:
            return "No additional information found."
        
        formatted = "Here's some additional information from web search:\n\n"
        for i, result in enumerate(results, 1):
            formatted += f"{i}. {result['title']}\n"
            formatted += f"   {result['url']}\n"
            formatted += f"   {result['snippet']}\n\n"
        
        return formatted

