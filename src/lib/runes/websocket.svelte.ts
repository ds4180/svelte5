import { browser } from '$app/environment';

/**
 * ============================================================================
 * [전사 실시간 웹소켓 매니저 (src/lib/runes/websocket.svelte.ts) v2.0]
 * ============================================================================
 *
 * 💡 핵심 아키텍처 개선사항:
 * 1. [재연결 폭주 원천 차단]:
 *    - `#reconnectTimer` 단일 타이머 관리로 중복 `setTimeout` 스케줄링 방지
 *    - `disconnect()` 호출 시 `#isIntentionalClose = true` 플래그 및 타이머 즉시 파기로 좀비 재연결 차단
 *    - 백엔드 `1008` (Policy Violation: 비로그인/세션만료) 수신 시 무의미한 재연결 루프 즉시 중단
 * 2. [메시지 유실 방지 큐 (#sendQueue)]:
 *    - 소켓이 `CONNECTING` 상태일 때 발송된 메시지를 버리지 않고 큐에 보관했다가 `onopen` 즉시 순차 전송
 * 3. [스마트 네트워크/화면 복귀 감지]:
 *    - 모바일 백그라운드 전환 후 복귀(`visibilitychange`) 또는 네트워크 재연결(`online`) 시 끊긴 소켓 즉시 복구
 * 4. [중복 리스너 방지]:
 *    - `addMessageListener(fn, key)`에 선택적 고유 `key`를 지원하여 HMR 및 컴포넌트 재마운트 시 중복 등록 방지
 */

export type WebSocketStatus =
	| 'disconnected'
	| 'connecting'
	| 'connected'
	| 'error'
	| 'unauthorized'
	| 'failed';

export type WebSocketMessageListener = (msg: any) => void;

class WebSocketService {
	#ws: WebSocket | null = null;
	#reconnectAttempts = 0;
	#maxReconnectAttempts = 10;
	#reconnectTimeout = 1000;
	#reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	#isIntentionalClose = false;
	#lifecycleBound = false;

	/** 고유 key 기반 리스너 맵 (HMR/컴포넌트 중복 등록 방지) */
	#keyedListeners = new Map<string, WebSocketMessageListener>();
	/** 익명 리스너 셋 (기존 호환성 유지) */
	#anonymousListeners = new Set<WebSocketMessageListener>();

	/** 연결 수립 중 발송 요청된 메시지 임시 대기열 */
	#sendQueue: string[] = [];

	// 룬 기반 반응형 상태
	status = $state<WebSocketStatus>('disconnected');
	messages = $state<any[]>([]);

	/**
	 * 🚀 웹소켓 매니저 초기화 (클라이언트 마운트 시 호출)
	 */
	init(): void {
		if (!browser) return;

		if (!this.#lifecycleBound) {
			this.#lifecycleBound = true;

			window.addEventListener('online', () => {
				if (!this.#isIntentionalClose && this.status !== 'unauthorized') {
					if (!this.#ws || this.#ws.readyState === WebSocket.CLOSED) {
						this.#reconnectAttempts = 0;
						this.connect();
					}
				}
			});

			document.addEventListener('visibilitychange', () => {
				if (
					document.visibilityState === 'visible' &&
					navigator.onLine &&
					!this.#isIntentionalClose &&
					this.status !== 'unauthorized'
				) {
					if (!this.#ws || this.#ws.readyState === WebSocket.CLOSED) {
						this.#reconnectAttempts = 0;
						this.connect();
					}
				}
			});
		}

		this.connect();
	}

	/**
	 * 🔌 서버 웹소켓(/ws) 연결 수립
	 */
	connect(): void {
		if (!browser) return;

		if (
			this.#ws &&
			(this.#ws.readyState === WebSocket.OPEN || this.#ws.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		this.#isIntentionalClose = false;
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}

		this.status = 'connecting';
		const wsUrl = window.location.origin.replace('http', 'ws') + '/ws';
		this.#ws = new WebSocket(wsUrl);

		this.#ws.onopen = () => {
			console.log('🌐 [WS] 실시간 웹소켓 채널 연결 성공 (/ws)');
			this.status = 'connected';
			this.#reconnectAttempts = 0;

			while (this.#sendQueue.length > 0 && this.#ws && this.#ws.readyState === WebSocket.OPEN) {
				const rawPayload = this.#sendQueue.shift();
				if (rawPayload) {
					try {
						this.#ws.send(rawPayload);
					} catch (e) {
						console.error('❌ [WS] 대기 큐 메시지 전송 오류:', e);
					}
				}
			}
		};

		this.#ws.onmessage = (event: MessageEvent) => {
			try {
				const message = JSON.parse(event.data);

				if (message && message.type === 'ping') {
					this.send({ type: 'pong' });
					return;
				}

				this.messages = [...this.messages, message].slice(-100);

				for (const listener of this.#keyedListeners.values()) {
					try {
						listener(message);
					} catch (e) {
						console.error('❌ [WS] Keyed 리스너 콜백 실행 오류:', e);
					}
				}

				for (const listener of this.#anonymousListeners) {
					try {
						listener(message);
					} catch (e) {
						console.error('❌ [WS] 리스너 콜백 실행 오류:', e);
					}
				}
			} catch (err) {
				console.error('❌ [WS] 메시지 파싱 오류:', err);
			}
		};

		this.#ws.onclose = (event: CloseEvent) => {
			console.log(`🌐 [WS] 연결 종료 감지 (코드: ${event.code}, 사유: ${event.reason || '없음'})`);

			if (this.#isIntentionalClose || event.code === 1000) {
				this.status = 'disconnected';
				return;
			}

			if (event.code === 1008) {
				console.warn(
					'🔒 [WS] 비로그인 또는 만료된 세션으로 백엔드에서 소켓 접근을 거부했습니다. (1008)'
				);
				this.status = 'unauthorized';
				this.#sendQueue = [];
				return;
			}

			this.status = 'disconnected';
			this.#reconnect();
		};

		this.#ws.onerror = (error: Event) => {
			console.error('🌐 [WS] 웹소켓 에러 발생:', error);
			this.status = 'error';
		};
	}

	/**
	 * 🔄 지수 백오프(Exponential Backoff) 기반 안전 재연결
	 */
	#reconnect(): void {
		if (this.#isIntentionalClose) return;

		if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
			this.#reconnectAttempts++;
			const delay = this.#reconnectTimeout * Math.pow(2, this.#reconnectAttempts - 1);
			console.log(
				`🌐 [WS] 네트워크 복구 대기 중... (${this.#reconnectAttempts}/${this.#maxReconnectAttempts}회 시도, ${delay}ms 후 재연결)`
			);

			if (this.#reconnectTimer) clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = setTimeout(() => {
				this.#reconnectTimer = null;
				this.connect();
			}, delay);
		} else {
			console.error('❌ [WS] 최대 재연결 시도 횟수를 초과했습니다.');
			this.status = 'failed';
		}
	}

	/**
	 * 📤 실시간 메시지 발송 (CONNECTING 상태일 때는 #sendQueue에 보관 후 연결 즉시 자동 발송)
	 */
	send(message: any): void {
		if (!browser) return;
		const serialized = JSON.stringify(message);

		if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
			this.#ws.send(serialized);
			return;
		}

		if (message && message.type === 'pong') return;

		if (this.#sendQueue.length >= 50) {
			this.#sendQueue.shift();
		}
		this.#sendQueue.push(serialized);
		this.connect();
	}

	/**
	 * 👂 메시지 수신 리스너 등록 (해제 함수 반환)
	 */
	addMessageListener(listener: WebSocketMessageListener, key?: string): () => void {
		if (key) {
			this.#keyedListeners.set(key, listener);
			return () => {
				if (this.#keyedListeners.get(key) === listener) {
					this.#keyedListeners.delete(key);
				}
			};
		}

		this.#anonymousListeners.add(listener);
		return () => {
			this.#anonymousListeners.delete(listener);
		};
	}

	/**
	 * 🛑 [안전 자원 반납] 로그아웃 또는 세션 종료 시 호출
	 */
	disconnect(): void {
		this.#isIntentionalClose = true;
		this.#sendQueue = [];

		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}

		this.#reconnectAttempts = 0;

		if (this.#ws) {
			try {
				this.#ws.close(1000, 'Client intentional disconnect');
			} catch {
				// 이미 닫힌 소켓 무시
			}
			this.#ws = null;
		}

		this.status = 'disconnected';
		console.log('🔒 [WS] 웹소켓 자원이 안전하게 정상 해제되었습니다.');
	}
}

export const websocket = new WebSocketService();
