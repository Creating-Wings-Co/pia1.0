"""
Auth0 token verification utilities for FastAPI
"""
import jwt
from jwt.exceptions import InvalidTokenError, ExpiredSignatureError, InvalidAudienceError, InvalidIssuerError
import requests
from typing import Optional, Dict
from fastapi import HTTPException, status
from functools import lru_cache
import logging
import json

from config import Config

logger = logging.getLogger(__name__)

# Cache JWKS (JSON Web Key Set) for 1 hour
@lru_cache(maxsize=1)
def get_jwks():
    """Fetch Auth0's public keys for token verification"""
    jwks_url = f"https://{Config.AUTH0_DOMAIN}/.well-known/jwks.json"
    try:
        response = requests.get(jwks_url, timeout=10)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        logger.error(f"Error fetching JWKS: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to verify authentication"
        )

def get_rsa_key(token: str) -> Dict:
    """Get the RSA key from JWKS that matches the token"""
    jwks = get_jwks()
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        logger.error(f"Error decoding token header: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token format"
        )
    
    rsa_key = {}
    for key in jwks["keys"]:
        if key["kid"] == unverified_header["kid"]:
            rsa_key = {
                "kty": key["kty"],
                "kid": key["kid"],
                "use": key["use"],
                "n": key["n"],
                "e": key["e"]
            }
            break
    
    if not rsa_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unable to find appropriate key"
        )
    
    return rsa_key

def verify_token(token: str) -> Optional[Dict]:
    """
    Verify Auth0 JWT token and return user info
    
    Args:
        token: JWT token from Auth0
        
    Returns:
        Decoded token payload (user info)
        
    Raises:
        HTTPException if token is invalid
    """
    try:
        # Remove 'Bearer ' prefix if present
        if token.startswith("Bearer "):
            token = token[7:]
        
        # Get RSA key
        rsa_key = get_rsa_key(token)
        
        # Construct public key from JWK
        # PyJWT 2.x uses cryptography library directly
        from cryptography.hazmat.primitives.asymmetric import rsa
        from cryptography.hazmat.backends import default_backend
        import base64
        
        # Decode base64url-encoded values
        def base64url_decode(value):
            # Add padding if needed
            padding = 4 - len(value) % 4
            if padding != 4:
                value += '=' * padding
            return base64.urlsafe_b64decode(value)
        
        n_bytes = base64url_decode(rsa_key['n'])
        e_bytes = base64url_decode(rsa_key['e'])
        
        # Convert to integers
        n = int.from_bytes(n_bytes, 'big')
        e = int.from_bytes(e_bytes, 'big')
        
        # Create RSA public key
        public_key = rsa.RSAPublicNumbers(e, n).public_key(default_backend())
        
        # Verify and decode token
        issuer = f"https://{Config.AUTH0_DOMAIN}/"
        payload = jwt.decode(
            token,
            public_key,
            algorithms=["RS256"],
            audience=Config.AUTH0_AUDIENCE,
            issuer=issuer,
            options={"verify_signature": True}
        )
        
        return payload
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except (InvalidAudienceError, InvalidIssuerError) as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token claims: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def get_current_user(token: Optional[str] = None) -> Dict:
    """
    Extract and verify user from Authorization header
    
    This will be used as a dependency in FastAPI routes
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    payload = verify_token(token)
    return payload

