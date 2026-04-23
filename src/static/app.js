document.addEventListener("DOMContentLoaded", () => {
  const authContainer = document.getElementById("auth-container");
  const authMessageDiv = document.getElementById("auth-message");
  const loginTab = document.getElementById("login-tab");
  const registerTab = document.getElementById("register-tab");
  const loginForm = document.getElementById("login-form");
  const registerForm = document.getElementById("register-form");
  const sessionControls = document.getElementById("session-controls");
  const currentUserSpan = document.getElementById("current-user");
  const logoutBtn = document.getElementById("logout-btn");

  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const signupNote = document.getElementById("signup-note");
  const emailInput = document.getElementById("email");
  const messageDiv = document.getElementById("message");

  let currentUser = null;

  function showFlashMessage(element, text, type = "info") {
    element.textContent = text;
    element.className = type;
    element.classList.remove("hidden");

    setTimeout(() => {
      element.classList.add("hidden");
    }, 5000);
  }

  function setAuthTab(tab) {
    const showLogin = tab === "login";
    loginTab.classList.toggle("active", showLogin);
    registerTab.classList.toggle("active", !showLogin);
    loginForm.classList.toggle("hidden", !showLogin);
    registerForm.classList.toggle("hidden", showLogin);
  }

  function updateAuthUI() {
    const isAuthenticated = Boolean(currentUser);

    if (isAuthenticated) {
      currentUserSpan.textContent = `Logged in as ${currentUser.username} (${currentUser.email})`;
      emailInput.value = currentUser.email;
      signupNote.classList.add("hidden");
      signupForm.classList.remove("disabled");
      sessionControls.classList.remove("hidden");
      authContainer.classList.add("hidden");
    } else {
      currentUserSpan.textContent = "";
      emailInput.value = "";
      signupNote.classList.remove("hidden");
      signupForm.classList.add("disabled");
      sessionControls.classList.add("hidden");
      authContainer.classList.remove("hidden");
      setAuthTab("login");
    }
  }

  async function checkSession() {
    try {
      const response = await fetch("/auth/me");
      const result = await response.json();
      currentUser = result.authenticated ? result.user : null;
    } catch (error) {
      currentUser = null;
      console.error("Error checking session:", error);
    }

    updateAuthUI();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        currentUser && currentUser.email === email
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      if (currentUser) {
        // Add event listeners to delete buttons
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    if (!currentUser) {
      showFlashMessage(messageDiv, "Please log in first.", "error");
      return;
    }

    const button = event.target;
    const activity = button.getAttribute("data-activity");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showFlashMessage(messageDiv, result.message, "success");
        await fetchActivities();
      } else {
        showFlashMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showFlashMessage(messageDiv, "Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const identifier = document.getElementById("login-identifier").value.trim();
    const password = document.getElementById("login-password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showFlashMessage(authMessageDiv, result.detail || "Login failed", "error");
        return;
      }

      currentUser = result.user;
      updateAuthUI();
      await fetchActivities();
      loginForm.reset();
      showFlashMessage(messageDiv, "You are now logged in.", "success");
    } catch (error) {
      showFlashMessage(authMessageDiv, "Failed to log in. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  registerForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("register-username").value.trim();
    const email = document.getElementById("register-email").value.trim();
    const password = document.getElementById("register-password").value;

    try {
      const response = await fetch("/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, email, password }),
      });

      const result = await response.json();
      if (!response.ok) {
        showFlashMessage(authMessageDiv, result.detail || "Registration failed", "error");
        return;
      }

      registerForm.reset();
      setAuthTab("login");
      showFlashMessage(authMessageDiv, "Account created. Please log in.", "success");
    } catch (error) {
      showFlashMessage(authMessageDiv, "Failed to register. Please try again.", "error");
      console.error("Error registering:", error);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", { method: "POST" });
      currentUser = null;
      updateAuthUI();
      await fetchActivities();
      showFlashMessage(messageDiv, "Logged out successfully.", "success");
    } catch (error) {
      showFlashMessage(messageDiv, "Logout failed. Please try again.", "error");
      console.error("Error logging out:", error);
    }
  });

  loginTab.addEventListener("click", () => setAuthTab("login"));
  registerTab.addEventListener("click", () => setAuthTab("register"));

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      showFlashMessage(messageDiv, "Please log in to sign up.", "error");
      return;
    }

    const activity = document.getElementById("activity").value;

    if (!activity) {
      showFlashMessage(messageDiv, "Please select an activity.", "error");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showFlashMessage(messageDiv, result.message, "success");
        signupForm.reset();
        emailInput.value = currentUser.email;

        // Refresh activities list to show updated participants
        await fetchActivities();
      } else {
        showFlashMessage(messageDiv, result.detail || "An error occurred", "error");
      }
    } catch (error) {
      showFlashMessage(messageDiv, "Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkSession().then(fetchActivities);
});
