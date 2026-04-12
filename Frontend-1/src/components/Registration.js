//This page is displayed for users who log in through Auth0 and DO NOT have an account with CreatingWings

import { Component } from "react";
import { Link } from "react-router-dom";
import { validateTerms } from "../utils/validators";
import "./dummy2_register.css";
import termsText from "../assets/terms.txt";

//backend base url used when the form submits data
const AUTH_BASE = process.env.REACT_APP_AUTH_BACKEND_URL || "http://localhost:3000";  


//defines the page 
class Registration extends Component {
  constructor(props) {
    super(props);

    //stores all form values and error messages 
    this.state = {
      email: "",
      fullName: "",
      is18OrOlder: false,   //changed to be 18 or older confirmation
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
  
  //updates state for normal inputs and dropdowns
  handleChange = (e) => {
    const { name, value } = e.target;
    this.setState({ [name]: value });
  };

  //updates whether the user accepted terms
  handleCheckbox = (e) => {
    this.setState({ acceptTerms: e.target.checked });
  };

  //updates whether the user confirmed they are 18 or older
  handleAgeCheckbox = (e) => {
    this.setState({ is18OrOlder: e.target.checked });
  };

//runs when the user clicks register 
handleRegister = async (e) => {
  e.preventDefault();   //stops browser from doing a normal form submission and page reloads

  //extracts the current form values so the function can use them more easily 
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

  // Reset previous errors so if user fixes something and tries again, stale errors do not stay on screen
  this.setState({ passwordError: "", termsError: "", ageError: "", locationError: "" });

  // 1️⃣ Validate age confirmation
  if (!is18OrOlder) {
    this.setState({ ageError: "You must be 18 or older to register." });
    return;
  }

  // 2️⃣ Validate terms
  const termsError = validateTerms(acceptTerms);
  if (termsError) {
    this.setState({ termsError });
    return;
  }
  //This checks that location looks like (City, State)
  const locationPattern = /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/;
  if (!locationPattern.test(location.trim())) {
    this.setState({ locationError: "Use format: City, State" });
    return;
  }

  // added value maps so drpdown values match the Mongo schema enums
  try {
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


    //POST to backend happens here
    // SENDS DATA TO BACKEND FOR MONGODB
    const response = await fetch(`${AUTH_BASE}/api/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },

      //change request body fields to SCHEMA-COMPATIBLE values (e.g. dropdowns) and only send non-empty optional fields
      body: JSON.stringify({     
        email,
        fullName,
        location,
        maritalStatus: maritalStatus || null,
        householdIncomeRange: incomeRange ? incomeMap[incomeRange] || null : null,
        educationLevel: education ? educationMap[education] || null : null,
        employmentStatus: employment ? employmentMap[employment] || null : null,
        acceptedTerms: acceptTerms,
        is18OrOlder,
      }),
    });

    // handling failed response
    if (!response.ok) {
      throw new Error("Registration failed");
    }

    // Success handling 
    const data = await response.json();
    console.log("Registration success:", data);
    // Registration succeeded, send user to home page.
    window.location.href = `${AUTH_BASE}/api/poc-sync`;


    //Error handling 
    //if anything fails, code logs the error and shows a general message on the page 
  } catch (err) {
    console.error("Registration error:", err);
    this.setState({
      passwordError: "Something went wrong. Please try again.",
    });
  }
};


  //runs automatically when the component loads
  //reads query parameters from URL
  //load terms text file
  componentDidMount() {
    const params = new URLSearchParams(window.location.search);
    const emailFromAuth = params.get("email");
    const fullNameFromAuth = params.get("fullName");

    this.setState({
      email: emailFromAuth || "",
      fullName: fullNameFromAuth || "",
    });

    fetch(termsText)
      .then((res) => res.text())
      .then((text) => this.setState({ termsContent: text }));
  }

  //opens the modal, disables page scrolling in the background
  openTerms = () => {
    this.setState({ showTerms: true });
    document.body.style.overflow = "hidden";
  };

  //closes the modal, restores page scrolling
  closeTerms = () => {
    this.setState({ showTerms: false });
    document.body.style.overflow = "auto";
  };

  //checks the term box for the user, closes the modal, restores scroling
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
            <h2>Profile</h2>

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
              readOnly
              className="input-locked"
              />
              {/* PASSWORD ERROR MESSAGE */}
              {this.state.passwordError && (
                <div className="inline-error">{this.state.passwordError}</div>
              )}

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
              readOnly
              className="input-locked"
              />
                                
              {/* Location */}
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
