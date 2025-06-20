import datetime
from flask import Flask, render_template, request, session, redirect, url_for, flash
from flask_socketio import SocketIO, send, emit, join_room, leave_room
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

# Initialize Flask application
app = Flask(__name__)
app.config['SECRET_KEY'] = '12345'
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///site.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize SQLAlchemy database instance
db = SQLAlchemy(app)

# Initialize SocketIO with the Flask app
socketio = SocketIO(app)

# Global variable: Dictionary to keep track of online users (session_id: username)
online_users = {}

# Define User model for the database
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(150), nullable=False)
    messages = db.relationship('Message', backref='author', lazy=True)

    def __repr__(self):
        return f"User('{self.username}')"

# Define Message model for storing messages
class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('chat_room.id'), nullable=False)

    def __repr__(self):
        return f'<Message {self.content[:20]}>'
    
# Define association table for many-to-many relationship
chat_users = db.Table('chat_users',
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True),
    db.Column('chat_room_id', db.Integer, db.ForeignKey('chat_room.id'), primary_key=True)
)

class ChatRoom(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), unique=True, nullable=False)
    is_group = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)
    messages = db.relationship('Message', backref='room', lazy=True)
    users = db.relationship('User', secondary=chat_users, backref='chats')
    created_by = db.Column(db.Integer, db.ForeignKey('user.id'))
    
# Function to get available rooms (dummy implementation)
def get_available_rooms():
    """Get list of available chat rooms"""
    user_id = session.get('user_id')
    if not user_id:
        return []

    # Get all rooms
    rooms = ChatRoom.query.all()
    return [{'id': room.id, 'name': room.name, 'is_group': room.is_group} for room in rooms]

# Define route for the home page
@app.route('/', methods=['GET'])
def login_page():
    if session.get('user_id'):
        return redirect(url_for('rooms_page'))
    return render_template('login.html')

# Define route for the rooms page
@app.route('/create_room', methods=['POST'])
def create_room():
    if not session.get('user_id'):
        return redirect(url_for('login_page'))
    room_type = request.form.get('room_type')

    current_user = db.session.get(User, session['user_id'])
    if not current_user:
        session.clear()
        flash('Session expired. Please login again.', 'error')
        return redirect(url_for('login_page'))
    
    if room_type == 'private':
        recipient_name = request.form.get('recipient')
        recipient = User.query.filter_by(username=recipient_name).first()
        if not recipient:
            flash('User not found!', 'error')
            return redirect(url_for('rooms_page'))
            
        # Create a unique room name for the private chat
        users = sorted([current_user.username, recipient_name])
        room_name = f'private_{users[0]}_{users[1]}'

        # Check if such a chat already exists
        existing_room = ChatRoom.query.filter_by(name=room_name).first()
        if existing_room:
            return redirect(url_for('chat_page', room_name=room_name))

        # Create a new chat
        new_room = ChatRoom(
            name=room_name,
            is_group=False,
            created_by=current_user.id
        )
        new_room.users.append(current_user)
        new_room.users.append(recipient)
        
    else:
        # Logic for group chat
        group_name = request.form.get('group_name')
        if not group_name:
            flash('Group name cannot be empty!', 'error')
            return redirect(url_for('rooms_page'))
        
        #Check if a group chat with the same name already exists
        if ChatRoom.query.filter_by(name=group_name, is_group=True).first():
            flash('Group chat with this name already exists!', 'error')
            return redirect(url_for('rooms_page'))
        
        # Create a new group chat
        new_room = ChatRoom(
            name=group_name,
            is_group=True,
            created_by=current_user.id
        )
        # Add create like first user to the group
        new_room.users.append(current_user)

        # Add selected users to the group
        selected_users = request.form.getlist('selected_users[]')
        for username in selected_users:
            user = User.query.filter_by(username=username).first()
            if user and user != current_user:
                new_room.users.append(user)
    
    try:
        db.session.add(new_room)
        db.session.commit()
        # Add system message to the new room
        system_message = Message(
                content=f'Chat created by {current_user.username}',
                user_id=current_user.id,
                room_id=new_room.id
        )
        db.session.add(system_message)
        db.session.commit()

        flash('Chat created successfully!', 'success')
        return redirect(url_for('chat_page', room_name=new_room.name))
    except Exception as e:
        db.session.rollback()
        flash('Failed to create chat.', 'error')
        print(f"Error creating chat: {str(e)}")
        return redirect(url_for('rooms_page'))

# Define route for the rooms page
@app.route('/rooms', methods=['GET'])
def rooms_page():
    if not session.get('user_id'):
        return redirect(url_for('login_page'))
    
    current_user = db.session.get(User, session['user_id'])
    if not current_user:
        session.clear()
        flash('Session expired. Please login again.', 'error')
        return redirect(url_for('login_page'))

    # Use set to remove duplicates
    online_users_list = list(set(online_users.values()))
    # Delete the current user from the online users list if they are present
    if current_user.username in online_users_list:
        online_users_list.remove(current_user.username)
    
    return render_template('rooms.html', 
                         rooms=current_user.chats,
                         online_users=online_users_list,
                         current_user=current_user.username)

# Define route for the chat page
@app.route('/chat/<room_name>', methods=['GET'])
def chat_page(room_name):
    if not session.get('user_id'):
        return redirect(url_for('login_page'))

    # Get the room by name and check if it exists
    current_user = db.session.get(User, session['user_id'])
    room = ChatRoom.query.filter_by(name=room_name).first_or_404()

    # Check if the current user is part of the room
    if current_user not in room.users:
        flash('You do not have access to this chat room.', 'error')
        return redirect(url_for('rooms_page'))
    
    # Get all messages in the room if user is part of the room
    messages = Message.query.filter_by(room_id=room.id).order_by(Message.timestamp.asc()).all()
    
    return render_template('chat.html', 
                         room_name=room_name, 
                         messages=messages,
                         current_user=session.get('username'))

# Define route for user registration page
@app.route('/delete_chat/<int:chat_id>', methods=['POST'])
def delete_chat(chat_id):
    if not session.get('user_id'):
        return redirect(url_for('login_page'))
    
    chat = db.session.get(ChatRoom, chat_id)
    if not chat:
        flash('Chat not found.', 'error')
        return redirect(url_for('rooms_page'))

    # Check if the user can delete the chat
    if chat.created_by == session['user_id'] or not chat.is_group:
        try:
            # Delete all messages
            db.session.query(Message).filter_by(room_id=chat.id).delete()
            # Delete the chat room
            db.session.delete(chat)
            db.session.commit()
            flash('Chat deleted successfully!', 'success')
        except Exception as e:
            db.session.rollback()
            flash('Failed to delete chat.', 'error')
            print(f"Error deleting chat: {str(e)}")
    else:
        flash('You do not have permission to delete this chat.', 'error')
    
    return redirect(url_for('rooms_page'))

# Define route for user registration
@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    password = request.form.get('password')

    # Check if username and password are provided
    if not username or not password:
        flash('Username and password cannot be empty!', 'error')
        return redirect(url_for('login_page'))

    # Check if user already exists
    if User.query.filter_by(username=username).first():
        flash(f'User {username} already exists! Please choose another username.', 'error')
        return redirect(url_for('login_page'))

    # Create new user
    try:
        hashed_password = generate_password_hash(password)
        new_user = User(username=username, password=hashed_password)
        db.session.add(new_user)
        db.session.commit()
        flash(f'User {username} successfully registered! You can now log in.', 'success')
    except Exception as e:
        db.session.rollback()
        flash('Registration failed. Please try again.', 'error')
        print(f"Registration error: {str(e)}")
    
    return redirect(url_for('login_page'))

# Define route for user login
@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    # Check if username and password are provided
    if not username or not password:
        flash('Username and password cannot be empty!', 'error')
        return redirect(url_for('login_page'))

    # Find user
    user = User.query.filter_by(username=username).first()

    if not user:
        flash(f'User {username} does not exist!', 'error')
        return redirect(url_for('login_page'))

    if not check_password_hash(user.password, password):
        flash('Incorrect password!', 'error')
        return redirect(url_for('login_page'))

    # Successful login
    try:
        session['user_id'] = user.id
        session['username'] = user.username
        print(f"User logged in. Session user_id: {session['user_id']}, username: {session['username']}")
        flash(f'Welcome back, {user.username}!', 'success')
        return redirect(url_for('rooms_page'))
    except Exception as e:
        flash('Login failed. Please try again.', 'error')
        print(f"Login error: {str(e)}")
        return redirect(url_for('login_page'))

# Add logout route
@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    flash('You have successfully logged out.', 'info')
    return redirect(url_for('login_page'))

# Define event handler for the 'connect' event
@socketio.on('connect')
def handle_connect():
    session_id = request.sid
    user_id = session.get('user_id')
    username = session.get('username')

    if user_id and username:
        # Add user to the online users dictionary
        online_users[session_id] = username

        # Notify all users about the new user
        emit('user_connected', {'username': username}, broadcast=True)

        # Send updated user list to all users
        emit('update_user_list', list(online_users.values()), broadcast=True)
        
        print(f'User {username} connected with session ID: {session_id}')
        print(f'Current online users: {online_users}')

        # Send chat history only to the new user
        history_messages = Message.query.filter_by(user_id=user_id).order_by(Message.timestamp.asc()).all()
        emit('chat_history', {
            'history': [{
                'content': msg.content,
                'sender': msg.author.username,
                'timestamp': msg.timestamp.strftime('%H:%M')
            } for msg in history_messages]
        }, to=session_id)
    else:
        print(f'Anonymous client connected with session ID: {session_id}')

# Define event handler for the 'disconnect' event
@socketio.on('disconnect')
def handle_disconnect():
    session_id = request.sid
    username = online_users.pop(session_id, None)
    
    if username:
        # Notify all users about the disconnection
        emit('user_disconnected', {'username': username}, broadcast=True)

        # Send updated user list to all users
        emit('update_user_list', list(online_users.values()), broadcast=True)
        
        print(f'User {username} disconnected with session ID: {session_id}')
        print(f'Current online users: {online_users}')
    else:
        print(f'Anonymous client disconnected with session ID: {session_id}')

# Define event handler for starting a private chat
@socketio.on('start_private_chat')
def handle_start_private_chat(data):
    recipient = data.get('recipient')
    sender = session.get('username')
    if recipient and sender:
        room = f'private_{sender}_{recipient}'
        join_room(room)
        emit('receive_message', {'chat': room, 'sender': 'System', 'message': f'Private chat started with {recipient}.'}, room=room)

# Define event handler for creating a group chat
@socketio.on('create_group_chat')
def handle_create_group_chat(data):
    group_name = data.get('groupName')
    sender = session.get('username')
    if group_name and sender:
        room = f'group_{group_name}'
        join_room(room)
        emit('receive_message', {'chat': room, 'sender': 'System', 'message': f'Group chat "{group_name}" created.'}, room=room)

# Define event handler for sending messages
@socketio.on('send_message')
def handle_send_message(data):
    if not session.get('user_id'):
        return
    
    room_name = data.get('room')
    message_content = data.get('message')
    current_user = db.session.get(User, session['user_id'])
    room = ChatRoom.query.filter_by(name=room_name).first()
    
    # Check if the room exists and if the user is part of it
    if not room or current_user not in room.users:
        emit('error', {'message': 'Access denied'})
        return
    try:
        # Save the message
        new_message = Message(
            content=message_content,
            user_id=current_user.id,
            room_id=room.id
        )
        db.session.add(new_message)
        db.session.commit()

        # Send the message only to users in the room
        emit('receive_message', {
            'sender': current_user.username,
            'message': message_content,
            'timestamp': new_message.timestamp.strftime('%H:%M')
        }, room=room_name)
        
    except Exception as e:
        print(f"Error saving message: {str(e)}")
        db.session.rollback()

# Define event handler for joining a room
@socketio.on('join_room')
def handle_join_room(data):
    if not session.get('user_id'):
        return
    
    room_name = data.get('room')
    current_user = db.session.get(User, session['user_id'])
    room = ChatRoom.query.filter_by(name=room_name).first()
    
    if not room or current_user not in room.users:
        emit('error', {'message': 'Access denied'})
        return
    
    join_room(room_name)
    emit('receive_message', {
        'sender': 'System',
        'message': f'{current_user.username} joined the chat',
        'timestamp': datetime.datetime.now().strftime('%H:%M')
    }, room=room_name)

# Define event handler for leaving a room
@socketio.on('leave_room')
def handle_leave_room(data):
    room_name = data.get('room')
    username = session.get('username')
    if room_name and username:
        leave_room(room_name)
        emit('user_left', {'username': username}, room=room_name)

# Define event handler for join group chat
@socketio.on('join_group')
def handle_join_group(data):
    room_name = data.get('room')
    if room_name:
        room = ChatRoom.query.filter_by(name=room_name, is_group=True).first()
        if room and session.get('user_id') in [user.id for user in room.users]:
            join_room(room_name)
            emit('user_joined_group', {
                'username': session.get('username'),
                'room': room_name
            }, room=room_name)

# Define event handler for leaving a group chat
@socketio.on('leave_group')
def handle_leave_group(data):
    room_name = data.get('room')
    if room_name:
        leave_room(room_name)
        emit('user_left_group', {
            'username': session.get('username'),
            'room': room_name
        }, room=room_name)

# WebRTC Signaling Handlers
@socketio.on('webrtc_offer')
def handle_webrtc_offer(offer):
    session_id = request.sid
    username = session.get('username', 'Anonymous')
    print(f'Received WebRTC offer from {username} ({session_id}):', offer)
    emit('webrtc_offer', {'offer': offer, 'sender_sid': session_id, 'sender_username': username}, broadcast=True, include_self=False)

@socketio.on('webrtc_answer')
def handle_webrtc_answer(answer):
    session_id = request.sid
    username = session.get('username', 'Anonymous')
    print(f'Received WebRTC answer from {username} ({session_id}):', answer)
    emit('webrtc_answer', {'answer': answer, 'sender_sid': session_id, 'sender_username': username}, broadcast=True, include_self=False)

@socketio.on('webrtc_ice_candidate')
def handle_webrtc_ice_candidate(candidate):
    session_id = request.sid
    username = session.get('username', 'Anonymous')
    print(f'Received ICE candidate from {username} ({session_id}):', candidate)
    emit('webrtc_ice_candidate', {'candidate': candidate, 'sender_sid': session_id, 'sender_username': username}, broadcast=True, include_self=False)

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
    