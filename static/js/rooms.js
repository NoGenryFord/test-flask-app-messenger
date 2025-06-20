document.addEventListener('DOMContentLoaded', function() {
    const socket = io();
    const onlineUsersList = document.getElementById('online-users-list');
    const roomForm = document.getElementById('roomForm');
    
    // Form submission handling
    roomForm.addEventListener('submit', function(e) {
        const roomName = document.getElementById('roomName').value.trim();
        if (!roomName) {
            e.preventDefault();
            alert('Room name cannot be empty!');
            return;
        }
    });

    // Update online users list
    socket.on('update_user_list', (users) => {
        onlineUsersList.innerHTML = '';
        users.forEach(username => {
            if (username !== currentUser) { // currentUser повинен бути визначений в rooms.html
                const li = document.createElement('li');
                li.innerHTML = `
                    <span>${username}</span>
                    <form action="/create_room" method="POST" style="display: inline;">
                        <input type="hidden" name="room_type" value="private">
                        <input type="hidden" name="recipient" value="${username}">
                        <button type="submit">Start Chat</button>
                    </form>
                `;
                onlineUsersList.appendChild(li);
            }
        });
    });

    // Handle user connection
    socket.on('user_connected', (data) => {
        console.log(`User connected: ${data.username}`);
    });

    // Handle user disconnection
    socket.on('user_disconnected', (data) => {
        console.log(`User disconnected: ${data.username}`);
    });
});