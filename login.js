const form = document.querySelector("#auth-form");
const emailInput = form.elements.email;
const passwordInput = form.elements.password;
const confirmInput = form.elements.confirmPassword;
const confirmField = document.querySelector("#confirm-password-field");
const submitButton = document.querySelector("#auth-submit");
const errorMessage = document.querySelector("#auth-error");
let setupRequired = false;

async function checkLoginState() {
  try {
    const response = await fetch("/api/auth/status");
    const state = await response.json();
    if (!response.ok) throw new Error(state.error || "Could not check administrator setup.");
    if (state.authenticated) {
      window.location.replace("/?admin=1");
      return;
    }
    setupRequired = state.setupRequired;
    if (setupRequired) {
      document.querySelector("#auth-eyebrow").textContent = "FIRST-TIME SETUP";
      document.querySelector("#auth-title").textContent = "Create your admin account.";
      document.querySelector("#auth-description").textContent = "Set up the account that protects your vehicle fleet, bookings, and website settings.";
      document.querySelector("#auth-note").hidden = false;
      confirmField.hidden = false;
      confirmInput.required = true;
      passwordInput.autocomplete = "new-password";
      passwordInput.minLength = 12;
      submitButton.textContent = "Create admin account";
    }
  } catch (error) {
    showError(error.message);
    submitButton.disabled = true;
  }
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  errorMessage.hidden = true;
  if (setupRequired && passwordInput.value !== confirmInput.value) {
    showError("The passwords do not match.");
    confirmInput.focus();
    return;
  }
  submitButton.disabled = true;
  try {
    const response = await fetch(setupRequired ? "/api/auth/setup" : "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailInput.value.trim(), password: passwordInput.value }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Unable to sign in.");
    window.location.assign("/?admin=1");
  } catch (error) {
    showError(error.message);
    submitButton.disabled = false;
  }
});

void checkLoginState();
