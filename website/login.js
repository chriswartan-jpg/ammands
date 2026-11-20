(function () {
  "use strict";

  // Demo login: checks the email and password against the test accounts in
  // data/demo-accounts.js. Nothing is sent to a server and nothing is stored.
  const ACCOUNTS = window.CENTRIX_DEMO_ACCOUNTS || [];
  const ROLE_LABEL = { tenant: "tenant", partner: "partner" };

  const form = document.getElementById("login-form");
  const email = document.getElementById("email");
  const password = document.getElementById("password");
  const emailError = document.getElementById("email-error");
  const passwordError = document.getElementById("password-error");
  const formError = document.getElementById("form-error");
  const submitLabel = document.getElementById("submit-label");
  const formView = document.getElementById("login-form-view");
  const success = document.getElementById("login-success");
  const successTag = document.getElementById("success-tag");
  const successTitle = document.getElementById("success-title");
  const successText = document.getElementById("success-text");

  // Pre-select a role from the link, e.g. login.html?role=partner
  const requested = new URLSearchParams(location.search).get("role");
  if (requested && ROLE_LABEL[requested]) {
    form.querySelector(`input[name="role"][value="${requested}"]`).checked = true;
  }
  updateLabel();

  form.addEventListener("change", (event) => {
    if (event.target.name === "role") {
      updateLabel();
      formError.textContent = "";
    }
  });
  email.addEventListener("input", () => { setError(email, emailError, ""); formError.textContent = ""; });
  password.addEventListener("input", () => { setError(password, passwordError, ""); formError.textContent = ""; });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    formError.textContent = "";
    let firstInvalid = null;

    const emailValue = email.value.trim();
    if (!emailValue) {
      setError(email, emailError, "Enter your email address.");
      firstInvalid = email;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      setError(email, emailError, "Enter a valid email address, like name@example.com.");
      firstInvalid = email;
    }
    if (!password.value) {
      setError(password, passwordError, "Enter your password.");
      firstInvalid = firstInvalid || password;
    }
    if (firstInvalid) {
      firstInvalid.focus();
      return;
    }

    const account = ACCOUNTS.find((a) => a.email.toLowerCase() === emailValue.toLowerCase());
    if (!account || account.password !== password.value) {
      formError.textContent = "This email and password don't match a demo account. The test accounts are in data/demo-accounts.js.";
      password.select();
      password.focus();
      return;
    }

    const role = currentRole();
    if (account.role !== role) {
      const other = account.role === "tenant" ? "Tenant" : "Partner";
      formError.textContent = `This is a ${account.role} account. Choose ${other} above, then log in again.`;
      form.querySelector(`input[name="role"][value="${account.role}"]`).focus();
      return;
    }

    // Partners and tenants go straight to their own portal. The session lives in this tab
    // only (sessionStorage) and only holds the role and display name.
    if (account.role === "partner" || account.role === "tenant") {
      try {
        sessionStorage.setItem("centrix.session", JSON.stringify({ role: account.role, name: account.name, email: account.email }));
        password.value = "";
        location.href = account.role === "partner" ? "partner.html" : "tenant.html";
        return;
      } catch (e) {
        formError.textContent = "Your browser blocked the login session. Allow site data for this page and try again.";
        return;
      }
    }

    const firstName = account.role === "tenant" ? account.name.split(" ")[0] : account.name;
    successTag.textContent = account.role === "tenant" ? "Tenant" : "Partner";
    successTitle.textContent = `Welcome, ${firstName}`;
    successText.textContent = account.unit
      ? `You're logged in as the tenant of ${account.unit}.`
      : `You're logged in as a service partner with ${account.email}.`;
    password.value = "";
    formView.hidden = true;
    success.hidden = false;
    document.querySelector(".login-foot").hidden = true;
    success.focus();
  });

  function currentRole() {
    return form.querySelector('input[name="role"]:checked').value;
  }

  function updateLabel() {
    submitLabel.textContent = `Log in as ${ROLE_LABEL[currentRole()]}`;
  }

  function setError(input, el, message) {
    el.textContent = message;
    if (message) input.setAttribute("aria-invalid", "true");
    else input.removeAttribute("aria-invalid");
  }
})();
