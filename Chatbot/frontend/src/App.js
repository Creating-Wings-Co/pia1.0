import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import Login from "./components/Login";
import Registration from "./components/Registration";
import Callback from "./components/Callback";
import { auth0Config } from "./config/auth0";

function App() {
  // Check if config is loaded
  if (!auth0Config.domain || !auth0Config.clientId) {
    console.error("Auth0 configuration missing! Check your .env file.");
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h2>Configuration Error</h2>
        <p>Auth0 configuration is missing. Please check your .env file.</p>
        <p>Required: REACT_APP_AUTH0_DOMAIN, REACT_APP_AUTH0_CLIENT_ID</p>
      </div>
    );
  }

  // Use explicit redirect URI from env or default to origin + /callback
  // Remove any trailing slashes to avoid mismatch
  let redirectUri = auth0Config.redirectUri || window.location.origin + "/callback";
  redirectUri = redirectUri.replace(/\/$/, ''); // Remove trailing slash if present

  return (
    <Auth0Provider
      domain={auth0Config.domain}
      clientId={auth0Config.clientId}
      authorizationParams={{
        redirect_uri: redirectUri,
        audience: auth0Config.audience,
        connection: "google-oauth2", // Force Google connection
      }}
      useRefreshTokens={true}
      cacheLocation="localstorage"
    >
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/login" element={<Navigate to="/login" replace />} />
          <Route path="/register" element={<Registration />} />
          <Route path="/callback" element={<Callback />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Auth0Provider>
  );
}

export default App;
