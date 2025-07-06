document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("authForm");
  if (!form) return;

  const radios = document.getElementsByName("auth_mode");
  const submitBtn = document.getElementById("submitBtn");
  const usernameInput = document.getElementById("username");
  const passwordInput = document.getElementById("password");

  // Function to update form based on selected mode
  function updateForm() {
    const selectedMode = document.querySelector(
      'input[name="auth_mode"]:checked'
    ).value;

    if (selectedMode === "login") {
      form.action = "/login";
      submitBtn.textContent = "Увійти";
      submitBtn.className = "btn btn-primary";
    } else {
      form.action = "/register";
      submitBtn.textContent = "Зареєструватися";
      submitBtn.className = "btn btn-primary";
    }
  }

  // Add change event listeners to radio buttons
  radios.forEach((radio) => {
    radio.addEventListener("change", updateForm);
  });

  // Add loading state to form submission
  form.addEventListener("submit", function (e) {
    const submitBtn = this.querySelector("#submitBtn");
    const originalText = submitBtn.textContent;

    // Show loading state
    submitBtn.textContent = "Завантаження...";
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Завантаження...';

    // Re-enable after a delay (in case of error)
    setTimeout(() => {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }, 5000);
  });

  // Add focus effects
  usernameInput.addEventListener("focus", function () {
    this.parentElement.classList.add("focused");
  });

  usernameInput.addEventListener("blur", function () {
    this.parentElement.classList.remove("focused");
  });

  passwordInput.addEventListener("focus", function () {
    this.parentElement.classList.add("focused");
  });

  passwordInput.addEventListener("blur", function () {
    this.parentElement.classList.remove("focused");
  });

  // Initialize form state
  updateForm();
});
