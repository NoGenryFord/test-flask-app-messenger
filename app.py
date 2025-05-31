from flask import Flask, render_template, request
from flask_socketio import SocketIO, send

app = Flask(__name__) # Initialize the Flask application
app.config['SECRET_KEY'] = '12345' # Set a secret key for session management
socketio = SocketIO(app) # Initialize SocketIO with the Flask app

@app.route('/') # Define the route for the home page

# This function will be called when the user accesses the root URL
def index():
    return render_template('index.html')

@socketio.on('connect') # Define an event handler for the 'connect' event
def handle_connect():
    print('Client connected')
    socketio.emit('my_response', {'data': 'Connected successfully!'})

@socketio.on('disconnect') # Define an event handler for the 'disconnect' event
def handle_disconnect():
    print('Client disconnected')
    socketio.emit('my_response', {'data': 'Disconnected successfully!'})

@socketio.on('message') # Define an event handler for the 'message' event
def handle_message(data):
    print('Received message:', data)
    # Broadcast the message to all connected clients except the sender
    send(data, broadcast=True, include_self=False)

if __name__ == '__main__': # Run the application
    #app.run(debug=True) # Set debug=True for development mode
    socketio.run(app, host='0.0.0.0', port=5000,debug=True) # Use SocketIO to run the Flask app