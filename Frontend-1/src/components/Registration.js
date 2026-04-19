// Registration.js - User registration form component
// Displays a form for users to complete their profile after logging in with Google
// Collects additional info like location, marital status, income, education, employment
// Validates inputs and submits data to backend to create/update user profile
// If registration is successful, redirects user to chatbot page

import React, { Component } from "react";
import { Link } from "react-router-dom";
import { withAuth0 } from "@auth0/auth0-react";
import "./dummy2_register.css";
import termsText from "../assets/terms.txt";
import { validateTerms } from "../utils/validators";

const API_BASE = (
  process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

const CHATBOT_URL = (
  process.env.REACT_APP_CHATBOT_URL || "http://127.0.0.1:8000"
).replace(/\/$/, "");

// Registration component class definition
class Registration extends Component {
  constructor(props) {
    super(props);
    this.state = {
      email: "",
      fullName: "",
      is18OrOlder: false,
      location: "",
      maritalStatus: "",
      incomeRange: "",
      education: "",
      employment: "",
      acceptTerms: false,
      showTerms: false,
      termsContent: "",
      ageError: "",
      locationError: "",
      passwordError: "",
      termsError: "",
    };
  }

  // When the component mounts, check if user is authenticated and load terms text
  async componentDidMount() {
    const { user, isAuthenticated } = this.props.auth0;
    if (!isAuthenticated || !user) {
      window.location.href = "/login";
      return;
    }

    // Pre-fill email and full name from Auth0 user info, but allow user to edit them in case they want to use different values for registration than what they have in Auth0 profile
    this.setState({
      email: user.email || "",
      fullName: user.name || "",
    });

    // Load terms and conditions text from local file and store in state to display in modal
    try {
      const text = await fetch(termsText).then((res) => res.text());
      this.setState({ termsContent: text });
    } catch (err) {
      console.error("Failed to load terms text:", err);
    }
  }

  handleChange = (e) => this.setState({ [e.target.name]: e.target.value });
  handleCheckbox = (e) => this.setState({ acceptTerms: e.target.checked });
  handleAgeCheckbox = (e) => this.setState({ is18OrOlder: e.target.checked });

  // When the registration form is submitted, validate inputs and submit data to backend to create/update user profile
  handleRegister = async (e) => {
    e.preventDefault();

    const {
      email,
      fullName,
      is18OrOlder,
      location,
      maritalStatus,
      incomeRange,
      education,
      employment,
      acceptTerms,
    } = this.state;
  
    // Clear previous error messages
    this.setState({
      passwordError: "",
      termsError: "",
      ageError: "",
      locationError: "",
    });


//VALIDATION LOGIC
    // Validate that user is 18 or older
    if (!is18OrOlder) {
      this.setState({ ageError: "You must be 18 or older to register." });
      return;
    }
    // Validate that user has accepted terms and conditions
    const termsError = validateTerms(acceptTerms);
    if (termsError) {
      this.setState({ termsError });
      return;
    }
    // Validate location format (e.g. "City, State")
    const locationPattern = /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/;
    if (!locationPattern.test(location.trim())) {
      this.setState({ locationError: "Use format: City, State" });
      return;
    }

// GET incomeMap, educationMap, and employmentMap to convert frontend values to backend values before sending to API
    const incomeMap = {
      "0-9999": "$0-$9,999",
      "10000-24999": "$10,000-$24,999",
      "25000-49000": "$25,000-$49,999",
      "50000-74999": "$50,000-$74,999",
      "75000-99999": "$75,000-$99,999",
      "100000-149999": "$100,000-$149,999",
      "150000+": "$150,000+",
    };

    const educationMap = {
      "Less than High School": "Less than High School",
      "High School Diploma": "High School Diploma",
      "Some College": "Some College, No Degree",
      "Associate Degree": "Associate Degree",
      Bachelors: "Bachelor's Degree",
      Masters: "Master's Degree",
      Doctoral: "Doctoral/Professional Degree",
    };

    const employmentMap = {
      "Full-time": "Employed full-time",
      "Part-time": "Employed part-time",
      "Self-employed": "Self-employed",
      Homemaker: "Homemaker",
      Looking: "Looking for work",
      Student: "Student",
    };

    // If all validations pass, proceed to submit registration data to backend API
    try {
      const { user, getAccessTokenSilently } = this.props.auth0;
      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE}/api/auth/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sub: user.sub,
          name: fullName,
          email,
          location,
          marital_status: maritalStatus || null,
          income_range: incomeRange ? incomeMap[incomeRange] || null : null,
          education: education ? educationMap[education] || null : null,
          employment_status: employment ? employmentMap[employment] || null : null,
          acceptedTerms: acceptTerms,
          is18OrOlder,
        }),
      });

      // If the registration request fails, throw an error to be caught below
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Registration failed:", response.status, errorText);
        throw new Error("Registration failed");
      }

      // If registration is successful, store the token and user ID in localStorage and redirect to chatbot page
      const data = await response.json();
      localStorage.setItem("authToken", token);
      localStorage.setItem("userId", String(data.user_id));
      window.location.href = `${CHATBOT_URL}/?userId=${encodeURIComponent(data.user_id)}`;
    } catch (err) {
      console.error(err);
      this.setState({
        passwordError: "Something went wrong. Please try again.",
      });
    }
  };


  // Opens the terms and conditions modal and prevents background scrolling
  openTerms = () => {
    this.setState({ showTerms: true });
    document.body.style.overflow = "hidden";
  };

  // Closes the terms and conditions modal and restores background scrolling
  closeTerms = () => {
    this.setState({ showTerms: false });
    document.body.style.overflow = "auto";
  };

  // When user clicks "I Agree" in the terms modal, set acceptTerms to true, close the modal, and restore background scrolling
  agreeAndClose = () => {
    this.setState({ acceptTerms: true, showTerms: false });
    document.body.style.overflow = "auto";
  };


  // UI layout of the registration form with fields for 
  // location, marital status, income, education, employment, and checkboxes for terms and age confirmation. 
  render() {
    const { showTerms, termsContent } = this.state;

    return (
      <>
        <div className={`register-container ${showTerms ? "blurred" : ""}`}>
          <div className="register-form">
            <img src="/logo.png" alt="Logo" className="register-logo" />
            <h2>Profile</h2>

            <form onSubmit={this.handleRegister}>
              <label className="field-label">
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={this.state.email}
                onChange={this.handleChange}
                readOnly
                className="input-locked"
              />
              {this.state.passwordError && (
                <div className="inline-error">{this.state.passwordError}</div>
              )}
              {this.state.termsError && (
                <div className="inline-error">{this.state.termsError}</div>
              )}

              <label className="field-label">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={this.state.fullName}
                onChange={this.handleChange}
                readOnly
                className="input-locked"
              />

              <label className="field-label">
                Location <span className="required">*</span>
              </label>
              <input
                type="text"
                name="location"
                required
                placeholder="City, State"
                pattern="^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$"
                title="Use format: City, State"
                value={this.state.location}
                onChange={this.handleChange}
              />
              {this.state.locationError && (
                <div className="inline-error">{this.state.locationError}</div>
              )}

              <label className="field-label">Marital Status</label>
              <select
                name="maritalStatus"
                value={this.state.maritalStatus}
                onChange={this.handleChange}
              >
                <option value="">- Select Option -</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Separated">Separated</option>
                <option value="Widowed">Widowed</option>
              </select>

              <label className="field-label">Household Income Range</label>
              <select
                name="incomeRange"
                value={this.state.incomeRange}
                onChange={this.handleChange}
              >
                <option value="">- Select Option -</option>
                <option value="0-9999">$0-$9,999</option>
                <option value="10000-24999">$10,000-$24,999</option>
                <option value="25000-49000">$25,000-$49,000</option>
                <option value="50000-74999">$50,000-$74,999</option>
                <option value="75000-99999">$75,000-$99,999</option>
                <option value="100000-149999">$100,000-$149,999</option>
                <option value="150000+">$150,000+</option>
              </select>

              <label className="field-label">Education Level</label>
              <select
                name="education"
                value={this.state.education}
                onChange={this.handleChange}
              >
                <option value="">- Select Option -</option>
                <option value="Less than High School">Less than High School</option>
                <option value="High School Diploma">High School Diploma</option>
                <option value="Some College">Some College, No Degree</option>
                <option value="Associate Degree">Associate Degree</option>
                <option value="Bachelors">Bachelor's Degree</option>
                <option value="Masters">Master's Degree</option>
                <option value="Doctoral">Doctoral / Professional Degree</option>
              </select>

              <label className="field-label">Employment Status</label>
              <select
                name="employment"
                value={this.state.employment}
                onChange={this.handleChange}
              >
                <option value="">- Select Option -</option>
                <option value="Full-time">Employed full-time</option>
                <option value="Part-time">Employed part-time</option>
                <option value="Self-employed">Self-employed</option>
                <option value="Homemaker">Homemaker</option>
                <option value="Looking">Looking for work / Starting business</option>
                <option value="Student">Student</option>
              </select>

              <div className="checkbox-row">
                <input
                  type="checkbox"
                  checked={this.state.acceptTerms}
                  onChange={this.handleCheckbox}
                />
                <label>
                  I accept the{" "}
                  <span className="tnc-link" onClick={this.openTerms}>
                    Terms & Conditions
                  </span>
                  <span className="required">*</span>
                </label>
              </div>

              <div className="checkbox-row">
                <input
                  type="checkbox"
                  checked={this.state.is18OrOlder}
                  onChange={this.handleAgeCheckbox}
                />
                <label>
                  I confirm I am 18 or older <span className="required">*</span>
                </label>
              </div>
              {this.state.ageError && (
                <div className="inline-error">{this.state.ageError}</div>
              )}

              <button type="submit">Register</button>
            </form>

            <div className="link-text">
              Already have an account? <Link to="/">Login here</Link>
            </div>
          </div>
        </div>

        {showTerms && (
          <div className="modal-overlay">
            <div className="modal-box">
              <h3>Terms & Conditions</h3>
              <div className="modal-content">
                <pre className="terms-text">{termsContent}</pre>
              </div>
              <div className="modal-buttons">
                <button className="agree-btn" onClick={this.agreeAndClose}>
                  I Agree
                </button>
                <button className="close-btn" onClick={this.closeTerms}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
}

export default withAuth0(Registration);

