// Main JavaScript file for common functionality
document.addEventListener("DOMContentLoaded", () => {
  // Initialize common functionality
  initializeCommonFeatures();

  // Initialize socket connection if available
  if (typeof io !== "undefined") {
    initializeSocketFeatures();
  }
});

function initializeCommonFeatures() {
  // Add smooth scrolling to all internal links
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute("href"));
      if (target) {
        target.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    });
  });

  // Add loading states to all forms
  document.querySelectorAll("form").forEach((form) => {
    form.addEventListener("submit", function (e) {
      const submitBtn = this.querySelector('button[type="submit"]');
      if (submitBtn && !submitBtn.disabled) {
        const originalText = submitBtn.textContent;
        submitBtn.textContent = "Завантаження...";
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Завантаження...';

        // Re-enable after a delay (in case of error)
        setTimeout(() => {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }, 5000);
      }
    });
  });

  // Add confirmation for delete actions
  document.querySelectorAll(".btn-danger").forEach((button) => {
    button.addEventListener("click", function (e) {
      if (!confirm("Ви впевнені, що хочете виконати цю дію?")) {
        e.preventDefault();
      }
    });
  });

  // Add hover effects to cards
  document.querySelectorAll(".card, .room-card").forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-2px)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
    });
  });

  // Add focus effects to inputs
  document.querySelectorAll("input, textarea, select").forEach((input) => {
    input.addEventListener("focus", function () {
      this.parentElement.classList.add("focused");
    });

    input.addEventListener("blur", function () {
      this.parentElement.classList.remove("focused");
    });
  });

  // Add fade-in animation to elements
  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("fade-in");
      }
    });
  }, observerOptions);

  document.querySelectorAll(".card, .room-card, .user-item").forEach((el) => {
    observer.observe(el);
  });
}

function initializeSocketFeatures() {
  const socket = io();

  // Handle connection status
  socket.on("connect", () => {
    console.log("Connected to server");
    showNotification("Підключено до сервера", "success");
  });

  socket.on("disconnect", () => {
    console.log("Disconnected from server");
    showNotification("Відключено від сервера", "warning");
  });

  // Handle user join/leave notifications
  socket.on("user_joined", (data) => {
    showNotification(`${data.username} приєднався до чату`, "success");
  });

  socket.on("user_left", (data) => {
    showNotification(`${data.username} покинув чат`, "warning");
  });

  // Handle error messages
  socket.on("error", (data) => {
    showNotification(data.message, "error");
  });
}

// Utility function to show notifications
function showNotification(message, type = "info") {
  const notification = document.createElement("div");
  notification.className = `alert alert-${type} fade-in`;
  notification.textContent = message;
  notification.style.position = "fixed";
  notification.style.top = "20px";
  notification.style.right = "20px";
  notification.style.zIndex = "1000";
  notification.style.minWidth = "300px";
  notification.style.maxWidth = "400px";
  notification.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.15)";

  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (document.body.contains(notification)) {
        document.body.removeChild(notification);
      }
    }, 300);
  }, 3000);
}

// Utility function to format timestamps
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("uk-UA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Utility function to debounce function calls
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Export functions for use in other modules
window.TigerMessenger = {
  showNotification,
  formatTimestamp,
  debounce,
};
