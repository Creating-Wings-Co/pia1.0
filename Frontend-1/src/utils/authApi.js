const AUTH0_AUDIENCE = process.env.REACT_APP_AUTH0_AUDIENCE;

export async function getAuth0AccessToken(getAccessTokenSilently) {
  const options = AUTH0_AUDIENCE
    ? { authorizationParams: { audience: AUTH0_AUDIENCE } }
    : {};
  return getAccessTokenSilently(options);
}

export function getApiConfigError(apiBase, chatbotUrl) {
  if (!apiBase) {
    return "Server URL is not configured. Set REACT_APP_API_BASE_URL on Vercel.";
  }
  if (!chatbotUrl) {
    return "Chat URL is not configured. Set REACT_APP_CHATBOT_URL on Vercel.";
  }
  return null;
}

export function formatApiError(status, errorText) {
  if (!status) {
    return "Cannot reach the server. Check REACT_APP_API_BASE_URL and that the EC2 API is running.";
  }
  try {
    const json = JSON.parse(errorText);
    const { detail } = json;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((item) => item.msg || JSON.stringify(item)).join("; ");
    }
  } catch {
    // not JSON
  }
  if (status === 401) {
    return "Authentication failed. Ensure REACT_APP_AUTH0_AUDIENCE matches EC2 AUTH0_AUDIENCE.";
  }
  if (status === 500) {
    return "Server could not save your profile (database or server error).";
  }
  return errorText?.slice(0, 200) || `Request failed (${status})`;
}

export function formatClientError(err) {
  const message = err?.message || String(err);
  if (message.includes("Missing Refresh Token") || message.includes("login_required")) {
    return "Session expired. Please log out and sign in again.";
  }
  if (message.includes("consent_required")) {
    return "Auth0 consent required. In Auth0, authorize your SPA to access your API.";
  }
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return "Network error — cannot reach the API. Check REACT_APP_API_BASE_URL.";
  }
  return message;
}
