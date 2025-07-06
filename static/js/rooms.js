document.addEventListener("DOMContentLoaded", function () {
  const socket = io();

  // Add fade-in animation to cards
  const cards = document.querySelectorAll(".card");
  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 0.1}s`;
  });

  // Add hover effects to room cards
  const roomCards = document.querySelectorAll(".room-card");
  roomCards.forEach((card) => {
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-4px)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0)";
    });
  });

  // Add confirmation for delete buttons
  const deleteButtons = document.querySelectorAll(".btn-danger");
  deleteButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      if (!confirm("Ви впевнені, що хочете видалити цей чат?")) {
        e.preventDefault();
      }
    });
  });

  // Add loading state to forms
  const forms = document.querySelectorAll("form");
  forms.forEach((form) => {
    form.addEventListener("submit", function (e) {
      const submitBtn = this.querySelector('button[type="submit"]');
      if (submitBtn) {
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

  // Update online users list with new design
  socket.on("update_user_list", (users) => {
    const userList = document.querySelector(".user-list");
    if (userList) {
      userList.innerHTML = "";
      users.forEach((username) => {
        if (username !== currentUser) {
          const li = document.createElement("li");
          li.className = "user-item fade-in";
          li.innerHTML = `
                        <span>👤 ${username}</span>
                        <form action="/create_room" method="POST" style="display: inline;">
                            <input type="hidden" name="room_type" value="private">
                            <input type="hidden" name="recipient" value="${username}">
                            <button type="submit" class="btn btn-primary">Почати чат</button>
                        </form>
                    `;
          userList.appendChild(li);
        }
      });
    }
  });

  // Handle user connection with notification
  socket.on("user_connected", (data) => {
    console.log(`User connected: ${data.username}`);
    showNotification(`${data.username} приєднався до чату`, "success");
  });

  // Handle user disconnection with notification
  socket.on("user_disconnected", (data) => {
    console.log(`User disconnected: ${data.username}`);
    showNotification(`${data.username} покинув чат`, "warning");
  });

  // Function to show notifications
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `alert alert-${type} fade-in`;
    notification.textContent = message;
    notification.style.position = "fixed";
    notification.style.top = "20px";
    notification.style.right = "20px";
    notification.style.zIndex = "1000";
    notification.style.minWidth = "300px";

    document.body.appendChild(notification);

    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      notification.style.transform = "translateX(100%)";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // Add smooth scrolling to page
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
});
