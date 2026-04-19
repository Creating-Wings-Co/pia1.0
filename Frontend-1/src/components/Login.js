//RIGHT NOW THIS IS IMPLEMNETED WHERE IF I RESET FRONTEND WHILE IN REGISTRATION PAGE, IT STAYS IN REGISTRATION PAGE WITHOUT GOING BACK TO LOGIN PAGE.


// src/components/Login.js
// shows the login screen
// has a "continue with google" button
// when clicked, redirects to Auth0 login page for Google login


import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "./dummy1_login.css";

export default function Login() {
  const { loginWithRedirect, isLoading, error } = useAuth0();

  const handleLogin = async () => {
    try {
      await loginWithRedirect({
        authorizationParams: {
          connection: "google-oauth2",                //KEEP commented for now - this is supposed to trigger the Google login screen, but it seems to be ignored by Auth0 for some reason. We can set up Google as the default connection in Auth0 dashboard instead
          prompt: "select_account", // This will prompt the user to select an account every time they log in, even if they are already authenticated. This is useful for testing the login flow repeatedly without having to log out from Auth0 or clear cookies. You can change this to "consent" or remove it entirely in production.
        },
      });
    } catch (err) {
      console.error("loginWithRedirect failed:", err);
      alert(`Login failed: ${err.message}`);
    }
  };

  if (isLoading) return <div>Loading...</div>;

  if (error) {
    return <div>Auth0 error: {error.message}</div>;
  }

  return (
    <div className="login-container">
      <div className="login-form">
        <img src="/logo.png" alt="Logo" className="login-logo" />
        <h2>Login</h2>
        <button
          type="button"
          className="google-login-button"
          onClick={handleLogin}
        >
          <img src="/Google_logo.svn.png" alt="Google" className="google-icon" />
          <span>Continue with Google</span>
        </button>
      </div>
    </div>
  );
}
