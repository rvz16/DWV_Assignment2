from flask import Flask, render_template, request, jsonify
from flask_socketio import SocketIO, emit
import time

app = Flask(__name__)
socketio = SocketIO(app)

# Serve the frontend
@app.route('/')
def index():
    return render_template('index.html')

# Receive packages from sender script
@app.route('/receive-package', methods=['POST'])
def receive_package():
    data = request.json
    print(f"Received package: {data}")
    data["human_readable_time"] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(data["timestamp"]))
    socketio.emit('new_package', data)
    return jsonify({"status": "received"}), 200

# Client initiates stream (optional in this case)
@socketio.on('start_stream')
def handle_stream():
    emit('stream_started', {"message": "Stream started"})

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)

