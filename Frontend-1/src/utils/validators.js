export const validatePassword = (password, repassword) => {
  if (password !== repassword) {
    return "Passwords do not match.";
  }
  if (password.length < 8) {
    return "Password must be at least 8 characters long.";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one digit.";
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return "Password must contain at least one special character.";
  }
  return ""; // no errors
};


export const validateTerms = (accepted) => {
  if (!accepted) return "You must accept the Terms & Conditions";
  return "";
};
