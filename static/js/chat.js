// chat.js
document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const room = document.getElementById('room-name').dataset.room;
    const currentUser = document.getElementById('current-user').dataset.username;

    // Joining a room
    socket.emit('join_room', { room: room });

    // Sending a message
    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message) {
            socket.emit('send_message', {
                room: room,
                message: message
            });
            messageInput.value = '';
        }
    });

    // Enter key to send message
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendButton.click();
        }
    });

    // Receiving a message
    socket.on('receive_message', (data) => {
        const messageElement = document.createElement('p');
        messageElement.innerHTML = `<strong>${data.sender}</strong> (${data.timestamp}): ${data.message}`;
        messagesDiv.appendChild(messageElement);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    });

    // Leaving the room when closing
    window.addEventListener('beforeunload', () => {
        socket.emit('leave_room', { room: room });
    });
});