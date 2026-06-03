
// src/components/PostLogin.js
// Responsible for handling the post-login logic after the user has authenticated with Auth0.

//User is already back from Auth0
//↓
//PostLogin.js checks if Auth0 is loaded
//↓
//PostLogin.js checks if user is authenticated
//↓
//It gets the Auth0 access token
//↓
//It sends that token to your backend
//↓
//Backend verifies the token
//↓
//Backend sends back a status/response
//↓
//Frontend decides where to send the user next

import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { getAuth0AccessToken } from "../utils/authApi";

// this where your frontend sends API requests
const API_BASE = process.env.REACT_APP_API_BASE_URL;
// this is where your chatbot is hosted
const CHATBOT_URL = process.env.REACT_APP_CHATBOT_URL;

// PostLogin component that runs after user logs in
export default function PostLogin() {
  const { isAuthenticated, isLoading, getAccessTokenSilently, logout } = useAuth0();
  const navigate = useNavigate();

  // Main logic runs when component mounts or when Auth0 state changes
  useEffect(() => {
    // Define an async function to handle the post-login logic
    const run = async () => {
        // If Auth0 is still loading, do nothing 
      if (isLoading) return;

        // If user is not authenticated, redirect to login page
      if (!isAuthenticated) {
        navigate("/login");
        return;
      }

      // If user is authenticated, get access token and sync with backend,
      //  then check if user needs to complete registration or can go straight to chatbot
      try {
        const token = await getAuth0AccessToken(getAccessTokenSilently);
        
        //Used to prove to your backend that the user is actually logged in.
        //stores Auth0 access token in browser (local storage) until you remove it
        localStorage.setItem("authToken", token);       //******************COULD BE A SECURITY RISK ************************* */

        // sends request to backend
        // backend verifies token if user is authenticated 
        const profileRes = await fetch(`${API_BASE}/api/user/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        // If the profile request returns 404, it means the user does not exist in our database yet, so we redirect to registration page    **********IMPORANT LOGIC FOR DECIDING WHETHER TO SEND USER TO REGISTRATION PAGE OR STRAIGHT TO CHATBOT******************
        if (profileRes.status === 404) {
          navigate("/register");
          return;
        }

        // If the profile request fails with any other error, throw an error to be caught below
        if (!profileRes.ok) {
          const errorText = await profileRes.text();
          throw new Error(`Profile fetch failed: ${profileRes.status} ${errorText}`);
        }

        // If profile fetch is successful, parse the profile data
        const profile = await profileRes.json();
        localStorage.setItem("userId", String(profile.user_id));                                       //COULD BE SECURITY RISK
        window.location.href = `${CHATBOT_URL}/?userId=${encodeURIComponent(profile.user_id)}`;
      } catch (err) {
        console.error("Post-login failed:", err);
        logout({ logoutParams: { returnTo: window.location.origin } });
      }
    };
    // Call the async function to execute the post-login logic
    run();
  }, [isAuthenticated, isLoading, getAccessTokenSilently, navigate, logout]);

  return <div>Signing you in...</div>;
}
