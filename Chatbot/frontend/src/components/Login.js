import React from "react";
//import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";

import "./dummy1_login.css";

function Login() {
    const { loginWithRedirect } = useAuth0();
    //const { loginWithRedirect, isAuthenticated, isLoading } = useAuth0();
    //const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const isRegistration = searchParams.get("registration") === "true";

    const handleGoogleLogin = () => {
        loginWithRedirect({
            authorizationParams: {
                connection: "google-oauth2",
                screen_hint: isRegistration ? "signup" : "login",
            },
            appState: {
                returnTo: window.location.origin + "/callback",
            },
        }).catch((error) => {
            console.error("Auth0 login error:", error);
        });
    };

    // Don't auto-redirect - let user click the button
    // If already authenticated and coming from registration, allow callback
    // Otherwise, show login page normally

    return (
        <div className="login-container">
            <div className="login-form">
                <img src="/logo.png" alt="Logo" className="login-logo" />
                <h2>{isRegistration ? "Complete Registration" : "Welcome Back"}</h2>

                {isRegistration && (
                    <p style={{ marginBottom: "20px", color: "#666", fontSize: "14px" }}>
                        Sign in with Google to complete your registration.
                    </p>
                )}

                {/* Google Login Button */}
                <button
                    className="google-login-button"
                    onClick={handleGoogleLogin}
                    style={{ marginTop: isRegistration ? "0" : "20px" }}
                >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="google-icon">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                    Continue with Google
                </button>

                <div className="link-text">
                    {isRegistration ? (
                        <>
                            Already have an account? <Link to="/login">Login here</Link>
                        </>
                    ) : (
                        <>
                            New user? <Link to="/register">Click here to register</Link>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Login;
