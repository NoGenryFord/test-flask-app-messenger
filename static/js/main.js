document.addEventListener('DOMContentLoaded', () => {
    const socket = io();
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const recipientSelect = document.getElementById('recipientSelect');
    const startPrivateChatButton = document.getElementById('startPrivateChatButton');
    const groupNameInput = document.getElementById('groupNameInput');
    const createGroupChatButton = document.getElementById('createGroupChatButton');

    let currentChat = null; // Track the current chat (user or group)

    // Start private chat
    startPrivateChatButton.addEventListener('click', () => {
        const recipient = recipientSelect.value;
        if (recipient) {
            currentChat = recipient;
            messagesDiv.innerHTML = `<h3>Chat with ${recipient}</h3>`;
            socket.emit('start_private_chat', { recipient });
        } else {
            alert('Please select a user to start a chat.');
        }
    });

    // Create group chat
    createGroupChatButton.addEventListener('click', () => {
        const groupName = groupNameInput.value.trim();
        if (groupName) {
            currentChat = groupName;
            messagesDiv.innerHTML = `<h3>Group Chat: ${groupName}</h3>`;
            socket.emit('create_group_chat', { groupName });
        } else {
            alert('Please enter a group name.');
        }
    });

    // Send message
    sendButton.addEventListener('click', () => {
        const message = messageInput.value.trim();
        if (message && currentChat) {
            socket.emit('send_message', { chat: currentChat, message });
            const newMessage = document.createElement('p');
            newMessage.textContent = `You: ${message}`;
            messagesDiv.appendChild(newMessage);
            messageInput.value = '';
        } else {
            alert('Please select a chat and enter a message.');
        }
    });

    // Receive message
    socket.on('receive_message', (data) => {
        if (data.chat === currentChat) {
            const newMessage = document.createElement('p');
            newMessage.textContent = `${data.sender}: ${data.message}`;
            messagesDiv.appendChild(newMessage);
        }
    });
});