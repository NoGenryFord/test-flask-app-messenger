import datetime
from flask import Flask, render_template, request, session, redirect, url_for, flash
from flask_socketio import SocketIO, send, emit
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

    def __repr__(self):
        return f'<Message {self.content[:20]}>'

# Define route for the home page
@app.route('/', methods=['GET'])
def index():
    user = None
    history = []
    if session.get('user_id'):
        user = User.query.get(session['user_id'])
        if user:
            history = Message.query.filter_by(user_id=user.id).order_by(Message.timestamp.asc()).all()

    print(f"Online users in index route: {online_users}")
    return render_template('index.html', history=history, current_user=user, online_users=online_users)

# Define route for user registration
@app.route('/register', methods=['POST'])
def register():
    username = request.form.get('username')
    password = request.form.get('password')

    if User.query.filter_by(username=username).first():
        flash('User with this username already exists!', 'error')
        return redirect(url_for('index'))

    if not username or not password:
        flash('Username and password cannot be empty!', 'error')
        return redirect(url_for('index'))

    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password)
    db.session.add(new_user)
    db.session.commit()

    flash('Registration successful! You can now log in.', 'success')
    return redirect(url_for('index'))

# Define route for user login
@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    user = User.query.filter_by(username=username).first()

    if user and check_password_hash(user.password, password):
        session['user_id'] = user.id
        session['username'] = user.username
        print(f"User logged in. Session user_id: {session['user_id']}, username: {session['username']}")
        flash(f'Welcome, {user.username}!', 'success')
        return redirect(url_for('index'))
    else:
        flash('Invalid username or password.', 'error')
        return redirect(url_for('index'))

# Add logout route
@app.route('/logout')
def logout():
    session.pop('user_id', None)
    session.pop('username', None)
    flash('You have successfully logged out.', 'info')
    return redirect(url_for('index'))

# Define event handler for the 'connect' event
@socketio.on('connect')
def handle_connect():
    session_id = request.sid
    user_id = session.get('user_id')
    username = session.get('username')

    if user_id and username:
        online_users[session_id] = username
        emit('user_connected', {'username': username}, broadcast=True, include_self=False)
        emit('update_user_list', list(online_users.values()))
        print(f'User {username} connected with session ID: {session_id}')
        history_messages = Message.query.filter_by(user_id=user_id).order_by(Message.timestamp.asc()).all()
        emit('chat_history', {'history': [{'content': msg.content, 'sender': msg.author.username, 'timestamp': msg.timestamp.strftime('%H:%M')} for msg in history_messages]}, to=session_id)
    else:
        print(f'Anonymous client connected with session ID: {session_id}')

    emit('my_response', {'data': 'Connected to signaling server!'})
    emit('update_user_list', list(online_users.values()), to=session_id)

# Define event handler for the 'disconnect' event
@socketio.on('disconnect')
def handle_disconnect():
    session_id = request.sid
    username = online_users.pop(session_id, None)
    if username:
        emit('user_disconnected', {'username': username}, broadcast=True)
        emit('update_user_list', list(online_users.values()))
        print(f'User {username} disconnected with session ID: {session_id}')
    else:
        print(f'Anonymous client disconnected with session ID: {session_id}')
    emit('my_response', {'data': 'Disconnected from signaling server!'})

# Define event handler for the 'message' event
@socketio.on('message')
def handle_message(data):
    user_id = session.get('user_id')
    username = session.get('username')
    if user_id and username:
        user = User.query.get(user_id)
        print(f'Received message from user {user.username}:', data)
        new_message = Message(content=data['text'], author=user)
        db.session.add(new_message)
        db.session.commit()
        send({'text': data['text'], 'sender': username}, broadcast=True, include_self=False)
    else:
        print('User not authenticated, message not saved.')

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