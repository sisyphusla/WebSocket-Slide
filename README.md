# WebSocket & Real-Time Communication Presentation

An interactive HTML presentation with live demos covering HTTP polling, Server-Sent Events, WebSocket, and real-time messaging patterns.

**Live Demo:** https://sisyphusla.github.io/WebSocket-Slide/websocket-presentation.html

## Requirements

- Node.js v18 or later
- npm

## Setup

```bash
npm install
```

## Start the server

```bash
npm start
```

The server runs at `http://localhost:3000`.

## Usage

### Presenter

Open the presentation in your browser:

```
http://localhost:3000/websocket-presentation.html
```

Navigate slides with arrow keys (left/right) or click the navigation dots.

### Audience (Live Chat Demo)

Audience members join the chat by opening the following URL on their devices:

```
http://<your-local-ip>:3000/chat
```

All devices must be on the same Wi-Fi network. Find your local IP with:

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I
```

## Project Structure

```
server.js                      Express + Socket.IO server
websocket-presentation.html    Slide deck (single HTML file)
chat.html                      Audience chat page (mobile-friendly)
assets/                        SVG diagrams (Excalidraw)
vendor/                        Third-party libraries (Socket.IO client, QR code)
plan/                          Design notes and lessons learned
```

## Server Endpoints

| Endpoint          | Method | Description                              |
|-------------------|--------|------------------------------------------|
| `/api/poll`       | GET    | Short polling (supports `?since=` param) |
| `/api/long-poll`  | GET    | Long polling (30s timeout)               |
| `/api/sse`        | GET    | Server-Sent Events stream                |
| `/api/message`    | POST   | Send a message to all channels           |
| `/chat`           | GET    | Audience chat page                       |

## Socket.IO Events

| Event               | Direction        | Description                          |
|---------------------|------------------|--------------------------------------|
| `register`          | Client to Server | Register nickname, auto-assign room  |
| `registered`        | Server to Client | Confirm registration with room info  |
| `user list`         | Server to All    | Updated list of connected users      |
| `chat message`      | Bidirectional    | Broadcast message to everyone        |
| `room message`      | Bidirectional    | Message to a specific room           |
| `private message`   | Bidirectional    | Direct message to one user           |
| `presenter message` | Client to Server | Presenter sends with mode targeting  |
| `force disconnect`  | Client to Server | Trigger disconnect (lifecycle demo)  |
