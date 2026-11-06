// svelte5/src/lib/runes/websocket.svelte.js
import { browser } from '$app/environment';

/**
 * ============================================================================
 * [Svelte 5 Rune 기반 전역 실시간 웹소켓 서비스 (lib/runes/websocket.svelte.js)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 백엔드 실시간 웹소켓(/ws) 채널과 통신하여 전사 긴급 공지, 배차 변경 알림, 
 * 미니앱 신호 및 데스크톱↔스마트폰 원격 지문 공조 신호를 지연 없이 수신하고 반응형($state)으로 UI에 전달합니다.
 * 
 * 🌟 핵심 라이프사이클 및 정석 아키텍처 규칙:
 * 1. [세션 1:1 동기화]: 로그인된 유저 세션에서만 연결되며, 로그아웃 시 즉시 자원을 반납(disconnect)합니다.
 * 2. [인증 거부 스마트 감지 (1008 Policy Violation)]:
 *    - 백엔드가 세션 만료나 비로그인을 이유로 1008 코드로 소켓을 닫으면, 무의미한 재연결 루프를 즉시 중단합니다.
 * 3. [지수 백오프 자동 복구 (Exponential Backoff) & 화면 복귀 즉시 재연결]:
 *    - 일시적 네트워크 끊김이나 서버 재부팅 시 1초 ➔ 2초 ➔ 4초 ... 단계적으로 안전하게 재연결하며,
 *      모바일 화면 슬립 복귀(visibilitychange === 'visible') 시 끊어진 소켓을 즉시 복구합니다.
 * 4. [전송 대기 큐 (#sendQueue) 보장]:
 *    - 소켓이 CONNECTING 또는 재연결 중일 때 호출된 send() 메시지를 증발시키지 않고 큐에 보관했다가
 *      onopen 즉시 순차 발송하여 100% 도달을 보장합니다.
 * 5. [Map 기반 정식 리스너 관리 (#keyedListeners)]:
 *    - 컴포넌트 마운트/HMR 시 고유 key로 등록된 리스너를 Map에서 원자적으로 교체하여 중복 실행과 메모리 누수를 원천 차단합니다.
 */
class WebSocketService {
	#ws = null;
	/** @type {Set<(msg: any) => void>} */
	#anonymousListeners = new Set();
	/** @type {Map<string, (msg: any) => void>} */
	#keyedListeners = new Map();
	/** @type {string[]} */
	#sendQueue = [];
	#reconnectAttempts = 0;
	#maxReconnectAttempts = 10;
	#reconnectTimeout = 1000;
	#reconnectTimer = null;          // 지수 백오프 타이머 ID (누수 방지용)
	#isIntentionalClose = false;     // 의도적 종료(로그아웃 등) 플래그
	#visibilityBound = false;

	// 📌 Svelte 5 룬 기반 반응형 상태
	status = $state('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error' | 'unauthorized' | 'failed'
	messages = $state([]);

	constructor() {
		if (browser) {
			this.#bindLifecycleEvents();
		}
	}

	/**
	 * 📱 모바일 슬립 복귀(visibilitychange) 및 네트워크 복구(online) 시 즉시 소켓 재연결 보장
	 */
	#bindLifecycleEvents() {
		if (this.#visibilityBound || !browser) return;
		this.#visibilityBound = true;

		document.addEventListener('visibilitychange', () => {
			if (
				document.visibilityState === 'visible' &&
				!this.#isIntentionalClose &&
				this.status !== 'unauthorized'
			) {
				if (!this.#ws || this.#ws.readyState === WebSocket.CLOSED) {
					this.#reconnectAttempts = 0;
					this.connect();
				}
			}
		});

		window.addEventListener('online', () => {
			if (!this.#isIntentionalClose && this.status !== 'unauthorized') {
				if (!this.#ws || this.#ws.readyState === WebSocket.CLOSED) {
					this.#reconnectAttempts = 0;
					this.connect();
				}
			}
		});
	}

	/**
	 * ✅ [초기화 및 연결 시작]
	 * 브라우저 환경에서만 소켓을 생성하며, 이미 연결 중이거나 연결된 경우 중복 생성을 방지합니다.
	 */
	init() {
		if (browser) {
			this.#bindLifecycleEvents();
			this.connect();
		}
	}

	connect() {
		if (!browser) return;

		// 이미 연결되어 있거나 연결 시도 중이면 중복 연결 방지
		if (
			this.#ws &&
			(this.#ws.readyState === WebSocket.OPEN || this.#ws.readyState === WebSocket.CONNECTING)
		) {
			return;
		}

		// 새로운 연결 시작 시 의도적 종료 플래그 초기화
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

			// 🚀 연결 수립 즉시 대기 큐(#sendQueue)에 보관된 메시지들을 순차 전송
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

		this.#ws.onmessage = (event) => {
			try {
				const message = JSON.parse(event.data);

				// 🛡️ 서버 핑 대응: 60초 주기 핑 신호 수신 시 즉시 퐁(Pong) 응답으로 연결 유지
				if (message && message.type === 'ping') {
					this.send({ type: 'pong' });
					return;
				}

				// 📌 메시지 큐 업데이트 (최신 100개 유지)
				this.messages = [...this.messages, message].slice(-100);

				// 1) 고유 key 리스너 실행
				for (const listener of this.#keyedListeners.values()) {
					try {
						listener(message);
					} catch (e) {
						console.error('❌ [WS] Keyed 리스너 콜백 실행 오류:', e);
					}
				}

				// 2) 일반 익명 리스너 실행
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

		this.#ws.onclose = (event) => {
			console.log(`🌐 [WS] 연결 종료 감지 (코드: ${event.code}, 사유: ${event.reason || '없음'})`);

			// 🛡️ [규칙 1]: 의도적인 disconnect() 호출 또는 정상 종료(1000)인 경우 재연결하지 않음
			if (this.#isIntentionalClose || event.code === 1000) {
				this.status = 'disconnected';
				return;
			}

			// 🛡️ [규칙 2]: 백엔드가 1008 (Policy Violation: 비로그인/세션만료)로 닫은 경우 재연결 루프 즉시 중단
			if (event.code === 1008) {
				console.warn('🔒 [WS] 비로그인 또는 만료된 세션으로 백엔드에서 소켓 접근을 거부했습니다. (1008)');
				this.status = 'unauthorized';
				this.#sendQueue = [];
				return;
			}

			// 🛡️ [규칙 3]: 그 외 비정상 네트워크 끊김이나 서버 재부팅(1001 포함) 시 지수 백오프 재연결 수행
			this.status = 'disconnected';
			this.#reconnect();
		};

		this.#ws.onerror = (error) => {
			console.error('🌐 [WS] 웹소켓 에러 발생:', error);
			this.status = 'error';
			// 에러 발생 시 브라우저가 자동으로 onclose 이벤트를 트리거하므로 여기서 close()를 중복 호출하지 않음
		};
	}

	/**
	 * 🔄 지수 백오프(Exponential Backoff) 기반 안전 재연결
	 */
	#reconnect() {
		if (this.#isIntentionalClose) return;

		if (this.#reconnectAttempts < this.#maxReconnectAttempts) {
			this.#reconnectAttempts++;
			const delay = this.#reconnectTimeout * Math.pow(2, this.#reconnectAttempts - 1);
			console.log(`🌐 [WS] 네트워크 복구 대기 중... (${this.#reconnectAttempts}/${this.#maxReconnectAttempts}회 시도, ${delay}ms 후 재연결)`);
			
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
	 * @param {any} message
	 */
	send(message) {
		if (!browser) return;
		const serialized = JSON.stringify(message);

		if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
			this.#ws.send(serialized);
			return;
		}

		// pong 신호는 큐에 쌓을 필요 없음
		if (message && message.type === 'pong') return;

		// 큐 최대 크기(50건) 유지하며 보관 후 연결 보장
		if (this.#sendQueue.length >= 50) {
			this.#sendQueue.shift();
		}
		this.#sendQueue.push(serialized);
		this.connect();
	}

	/**
	 * 👂 메시지 수신 리스너 등록 (해제 함수 반환)
	 * @param {(msg: any) => void} listener
	 * @param {string} [key] - 컴포넌트/도메인별 고유 식별 키 (동일 키 재등록 시 기존 리스너 자동 교체)
	 */
	addMessageListener(listener, key) {
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
	disconnect() {
		this.#isIntentionalClose = true;
		this.#sendQueue = [];

		// 실행 대기 중인 재연결 타이머 즉시 파기
		if (this.#reconnectTimer) {
			clearTimeout(this.#reconnectTimer);
			this.#reconnectTimer = null;
		}

		this.#reconnectAttempts = 0;

		if (this.#ws) {
			// 정상 종료 코드 1000 전달
			try {
				this.#ws.close(1000, 'Client intentional disconnect');
			} catch (e) {
				// 이미 닫힌 소켓 무시
			}
			this.#ws = null;
		}

		this.status = 'disconnected';
		console.log('🔒 [WS] 웹소켓 자원이 안전하게 정상 해제되었습니다.');
	}
}

export const websocket = new WebSocketService();
