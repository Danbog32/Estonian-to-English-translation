WebSocket Protocol Documentation
This document describes the WebSocket protocol used for real-time audio transcription between SvelteKit clients and the transcription server.

Connection
Endpoint: ws://[server_address]/ws/asr
Protocol: WebSocket
Authentication: (To be determined based on implementation requirements)
Message Format
All messages between client and server follow specific formats. The client can send both binary audio data and JSON control messages, while the server responds exclusively with JSON messages.

Client → Server Messages

1. Start Stream Event (JSON)
   Signals the server to create a new ASR stream. Must be sent before audio data.

{
"event": "start"
} 2. Audio Data (Binary)
Format: Raw PCM audio data
Encoding: 16-bit little-endian
Sample Rate: 16 kHz
Channels: Mono (1 channel)
Message Type: Binary WebSocket frame
Server Processing: The server automatically converts 16-bit PCM to float32 for the ASR model
Example usage in JavaScript:

// Assuming audioBuffer contains raw PCM data
const audioData = new Int16Array(audioBuffer);
websocket.send(audioData.buffer); 3. Flush Signal (JSON)
Processes remaining audio without closing the stream, enabling multiple Record→Stop→Record cycles.

{
"event": "flush"
} 4. End of Stream Signal (JSON)
Signals that the client has finished sending audio data and wants to end the stream.

{
"event": "end"
} 5. Close Connection (JSON)
Signals clean connection teardown with proper cleanup.

{
"event": "close"
} 6. Configuration Message (JSON) - Optional
Allows the client to configure transcription parameters.

{
"event": "config",
"n_best": 5
}
Parameters: - n_best (integer, optional): Number of alternative transcriptions to return. Default is 1.

Server → Client Messages (JSON)
All server responses are JSON-formatted messages containing transcription results, events, or error information.

1. Stream Started Confirmation
   Confirms that a new stream has been created successfully.

{
"event": "stream_started"
} 2. Partial Transcription
Sent during active transcription to provide real-time feedback.

{
"text": "partial transcription text here",
"is_final": false
}
Fields: - text (string): The current partial transcription - is_final (boolean): Always false for partial results

3. Flushing Signal
   Indicates the server is processing remaining audio after a flush event.

{
"event": "flushing"
} 4. Flush Complete
Sent after processing remaining audio with final transcription result.

{
"event": "flush_complete",
"alternatives": [
{
"text": "final transcription text after flush",
"confidence": 0.95
}
],
"is_final": true,
"duration": 2.1
} 5. Final Transcription
Sent when a complete utterance or segment has been transcribed.

{
"alternatives": [
{
"text": "final transcription text",
"confidence": 0.95
},
{
"text": "alternative transcription",
"confidence": 0.87
}
],
"is_final": true,
"duration": 3.24
}
Fields: - alternatives (array): List of transcription alternatives, ordered by confidence - text (string): The transcribed text - confidence (float, optional): Confidence score between 0 and 1 - is_final (boolean): Always true for final results - duration (float): Duration of the transcribed audio segment in seconds

6. Connection Closed Confirmation
   Confirms clean connection shutdown with proper cleanup.

{
"event": "connection_closed"
} 7. Error Message
Sent when an error occurs during processing.

{
"error": "Error description message"
}
Fields: - error (string): Human-readable error description

Example Communication Flow
sequenceDiagram
participant Client
participant Server

    Client->>Server: WebSocket connection established
    Client->>Server: {"event": "start"}
    Server->>Client: {"event": "stream_started"}
    Client->>Server: {"event": "config", "n_best": 3}
    Client->>Server: Binary audio data (chunk 1)
    Server->>Client: {"text": "Hello", "is_final": false}
    Client->>Server: Binary audio data (chunk 2)
    Server->>Client: {"text": "Hello world", "is_final": false}
    Client->>Server: {"event": "flush"}
    Server->>Client: {"event": "flushing"}
    Server->>Client: {"event": "flush_complete", "alternatives": [...], "is_final": true}

    Note over Client,Server: Server deactivates stream after flush_complete
    Note over Client,Server: Multiple Record→Stop→Record cycles possible

    Client->>Server: {"event": "start"}
    Server->>Client: {"event": "stream_started"}
    Client->>Server: Binary audio data (more chunks)
    Server->>Client: {"text": "More text", "is_final": false}
    Client->>Server: {"event": "end"}
    Server->>Client: {"alternatives": [{"text": "Final text", "confidence": 0.98}], "is_final": true}
    Client->>Server: {"event": "close"}
    Server->>Client: {"event": "connection_closed"}

Implementation Notes for SvelteKit Developers
Client-Side Implementation
Audio Capture: Use the Web Audio API or MediaRecorder API to capture audio from the user's microphone.

Audio Processing: Convert captured audio to 16-bit PCM format at 16 kHz mono before sending.

WebSocket Management: ```javascript const ws = new WebSocket('ws://server-address/ws/asr');

ws.onopen = () => { // Start a new stream (required before sending audio) ws.send(JSON.stringify({ event: 'start' })); };

ws.onmessage = (event) => { const message = JSON.parse(event.data); if (message.error) { // Handle error } else if (message.event === 'stream_started') { // Stream ready, can now send audio and config ws.send(JSON.stringify({ event: 'config', n_best: 3 })); } else if (message.event === 'flush_complete') { // Handle flush result, can start new recording session } else if (message.event === 'connection_closed') { // Connection properly closed } else if (message.is_final) { // Handle final transcription } else { // Handle partial transcription } };

// For multiple recording sessions without reconnection const startNewRecording = () => { ws.send(JSON.stringify({ event: 'flush' })); // Wait for flush_complete event, then send new start event before new audio };

// Clean shutdown const closeConnection = () => { ws.send(JSON.stringify({ event: 'close' })); }; ```

Streaming Audio: Send audio chunks as they become available for real-time processing.

Error Handling: Implement reconnection logic and user feedback for connection issues.

Best Practices
Stream Lifecycle: Always send {"event": "start"} after connection and wait for {"event": "stream_started"} before sending audio.

Multiple Sessions: Use {"event": "flush"} for Record→Stop→Record cycles instead of reconnecting. Important: After flush_complete, you must send a new {"event": "start"} and wait for {"event": "stream_started"} before sending more audio.

Chunking: Send audio in reasonable chunks (e.g., 100-500ms of audio data) to balance latency and efficiency.

Buffering: Implement client-side buffering to handle network fluctuations.

State Management: Track connection state and transcription state in your SvelteKit store.

User Feedback: Display partial transcriptions to provide immediate feedback to users.

Clean Shutdown: Always send {"event": "close"} and wait for {"event": "connection_closed"} before closing WebSocket.

Error Prevention: Never send audio data without an active stream (after start event). Remember that flush_complete deactivates the stream, requiring a new start event.

Error Handling
Common error scenarios and recommended handling:

Connection Errors: Implement exponential backoff for reconnection attempts.
Audio Format Errors: Validate audio format before sending to avoid server-side errors.
Timeout Handling: Implement client-side timeouts for transcription responses.
Network Interruptions: Buffer audio locally during brief disconnections.
Security Considerations
Use WSS (WebSocket Secure) in production environments
Implement authentication tokens in connection headers or initial handshake
Validate message sizes to prevent abuse
Rate limiting should be implemented on the server side
