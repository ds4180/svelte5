// svelte5/src/lib/websocket.js
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

class WebSocketService {
    #ws = null;
    #messageListeners = [];
    #reconnectAttempts = 0;
    #maxReconnectAttempts = 10;
    #reconnectTimeout = 1000; // Initial reconnect delay

    // Svelte store to provide connection status and messages
    connectionStatus = writable('disconnected');
    messages = writable([]);

    constructor() {
        if (browser) {
            this.connect();
        }
    }

    connect() {
        if (this.#ws && (this.#ws.readyState === WebSocket.OPEN || this.#ws.readyState === WebSocket.CONNECTING)) {
            console.log('WebSocket already connected or connecting.');
            return;
        }

        this.connectionStatus.set('connecting');
        const wsUrl = window.location.origin.replace('http', 'ws') + '/ws';
        this.#ws = new WebSocket(wsUrl);

        this.#ws.onopen = () => {
            console.log('WebSocket connected.');
            this.connectionStatus.set('connected');
            this.#reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        };

        this.#ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            
            // Handle server pings
            if (message && message.type === 'ping') {
                console.log('Received WebSocket ping from server, sending pong.');
                this.send({ type: 'pong' });
                return; // Do not process ping as a regular message
            }

            this.messages.update(msgs => [...msgs, message]);
            this.#messageListeners.forEach(listener => listener(message));
        };

        this.#ws.onclose = (event) => {
            console.log('WebSocket disconnected:', event.code, event.reason);
            this.connectionStatus.set('disconnected');
            this.#reconnect();
        };

        this.#ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.connectionStatus.set('error');
            this.#ws.close(); // Force close to trigger onclose and #reconnect
        };
    }

    #reconnect() {
        if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
            this.#reconnectAttempts++;
            const delay = this.#reconnectTimeout * Math.pow(2, this.#reconnectAttempts - 1); // Exponential backoff
            console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.#reconnectAttempts})...`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.error('Max reconnect attempts reached. Could not establish WebSocket connection.');
            this.connectionStatus.set('failed');
        }
    }

    send(message) {
        if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
            this.#ws.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket not open. Message not sent:', message);
            // Optionally queue messages for sending once connected
        }
    }

    // Allow components to subscribe to raw messages if needed
    addMessageListener(listener) {
        this.#messageListeners.push(listener);
        return () => {
            this.#messageListeners = this.#messageListeners.filter(l => l !== listener);
        };
    }

    // Cleanup on component destroy or when service is no longer needed
    disconnect() {
        if (this.#ws) {
            this.#ws.close();
            this.#ws = null;
        }
    }
}

// Export a singleton instance
export const websocket = new WebSocketService();
