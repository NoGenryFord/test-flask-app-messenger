// Prevent the default form submission
const socket = io();
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');

// Initialize the WebSocket connection
socket.on('connect', () => {
    console.log('Connected to WebSocket');
});

// Handle the 'my_response' event from the server
socket.on('my_response', (data) => {
    console.log('Response from server:', data);
});

// Handle incoming messages
socket.on('message', (data) => {
    const newMessage = document.createElement('p');
    newMessage.textContent = `Other: ${data.text}`;
    messagesDiv.appendChild(newMessage);
});

// Send a message when the button is clicked
sendButton.addEventListener('click', () => {
    const text = messageInput.value;
    if (text) {
        socket.emit('message', { text: text });
        const newMessage = document.createElement('p');
        newMessage.textContent = `You: ${text}`;
        messagesDiv.appendChild(newMessage);
        messageInput.value = '';
    }
});