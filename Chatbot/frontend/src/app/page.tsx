"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import LoginButton from "@/components/LoginButton";
import { useEffect, useRef } from "react";

export default function Home() {
  const { user, isLoading } = useUser();
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Prevent multiple redirects
    if (hasRedirected.current) return;
    
    // Check if we've already tried redirecting (prevent loops)
    const redirectAttempted = sessionStorage.getItem('redirectAttempted');
    const redirectTime = redirectAttempted ? parseInt(redirectAttempted) : 0;
    const now = Date.now();
    
    // If redirect was attempted less than 10 seconds ago, skip (prevent loop)
    if (redirectAttempted && (now - redirectTime) < 10000) {
      console.log("Redirect already attempted recently, skipping to prevent loop");
      return;
    }
    
    // Only redirect if user is logged in and we're on the Next.js home page
    // Don't redirect if we're already being redirected (check URL)
    const currentPath = window.location.pathname;
    if (currentPath !== '/' && currentPath !== '') {
      console.log("Not on home page, skipping redirect");
      return;
    }
    
    if (user && !isLoading) {
      hasRedirected.current = true;
      sessionStorage.setItem('redirectAttempted', now.toString());
      
      console.log("User logged in, redirecting to FastAPI via auth-callback...");
      
      // Small delay to ensure session is fully established
      setTimeout(() => {
        // Redirect to auth-callback route which will handle token and redirect to FastAPI
        window.location.replace(`/api/auth-callback`); // Use replace instead of href to prevent back button issues
      }, 300);
    }
  }, [user, isLoading]);

  if (isLoading || user) {
    return (
      <div className="app-container">
        <div className="main-card-wrapper">
          <h1 className="main-title">Creating Wings Co</h1>
          <div className="action-card">
            <p className="action-text">
              {user ? "Redirecting to your assistant..." : "Loading..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="main-card-wrapper">
        <h1 className="main-title">Creating Wings Co</h1>
        <div className="action-card">
          <p className="action-text">
            Welcome! Please log in to access your personalized assistant.
          </p>
          <LoginButton />
        </div>
      </div>
    </div>
  );
}