// svelte5/src/lib/websocket.js
import { browser } from '$app/environment';

/**
 * @file websocket.js (Svelte 5 Rune 기반 전역 웹소켓 서비스)
 * @description [v2.0] writable 스토어를 제거하고 $state 룬을 도입하여 성능 및 가독성 최적화
 */
class WebSocketService {
	#ws = null;
	#messageListeners = [];
	#reconnectAttempts = 0;
	#maxReconnectAttempts = 10;
	#reconnectTimeout = 1000;

	// 📌 Svelte 5 룬 기반 상태 관리
	status = $state('disconnected');
	messages = $state([]);

	constructor() {}

	/**
	 * ✅ [초기화] 하이드레이션 완료 후 호출 (onMount 등)
	 */
	init() {
		if (browser) {
			this.connect();
		}
	}

	connect() {
		if (
			this.#ws &&
			(this.#ws.readyState === WebSocket.OPEN || this.#ws.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		this.status = 'connecting';
		const wsUrl = window.location.origin.replace('http', 'ws') + '/ws';
		this.#ws = new WebSocket(wsUrl);

		this.#ws.onopen = () => {
			console.log('🌐 [WS] Connected.');
			this.status = 'connected';
			this.#reconnectAttempts = 0;
		};

		this.#ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);

				// 🛡️ 서버 핑 대응 (Pong 전송)
				if (message && message.type === 'ping') {
					this.send({ type: 'pong' });
					return;
				}

				// 📌 메시지 큐 업데이트 (최신 100개 유지)
				this.messages = [...this.messages, message].slice(-100);
				this.#messageListeners.forEach((listener) => listener(message));
			} catch (err) {
				console.error('❌ [WS] Message Parse Error:', err);
			}
		};

		this.#ws.onclose = (event) => {
			console.log('🌐 [WS] Disconnected:', event.code);
			this.status = 'disconnected';
			this.#reconnect();
		};

		this.#ws.onerror = (error) => {
			console.error('🌐 [WS] Error:', error);
			this.status = 'error';
			this.#ws?.close();
		};
	}

	#reconnect() {
		if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
			this.#reconnectAttempts++;
			const delay = this.#reconnectTimeout * Math.pow(2, this.#reconnectAttempts - 1);
			console.log(`🌐 [WS] Reconnecting in ${delay}ms...`);
			setTimeout(() => this.connect(), delay);
		} else {
			this.status = 'failed';
		}
	}

	send(message) {
		if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
			this.#ws.send(JSON.stringify(message));
		}
	}

	addMessageListener(listener) {
		this.#messageListeners.push(listener);
		return () => {
			this.#messageListeners = this.#messageListeners.filter((l) => l !== listener);
		};
	}

	disconnect() {
		if (this.#ws) {
			this.#ws.close();
			this.#ws = null;
		}
	}
}

export const websocket = new WebSocketService();
