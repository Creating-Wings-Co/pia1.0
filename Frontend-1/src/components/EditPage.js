import React, { Component } from "react";
import { Link } from "react-router-dom";
import { withAuth0 } from "@auth0/auth0-react";
import "./dummy2_register.css";
import termsText from "../assets/terms.txt";
import { validateTerms } from "../utils/validators";

const API_BASE = process.env.REACT_APP_API_BASE_URL;
const CHATBOT_URL = process.env.REACT_APP_CHATBOT_URL;

class EditPage extends Component {
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
      loading: true,
    };
  }

  async componentDidMount() {
    const { user, isAuthenticated, isLoading, getAccessTokenSilently } = this.props.auth0;

    if (isLoading) {
      return;
    }

    if (!isAuthenticated || !user) {
      window.location.href = "/login";
      return;
    }

    try {
      const text = await fetch(termsText).then((res) => res.text());
      this.setState({ termsContent: text });
    } catch (err) {
      console.error("Failed to load terms text:", err);
    }

    try {
      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE}/api/user/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load profile");
      }

      const profile = await response.json();

      const incomeReverseMap = {
        "$0-$9,999": "0-9999",
        "$10,000-$24,999": "10000-24999",
        "$25,000-$49,999": "25000-49000",
        "$25,000-$49,000": "25000-49000",
        "$50,000-$74,999": "50000-74999",
        "$75,000-$99,999": "75000-99999",
        "$100,000-$149,999": "100000-149999",
        "$150,000+": "150000+",
      };

      const educationReverseMap = {
        "Less than High School": "Less than High School",
        "High School Diploma": "High School Diploma",
        "Some College, No Degree": "Some College",
        "Associate Degree": "Associate Degree",
        "Bachelor's Degree": "Bachelors",
        "Master's Degree": "Masters",
        "Doctoral/Professional Degree": "Doctoral",
        "Doctoral / Professional Degree": "Doctoral",
      };

      const employmentReverseMap = {
        "Employed full-time": "Full-time",
        "Employed part-time": "Part-time",
        "Self-employed": "Self-employed",
        Homemaker: "Homemaker",
        "Looking for work": "Looking",
        "Looking for work / Starting business": "Looking",
        Student: "Student",
      };

      this.setState({
        email: profile.email || user.email || "",
        fullName: profile.name || user.name || "",
        location: profile.location || "",
        maritalStatus: profile.marital_status || "",
        incomeRange: incomeReverseMap[profile.income_range] || "",
        education: educationReverseMap[profile.education] || "",
        employment: employmentReverseMap[profile.employment_status] || "",
        acceptTerms: true,
        is18OrOlder: true,
        loading: false,
      });
    } catch (err) {
      console.error("Failed to load profile:", err);
      this.setState({
        email: user.email || "",
        fullName: user.name || "",
        acceptTerms: true,
        is18OrOlder: true,
        loading: false,
        passwordError: "Could not load profile. You can still update and save.",
      });
    }
  }

  async componentDidUpdate(prevProps) {
    const prevAuth0 = prevProps.auth0;
    const currentAuth0 = this.props.auth0;

    if (prevAuth0.isLoading && !currentAuth0.isLoading) {
      await this.componentDidMount();
    }
  }

  handleChange = (e) => this.setState({ [e.target.name]: e.target.value });
  handleCheckbox = (e) => this.setState({ acceptTerms: e.target.checked });
  handleAgeCheckbox = (e) => this.setState({ is18OrOlder: e.target.checked });

  handleSave = async (e) => {
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

    this.setState({
      passwordError: "",
      termsError: "",
      ageError: "",
      locationError: "",
    });

    if (!is18OrOlder) {
      this.setState({ ageError: "You must be 18 or older to continue." });
      return;
    }

    const termsError = validateTerms(acceptTerms);
    if (termsError) {
      this.setState({ termsError });
      return;
    }

    const locationPattern = /^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$/;
    if (!locationPattern.test(location.trim())) {
      this.setState({ locationError: "Use format: State, Country" });
      return;
    }

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

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Profile update failed:", response.status, errorText);
        throw new Error("Profile update failed");
      }

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
    const { showTerms, termsContent, loading } = this.state;

    if (loading) {
      return <div className="register-container">Loading profile...</div>;
    }

    return (
      <>
        <div className={`register-container ${showTerms ? "blurred" : ""}`}>
          <div className="register-form">
            <img src="/logo.png" alt="Logo" className="register-logo" />
            <h2>Edit Profile</h2>

            <form onSubmit={this.handleSave}>
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
                placeholder="State, Country"
                pattern="^[A-Za-z .'-]+,\s*[A-Za-z .'-]+$"
                title="Use format: State, Country"
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

              <button type="submit">Save Changes</button>
            </form>

            <div className="link-text">
              <Link to="/login">Back</Link>
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

export default withAuth0(EditPage);
