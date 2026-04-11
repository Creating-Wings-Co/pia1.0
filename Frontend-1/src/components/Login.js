//shows the login screen
//has a "continue with google" button
//when clicked, redirects to Auth0 login page for Google login

import { Component } from "react";
import "./dummy1_login.css";
import { withRouter } from "./withRouter";

//gets backend URL from environment variable
const AUTH_BASE = process.env.REACT_APP_AUTH_BACKEND_URL;


//when button is clicked, redirect to AUTH_BACKEND/auth/login?...params
const loginWithGoogle = () => {
  window.location.assign(
    `${AUTH_BASE}/auth/login?connection=google-oauth2&returnTo=${encodeURIComponent("/post-login")}&prompt=consent`
  );
};

class Login extends Component {
  render() {
    return (
      <div className="login-container">
        <div className="login-form">
          <img src="/logo.png" alt="Logo" className="login-logo" />
          <h2>Login</h2>

          <button className="google-login-button" onClick={loginWithGoogle}>
            <img src="/Google_logo.svn.png" alt="Google" className="google-icon" />
            <span>Continue with Google</span>
          </button>
        </div>
      </div>
    );
  }
}

export default withRouter(Login);
