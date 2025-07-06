// chat.js
document.addEventListener("DOMContentLoaded", () => {
  const socket = io();
  const messagesDiv = document.getElementById("messages");
  const messageInput = document.getElementById("messageInput");
  const sendButton = document.getElementById("sendButton");
  const room = document.getElementById("room-name").dataset.room;
  const currentUser = document.getElementById("current-user").dataset.username;

  // Joining a room
  socket.emit("join_room", { room: room });

  // Function to create a message element
  function createMessageElement(
    sender,
    message,
    timestamp,
    isOwnMessage = false
  ) {
    const messageElement = document.createElement("div");
    messageElement.className = `message ${
      isOwnMessage ? "sent" : "received"
    } fade-in`;

    const headerElement = document.createElement("div");
    headerElement.className = "message-header";
    headerElement.innerHTML = `<strong>${sender}</strong> <span>${timestamp}</span>`;

    const contentElement = document.createElement("div");
    contentElement.className = "message-content";
    contentElement.textContent = message;

    messageElement.appendChild(headerElement);
    messageElement.appendChild(contentElement);

    return messageElement;
  }

  // Function to scroll to bottom
  function scrollToBottom() {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Sending a message
  function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
      socket.emit("send_message", {
        room: room,
        message: message,
      });
      messageInput.value = "";
    }
  }

  sendButton.addEventListener("click", sendMessage);

  // Enter key to send message
  messageInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  });

  // Receiving a message
  socket.on("receive_message", (data) => {
    const isOwnMessage = data.sender === currentUser;
    const messageElement = createMessageElement(
      data.sender,
      data.message,
      data.timestamp,
      isOwnMessage
    );
    messagesDiv.appendChild(messageElement);
    scrollToBottom();
  });

  // Auto-scroll to bottom on page load
  scrollToBottom();

  // Leaving the room when closing
  window.addEventListener("beforeunload", () => {
    socket.emit("leave_room", { room: room });
  });

  // Focus on input when page loads
  messageInput.focus();
});
