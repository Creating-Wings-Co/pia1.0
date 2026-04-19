// src/App.js
// Main application component that sets up routing for the app
// Connects route to pages

import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Login from "./components/Login";
import Registration from "./components/Registration";
import PostLogin from "./components/PostLogin";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Registration />} />
        <Route path="/post-login" element={<PostLogin />} />
      </Routes>
    </Router>
  );
}

export default App;
