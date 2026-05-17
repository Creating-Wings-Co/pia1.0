//This file is your Login page component. It shows a login screen with a Continue with Google button, 
// and when the user clicks it, the app sends them to Auth0 for login.



// src/components/Login.js
// shows the login screen
// has a "continue with google" button
// when clicked, redirects to Auth0 login page for Google login





import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import "./dummy1_login.css";

//creates and exports a React component called Login
export default function Login() {
  //can do this because App is wrapped around <Auth0Provider>
  const { loginWithRedirect, isLoading, error } = useAuth0(); // Get Auth0 functions

  
  //login button function 
  const handleLogin = async () => {
    try {
      await loginWithRedirect({
        authorizationParams: {
          connection: "google-oauth2",    //tells Auth0 to use Google login directly 
          prompt: "select_account", // This will prompt the user to select an account every time they log in
        },
    });
      } catch (err) {   //error handling for login failure
        console.error("loginWithRedirect failed:", err);
        alert(`Login failed: ${err.message}`);
      }
    };



  //loading page shows while Auth0 is initializing 
  if (isLoading) return <div>Loading...</div>;

  //error page shows if there is an error with Auth0
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
