document.addEventListener('DOMContentLoaded', () => {
    // 1. Getting references to HTML elements
    const socket = io();
    const messagesDiv = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    const p2pMessageInput = document.getElementById('p2pMessageInput');
    const sendP2PButton = document.getElementById('sendP2PButton');
    const onlineUsersList = document.getElementById('onlineUsers');
    const connectionStatus = document.getElementById('connectionStatus');
    const connectButton = document.getElementById('connectButton');

    let peerConnection;
    let dataChannel;

    // 2. WebRTC STUN servers for NAT traversal
    // These are public STUN servers provided by Google
    const iceServers = {
        'iceServers': [
            {'urls': 'stun:stun.l.google.com:19302'},
            {'urls': 'stun:stun1.l.google.com:19302'},
            {'urls': 'stun:stun2.l.google.com:19302'},
            {'urls': 'stun:stun3.l.google.com:19302'},
            {'urls': 'stun:stun4.l.google.com:19302'},
        ]
    };

    // --- WebSocket (Socket.IO) Handlers ---
    socket.on('connect', () => {
        console.log('Connected to WebSocket');
        if (connectionStatus) {
            connectionStatus.textContent = 'Connected to signaling server';
        }
    });

    socket.on('my_response', (data) => {
        console.log('Response from server:', data);
    });

    // 3. Chat history handler that loads on connection
    socket.on('chat_history', (data) => {
        console.log('Received chat history:', data.history);
        if (messagesDiv) {
            messagesDiv.innerHTML = ''; // Clear existing messages
            data.history.forEach(msg => {
                const newMessage = document.createElement('p');
                newMessage.textContent = `${msg.sender}: ${msg.content} (${msg.timestamp})`;
                messagesDiv.appendChild(newMessage);
            });
        }
    });

    // 4. Incoming message handler
    socket.on('message', (data) => {
        if (messagesDiv) {
            const newMessage = document.createElement('p');
            newMessage.textContent = `${data.sender}: ${data.text}`; // Display sender's name
            messagesDiv.appendChild(newMessage);
        }
    });

    // 5. User list update handler
    socket.on('update_user_list', (users) => {
        if (onlineUsersList) {
            onlineUsersList.innerHTML = ''; // Clear existing user list
            users.forEach(username => {
                const li = document.createElement('li');
                li.textContent = username;
                onlineUsersList.appendChild(li);
            });
        }
    });

    // 6. User connection and disconnection event handlers (for chat notifications)
    socket.on('user_connected', (data) => {
        if (messagesDiv) {
            const notification = document.createElement('p');
            notification.textContent = `${data.username} joined the chat!`;
            messagesDiv.appendChild(notification);
        }
    });

    socket.on('user_disconnected', (data) => {
        if (messagesDiv) {
            const notification = document.createElement('p');
            notification.textContent = `${data.username} left the chat.`;
            messagesDiv.appendChild(notification);
        }
    });

    // --- WebRTC Handlers ---
    // 7. Initiate WebRTC connection on button click
    if (connectButton) {
        connectButton.addEventListener('click', async () => {
            if (connectionStatus) connectionStatus.textContent = 'Initiating connection...';
            try {
                peerConnection = new RTCPeerConnection(iceServers);

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('Sending ICE candidate:', event.candidate);
                        socket.emit('webrtc_ice_candidate', event.candidate);
                    }
                };

                peerConnection.ondatachannel = (event) => {
                    dataChannel = event.channel;
                    dataChannel.onopen = () => {
                        console.log('Data channel opened!');
                        if (connectionStatus) connectionStatus.textContent = 'P2P connection established! Data channel opened!';
                    };
                    dataChannel.onmessage = (event) => {
                        const newMessage = document.createElement('p');
                        newMessage.textContent = `Other (P2P): ${event.data}`;
                        messagesDiv.appendChild(newMessage);
                    };
                };

                // Create Data Channel for sending messages
                dataChannel = peerConnection.createDataChannel("chat");
                dataChannel.onopen = () => {
                    console.log('Data channel opened!');
                    if (connectionStatus) connectionStatus.textContent = 'P2P connection established! Data channel opened!';
                };
                dataChannel.onmessage = (event) => {
                    const newMessage = document.createElement('p');
                    newMessage.textContent = `You (P2P): ${event.data}`;
                    messagesDiv.appendChild(newMessage);
                };

                const offer = await peerConnection.createOffer();
                await peerConnection.setLocalDescription(offer);

                console.log('Sending offer:', offer);
                socket.emit('webrtc_offer', offer);

            } catch (error) {
                console.error('Error creating offer:', error);
                if (connectionStatus) connectionStatus.textContent = 'Connection error';
            }
        });
    }

    // 8. WebRTC offer handler
    socket.on('webrtc_offer', async (data) => {
        const offer = data.offer;
        const senderSid = data.sender_sid;
        const senderUsername = data.sender_username;

        if (connectionStatus) connectionStatus.textContent = `Received offer from ${senderUsername}... Responding...`;
        try {
            if (!peerConnection) {
                peerConnection = new RTCPeerConnection(iceServers);

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        console.log('Sending ICE candidate:', event.candidate);
                        socket.emit('webrtc_ice_candidate', event.candidate);
                    }
                };

                peerConnection.ondatachannel = (event) => {
                    dataChannel = event.channel;
                    dataChannel.onopen = () => {
                        console.log('Data channel opened!');
                        if (connectionStatus) connectionStatus.textContent = 'P2P connection established! Data channel opened!';
                    };
                    dataChannel.onmessage = (event) => {
                        const newMessage = document.createElement('p');
                        newMessage.textContent = `Other (P2P): ${event.data}`;
                        messagesDiv.appendChild(newMessage);
                    };
                };
            }
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            console.log('Sending answer:', answer);
            socket.emit('webrtc_answer', {answer: answer, target_sid: senderSid});

        } catch (error) {
            console.error('Error creating answer:', error);
            if (connectionStatus) connectionStatus.textContent = 'Connection error';
        }
    });

    // 9. WebRTC answer handler
    socket.on('webrtc_answer', async (data) => {
        const answer = data.answer;
        const senderSid = data.sender_sid;

        if (peerConnection && peerConnection.localDescription && peerConnection.localDescription.type === 'offer') {
            if (connectionStatus) connectionStatus.textContent = 'Received answer... Connecting...';
            try {
                await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('Received and set remote description answer');
            } catch (error) {
                console.error('Error setting remote description answer:', error);
                if (connectionStatus) connectionStatus.textContent = 'Connection error';
            }
        }
    });

    // 10. WebRTC ICE candidate handler
    socket.on('webrtc_ice_candidate', async (data) => {
        const candidate = data.candidate;
        const senderSid = data.sender_sid;

        try {
            if (peerConnection && candidate) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Added ICE candidate:', candidate);
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    });

    // 11. Sending P2P message
    if (sendP2PButton) {
        sendP2PButton.addEventListener('click', () => {
            const text = p2pMessageInput.value;
            if (text && dataChannel && dataChannel.readyState === 'open') {
                dataChannel.send(text);
                const newMessage = document.createElement('p');
                newMessage.textContent = `You (P2P): ${text}`;
                messagesDiv.appendChild(newMessage);
                p2pMessageInput.value = '';
            } else if (!dataChannel) {
                alert('P2P connection not established. Click "Connect to Peer".');
            } else if (dataChannel.readyState !== 'open') {
                alert('Data channel not open. Wait for the connection to be established.');
            }
        });
    }

    // 12. Sending WebSocket message
    if (sendButton) {
        sendButton.addEventListener('click', () => {
            const text = messageInput.value;
            if (text) {
                socket.emit('message', { text: text });
                const newMessage = document.createElement('p');
                newMessage.textContent = `You (WebSocket): ${text}`;
                messagesDiv.appendChild(newMessage);
                messageInput.value = '';
            }
        });
    }
});