//wrapper for index.js to provide Auth0 context to the entire app

import React from "react";
import ReactDOM from "react-dom/client";
import { Auth0Provider } from "@auth0/auth0-react";
import "./index.css";
import App from "./App";
import reportWebVitals from "./reportWebVitals";  //comes with create-react-app

// Finds the root element in the HTML and creates a React root
const root = ReactDOM.createRoot(document.getElementById("root"));

const auth0RedirectUri =
  process.env.REACT_APP_AUTH0_REDIRECT_URI ||
  `${window.location.origin}/post-login`;

// Renders the App component inside strict mode 
// wrapped in Auth0Provider so the entire app can access Auth0 features and context
//includes domain, clientId, and authorizationParams for Auth0 configuration
root.render(
  <React.StrictMode>
    <Auth0Provider
      domain={process.env.REACT_APP_AUTH0_DOMAIN}   
      clientId={process.env.REACT_APP_AUTH0_CLIENT_ID}
      authorizationParams={{
        redirect_uri: auth0RedirectUri,
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
      }}
      cacheLocation="localstorage"  // persist tokens in localStorage to survive page refreshes
      //useRefreshTokens // user stay logged in longer without needing to re-authenticate
    >
      <App />    
    </Auth0Provider>
  </React.StrictMode>
);

//closes render tree
reportWebVitals();

