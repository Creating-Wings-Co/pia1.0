import React, { Component } from "react";
import { Link } from "react-router-dom";
import { validateTerms } from "../utils/validators";


import "./dummy2_register.css";

// Terms text will be fetched from public folder

class Registration extends Component {
  constructor(props) {
    super(props);

    this.state = {
      email: "",
      reEmail: "",
      username: "",
      fullName: "",
      ageRange: "",
      location: "",
      maritalStatus: "",
      incomeRange: "",
      education: "",
      employment: "",
      acceptTerms: false,
      showTerms: false,
      termsContent: "",
      termsError: "",
    };
  }
  

  handleChange = (e) => {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  };

  handleCheckbox = (e) => {
    this.setState({ acceptTerms: e.target.checked });
  };

handleRegister = async (e) => {
  e.preventDefault(); 

  const {
    email,
    username,
    fullName,
    ageRange,
    location,
    maritalStatus,
    incomeRange,
    education,
    employment,
    acceptTerms,
  } = this.state;

  // Reset previous errors
  this.setState({ termsError: "" });

  // Validate terms
  const termsError = validateTerms(acceptTerms);
  if (termsError) {
    this.setState({ termsError });
    return;
  }

  // Store registration data in sessionStorage before Auth0 redirect
  const registrationData = {
    email,
    username,
    fullName,
    ageRange,
    location,
    maritalStatus,
    incomeRange,
    education,
    employment,
  };

  sessionStorage.setItem("registrationData", JSON.stringify(registrationData));
  sessionStorage.setItem("isRegistration", "true");

  // Redirect to Auth0 login (Google OAuth)
  window.location.href = "/login?registration=true";
};



  componentDidMount() {
    // Fetch terms from public folder
    fetch('/terms.txt')
      .then((res) => res.text())
      .then((text) => this.setState({ termsContent: text }))
      .catch((error) => {
        console.error('Error loading terms:', error);
        // Set default terms if file not found
        this.setState({ termsContent: 'Terms and Conditions: By using this service, you agree to our terms.' });
      });
  }

  openTerms = () => {
    this.setState({ showTerms: true });
    document.body.style.overflow = "hidden";
  };

  closeTerms = () => {
    this.setState({ showTerms: false });
    document.body.style.overflow = "auto";
  };

  agreeAndClose = () => {
    this.setState({ acceptTerms: true, showTerms: false });
    document.body.style.overflow = "auto";
  };

  render() {
    const { showTerms, termsContent } = this.state;

    return (
      <>
        <div className={`register-container ${showTerms ? "blurred" : ""}`}>
          <div className="register-form">
            <img src="/logo.png" alt="Logo" className="register-logo" />
            <h2>Registration</h2>

            <form onSubmit={this.handleRegister}>
              {/* Email */}
              <label className="field-label">
                Email <span className="required">*</span>
              </label>
              <input
                type="email"
                name="email"
                required
                value={this.state.email}
                onChange={this.handleChange}
              />

              {/* Username */}
              <label className="field-label">
                Username <span className="required">*</span>
              </label>
              <input
                type="text"
                name="username"
                required
                value={this.state.username}
                onChange={this.handleChange}
              />

              {this.state.termsError && (
                <div className="inline-error">{this.state.termsError}</div>
              )}


              {/* Full Name */}
              <label className="field-label">Full Name</label>
              <input
                type="text"
                name="fullName"
                value={this.state.fullName}
                onChange={this.handleChange}
              />

              {/* Age Range */}
              <label className="field-label">
                Age Range <span className="required">*</span>
              </label>
              <select
                name="ageRange"
                required
                value={this.state.ageRange}
                onChange={this.handleChange}
              >
                <option value="Under 18">Under 18</option>
                <option value="18-25">18–25</option>
                <option value="26-35">26–35</option>
                <option value="36-45">36–45</option>
                <option value="46-55">46–55</option>
                <option value="56+">56+</option>
              </select>

              {/* Location */}
              <label className="field-label">
                Location <span className="required">*</span>
              </label>
              <input
                type="text"
                name="location"
                required
                placeholder="City, State"
                value={this.state.location}
                onChange={this.handleChange}
              />

              {/* Marital Status */}
              <label className="field-label">Marital Status</label>
              <select
                name="maritalStatus"
                value={this.state.maritalStatus}
                onChange={this.handleChange}
              >
                <option value="">— Select Option —</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Separated">Separated</option>
                <option value="Widowed">Widowed</option>
              </select>

              {/* Household Income */}
              <label className="field-label">Household Income Range</label>
              <select
                name="incomeRange"
                value={this.state.incomeRange}
                onChange={this.handleChange}
              >
                <option value="">— Select Option —</option>
                <option value="0-9999">$0–$9,999</option>
                <option value="10000-24999">$10,000–$24,999</option>
                <option value="25000-49000">$25,000–$49,000</option>
                <option value="50000-74999">$50,000–$74,999</option>
                <option value="75000-99999">$75,000–$99,999</option>
                <option value="100000-149999">$100,000–$149,999</option>
                <option value="150000+">$150,000+</option>
              </select>

              {/* Education Level */}
              <label className="field-label">Education Level</label>
              <select
                name="education"
                value={this.state.education}
                onChange={this.handleChange}
              >
                <option value="">— Select Option —</option>
                <option value="Less than High School">Less than High School</option>
                <option value="High School Diploma">High School Diploma</option>
                <option value="Some College">Some College, No Degree</option>
                <option value="Associate Degree">Associate Degree</option>
                <option value="Bachelors">Bachelor's Degree</option>
                <option value="Masters">Master's Degree</option>
                <option value="Doctoral">Doctoral / Professional Degree</option>
              </select>

              {/* Employment Status */}
              <label className="field-label">Employment Status</label>
              <select
                name="employment"
                value={this.state.employment}
                onChange={this.handleChange}
              >
                <option value="">— Select Option —</option>
                <option value="Full-time">Employed full-time</option>
                <option value="Part-time">Employed part-time</option>
                <option value="Self-employed">Self-employed</option>
                <option value="Homemaker">Homemaker</option>
                <option value="Looking">Looking for work / Starting business</option>
                <option value="Student">Student</option>
              </select>

              {/* Terms & Conditions */}
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
                  </span><span className="required">*</span>
                </label>
              </div>

              {/* Submit Button */}
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

export default Registration;
