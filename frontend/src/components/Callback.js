import React, { useEffect } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { useNavigate } from "react-router-dom";
import { FASTAPI_URL } from "../config/auth0";

function Callback() {
  const { user, isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    let isProcessing = false;
    
    async function handleCallback() {
      console.log("🔍 CALLBACK EFFECT TRIGGERED");
      console.log("📊 Current state:", {
        isLoading,
        isAuthenticated,
        hasUser: !!user,
        userEmail: user?.email,
        url: window.location.href,
        searchParams: window.location.search
      });
      
      if (isProcessing) {
        console.log("⏳ Already processing callback - skipping");
        return;
      }
      
      if (isLoading) {
        console.log("⏳ Auth0 still loading - waiting...");
        return;
      }

      isProcessing = true;
      console.log("🔄 Starting callback processing...");

      if (!isAuthenticated || !user) {
        console.error("❌ NOT AUTHENTICATED");
        console.error("📊 Auth0 state:", { 
          isAuthenticated, 
          isLoading, 
          hasUser: !!user,
          user: user,
          url: window.location.href
        });
        console.error("💡 Possible causes:");
        console.error("   - Auth0 callback failed");
        console.error("   - User cancelled authentication");
        console.error("   - Auth0 session expired");
        console.error("   - Callback URL mismatch");
        isProcessing = false;
        console.log("🔄 Redirecting to /login");
        window.location.href = "/login";
        return;
      }

      console.log("✅ USER AUTHENTICATED SUCCESSFULLY");
      console.log("👤 User info:", {
        email: user.email,
        name: user.name,
        sub: user.sub,
        picture: user.picture
      });

      try {
        console.log("📦 Reading registration data from sessionStorage...");
        const registrationDataStr = sessionStorage.getItem("registrationData");
        const isRegistration = sessionStorage.getItem("isRegistration") === "true";
        console.log("📦 Registration data:", {
          hasData: !!registrationDataStr,
          isRegistration,
          data: registrationDataStr ? "present" : "none"
        });
        let registrationData = null;

        if (registrationDataStr) {
          try {
            registrationData = JSON.parse(registrationDataStr);
          } catch (e) {
            console.error("Error parsing registration data:", e);
          }
        }

        const userInfo = {
          sub: user.sub,
          name: user.name || registrationData?.fullName || "User",
          email: user.email || registrationData?.email || "",
          picture: user.picture || null,
        };

        if (registrationData) {
          let age = null;
          if (registrationData.ageRange) {
            const rangeMatch = registrationData.ageRange.match(/(\d+)-(\d+)/);
            if (rangeMatch) {
              age = Math.floor((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
            } else if (registrationData.ageRange.includes("+")) {
              const numMatch = registrationData.ageRange.match(/(\d+)/);
              if (numMatch) {
                age = parseInt(numMatch[1]);
              }
            } else if (registrationData.ageRange === "Under 18") {
              age = 17;
            }
          }

          const maritalStatusMap = {
            "Single": "single",
            "Married": "married",
            "Divorced": "divorced",
            "Separated": "separated",
            "Widowed": "widowed",
          };

          const employmentStatusMap = {
            "Full-time": "employed",
            "Part-time": "employed",
            "Self-employed": "self_employed",
            "Homemaker": "homemaker",
            "Looking": "unemployed",
            "Student": "student",
          };

          Object.assign(userInfo, {
            phone: null,
            age: age,
            financial_goals: null,
            income_range: registrationData.incomeRange || null,
            employment_status: employmentStatusMap[registrationData.employment] || registrationData.employment || null,
            marital_status: maritalStatusMap[registrationData.maritalStatus] || registrationData.maritalStatus?.toLowerCase() || null,
            dependents: null,
            investment_experience: null,
            risk_tolerance: null,
            education: registrationData.education || null,
            location: registrationData.location || null,
            username: registrationData.username || null,
          });
        }

        if (!FASTAPI_URL || FASTAPI_URL.includes('localhost') || FASTAPI_URL === '') {
          console.error("❌ FASTAPI_URL is not set or is localhost!");
          console.error("⚠️ Current FASTAPI_URL:", FASTAPI_URL);
          console.error("⚠️ Set REACT_APP_FASTAPI_URL in Vercel environment variables");
          console.error("⚠️ Go to Vercel Dashboard → Your Project → Settings → Environment Variables");
          console.error("⚠️ Add: REACT_APP_FASTAPI_URL = http://your-alb-dns-name.us-east-2.elb.amazonaws.com");
          alert(`Configuration error: Backend URL not set.\n\nCurrent value: ${FASTAPI_URL || 'EMPTY'}\n\nPlease set REACT_APP_FASTAPI_URL in Vercel environment variables.\n\nThen redeploy your app.`);
          return;
        }
        
        console.log("✅ FASTAPI_URL is set:", FASTAPI_URL);
        console.log("📞 Redirecting to FastAPI:", `${FASTAPI_URL}/api/auth/callback`);
        console.log("📤 User info being sent:", userInfo);
        console.log("🔄 Using redirect workaround for HTTPS → HTTP");
        
        const userParams = new URLSearchParams({
          sub: userInfo.sub || '',
          name: userInfo.name || '',
          email: userInfo.email || '',
          picture: userInfo.picture || '',
          phone: userInfo.phone || '',
          age: userInfo.age || '',
          financial_goals: userInfo.financial_goals || '',
          income_range: userInfo.income_range || '',
          employment_status: userInfo.employment_status || '',
          marital_status: userInfo.marital_status || '',
          dependents: userInfo.dependents || '',
          investment_experience: userInfo.investment_experience || '',
          risk_tolerance: userInfo.risk_tolerance || '',
          education: userInfo.education || '',
          location: userInfo.location || '',
          username: userInfo.username || '',
          isRegistration: sessionStorage.getItem('isRegistration') || 'false'
        });
        
        if (sessionStorage.getItem('registrationData')) {
          sessionStorage.setItem('pendingRegistration', sessionStorage.getItem('registrationData'));
        }
        
        const redirectUrl = `${FASTAPI_URL}/api/auth/callback?${userParams.toString()}`;
        console.log("🔄 Redirecting to backend:", redirectUrl);
        window.location.replace(redirectUrl);

      } catch (error) {
        console.error("❌ Error in auth callback:", {
          message: error.message,
          stack: error.stack
        });
        alert(`Authentication error: ${error.message}\n\nCheck console for full logs.`);
        setTimeout(() => {
          window.location.href = FASTAPI_URL;
        }, 3000);
        return;
      }
    }

    handleCallback();
    
    return () => {
      isProcessing = false;
    };
  }, [user, isAuthenticated, isLoading, navigate]);
  
  useEffect(() => {
    const storedLogs = localStorage.getItem('callback_logs');
    if (storedLogs) {
      console.log("📋 PREVIOUS CALLBACK LOGS:");
      console.log(storedLogs);
    }
  }, []);

  return (
    <div className="login-container">
      <div className="login-form">
        <img src="/logo.png" alt="Logo" className="login-logo" />
        <h2>Creating Wings Co</h2>
        <p style={{ marginTop: "20px", textAlign: "center", color: "#666" }}>
          Setting up your account...
        </p>
      </div>
    </div>
  );
}

export default Callback;      console.log("🔄 Starting callback processing...");

      // Check authentication - Auth0 should be ready now
      if (!isAuthenticated || !user) {
        console.error("❌ NOT AUTHENTICATED");
        console.error("📊 Auth0 state:", { 
          isAuthenticated, 
          isLoading, 
          hasUser: !!user,
          user: user,
          url: window.location.href
        });
        console.error("💡 Possible causes:");
        console.error("   - Auth0 callback failed");
        console.error("   - User cancelled authentication");
        console.error("   - Auth0 session expired");
        console.error("   - Callback URL mismatch");
        isProcessing = false;
        // Use window.location instead of navigate to prevent React Router loops
        console.log("🔄 Redirecting to /login");
        window.location.href = "/login";
        return;
      }

      console.log("✅ USER AUTHENTICATED SUCCESSFULLY");
      console.log("👤 User info:", {
        email: user.email,
        name: user.name,
        sub: user.sub,
        picture: user.picture
      });

      try {

        // Read registration data from sessionStorage if available
        console.log("📦 Reading registration data from sessionStorage...");
        const registrationDataStr = sessionStorage.getItem("registrationData");
        const isRegistration = sessionStorage.getItem("isRegistration") === "true";
        console.log("📦 Registration data:", {
          hasData: !!registrationDataStr,
          isRegistration,
          data: registrationDataStr ? "present" : "none"
        });
        let registrationData = null;

        if (registrationDataStr) {
          try {
            registrationData = JSON.parse(registrationDataStr);
          } catch (e) {
            console.error("Error parsing registration data:", e);
          }
        }

        // Prepare user info with registration metadata
        const userInfo = {
          sub: user.sub,
          name: user.name || registrationData?.fullName || "User",
          email: user.email || registrationData?.email || "",
          picture: user.picture || null,
        };

        // Map registration fields to backend expected fields
        if (registrationData) {
          // Map ageRange to age (extract number from range like "26-35" -> 30)
          let age = null;
          if (registrationData.ageRange) {
            const rangeMatch = registrationData.ageRange.match(/(\d+)-(\d+)/);
            if (rangeMatch) {
              age = Math.floor((parseInt(rangeMatch[1]) + parseInt(rangeMatch[2])) / 2);
            } else if (registrationData.ageRange.includes("+")) {
              const numMatch = registrationData.ageRange.match(/(\d+)/);
              if (numMatch) {
                age = parseInt(numMatch[1]);
              }
            } else if (registrationData.ageRange === "Under 18") {
              age = 17;
            }
          }

          // Map marital status
          const maritalStatusMap = {
            "Single": "single",
            "Married": "married",
            "Divorced": "divorced",
            "Separated": "separated",
            "Widowed": "widowed",
          };

          // Map employment status
          const employmentStatusMap = {
            "Full-time": "employed",
            "Part-time": "employed",
            "Self-employed": "self_employed",
            "Homemaker": "homemaker",
            "Looking": "unemployed",
            "Student": "student",
          };

          Object.assign(userInfo, {
            phone: null, // Not collected in registration form
            age: age,
            financial_goals: null, // Not collected in registration form
            income_range: registrationData.incomeRange || null,
            employment_status: employmentStatusMap[registrationData.employment] || registrationData.employment || null,
            marital_status: maritalStatusMap[registrationData.maritalStatus] || registrationData.maritalStatus?.toLowerCase() || null,
            dependents: null, // Not collected in registration form
            investment_experience: null, // Not collected in registration form
            risk_tolerance: null, // Not collected in registration form
            education: registrationData.education || null,
            location: registrationData.location || null,
            username: registrationData.username || null,
          });
        }

        // Get access token if available
       // let token = null;
        //try {
          //token = await getAccessTokenSilently({
            //authorizationParams: {
              //audience: process.env.REACT_APP_AUTH0_AUDIENCE,
            //},
          //});
        } catch (e) {
          console.warn("Could not get access token:", e);
        }

        // Call FastAPI /api/auth/callback to register/update user
        if (!FASTAPI_URL || FASTAPI_URL.includes('localhost') || FASTAPI_URL === '') {
          console.error("❌ FASTAPI_URL is not set or is localhost!");
          console.error("⚠️ Current FASTAPI_URL:", FASTAPI_URL);
          console.error("⚠️ Set REACT_APP_FASTAPI_URL in Vercel environment variables");
          console.error("⚠️ Go to Vercel Dashboard → Your Project → Settings → Environment Variables");
          console.error("⚠️ Add: REACT_APP_FASTAPI_URL = http://your-alb-dns-name.us-east-2.elb.amazonaws.com");
          alert(`Configuration error: Backend URL not set.\n\nCurrent value: ${FASTAPI_URL || 'EMPTY'}\n\nPlease set REACT_APP_FASTAPI_URL in Vercel environment variables.\n\nThen redeploy your app.`);
          return;
        }
        
        console.log("✅ FASTAPI_URL is set:", FASTAPI_URL);
        console.log("📞 Redirecting to FastAPI:", `${FASTAPI_URL}/api/auth/callback`);
        console.log("📤 User info being sent:", userInfo);
        
        // WORKAROUND: HTTPS → HTTP mixed content blocks fetch()
        // Instead, redirect to backend with user data in URL
        // Backend will handle saving user and redirecting to chatbot
        
        console.log("🔄 Using redirect workaround for HTTPS → HTTP");
        console.log("🔄 Redirecting to backend with user data (HTTPS → HTTP workaround)");
        
        // Encode user info as URL params
        const userParams = new URLSearchParams({
          sub: userInfo.sub || '',
          name: userInfo.name || '',
          email: userInfo.email || '',
          picture: userInfo.picture || '',
          phone: userInfo.phone || '',
          age: userInfo.age || '',
          financial_goals: userInfo.financial_goals || '',
          income_range: userInfo.income_range || '',
          employment_status: userInfo.employment_status || '',
          marital_status: userInfo.marital_status || '',
          dependents: userInfo.dependents || '',
          investment_experience: userInfo.investment_experience || '',
          risk_tolerance: userInfo.risk_tolerance || '',
          education: userInfo.education || '',
          location: userInfo.location || '',
          username: userInfo.username || '',
          isRegistration: sessionStorage.getItem('isRegistration') || 'false'
        });
        
        // Store registration data in sessionStorage as backup
        if (sessionStorage.getItem('registrationData')) {
          sessionStorage.setItem('pendingRegistration', sessionStorage.getItem('registrationData'));
        }
        
        // Redirect to backend auth endpoint
        const redirectUrl = `${FASTAPI_URL}/api/auth/callback?${userParams.toString()}`;
        console.log("🔄 Redirecting to backend:", redirectUrl);
        window.location.replace(redirectUrl);
      } catch (error) {
        console.error("❌ Error in auth callback:", {
          message: error.message,
          stack: error.stack
        });
        alert(`Authentication error: ${error.message}\n\nCheck console for full logs.`);
        // Delay redirect so user can see error
        setTimeout(() => {
          window.location.href = FASTAPI_URL;
        }, 3000);
        return;
      }
    }

    handleCallback();
    
    // Cleanup function
    return () => {
      isProcessing = false;
    };
  }, [user, isAuthenticated, isLoading, getAccessTokenSilently, navigate]);
  
  // Display stored logs on component mount
  useEffect(() => {
    const storedLogs = localStorage.getItem('callback_logs');
    if (storedLogs) {
      console.log("📋 PREVIOUS CALLBACK LOGS:");
      console.log(storedLogs);
    }
  }, []);

  return (
    <div className="login-container">
      <div className="login-form">
        <img src="/logo.png" alt="Logo" className="login-logo" />
        <h2>Creating Wings Co</h2>
        <p style={{ marginTop: "20px", textAlign: "center", color: "#666" }}>
          Setting up your account...
        </p>
      </div>
    </div>
  );
}

export default Callback;

