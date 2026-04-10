// Auth0 Configuration
// These should be set in environment variables or .env file
export const auth0Config = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || '',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || '',
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || '',
  // Use explicit redirect URI from env, or default to origin + /callback
  redirectUri: process.env.REACT_APP_AUTH0_REDIRECT_URI || (window.location.origin + '/callback'),
  // Use Google connection for social login
  connection: 'google-oauth2',
};

// FastAPI Backend URL
export const FASTAPI_URL = (() => {
  let url = process.env.REACT_APP_FASTAPI_URL;
  if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
    console.error('❌ REACT_APP_FASTAPI_URL is not set or is localhost!');
    console.error('⚠️ Set REACT_APP_FASTAPI_URL in Vercel environment variables to your ALB DNS');
    console.error('⚠️ Example: https://your-alb-dns-name.us-east-1.elb.amazonaws.com');
    // In production, don't default to localhost - this will cause errors
    if (process.env.NODE_ENV === 'production') {
      console.error('🚨 Production build detected but FASTAPI_URL is missing!');
      return '';
    }
    return 'http://localhost:8000'; // Only for local development
  }
  
  // Note: If frontend is HTTPS and backend is HTTP, browsers will block requests (mixed content)
  // This is a browser security feature. You'll need to set up HTTPS on ALB for this to work.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    console.error('❌ MIXED CONTENT ERROR: Frontend is HTTPS but backend is HTTP');
    console.error('⚠️ Browsers will block HTTP requests from HTTPS pages');
    console.error('⚠️ Solution: Set up HTTPS on your ALB (requires domain name)');
    console.error('⚠️ For now, this will fail. See ALB_HTTPS_SETUP.md for instructions');
  }
  
  return url;
})();

