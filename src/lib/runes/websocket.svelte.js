// svelte5/src/lib/runes/websocket.svelte.js
import { browser } from '$app/environment';

/**
 * ============================================================================
 * [Svelte 5 Rune 기반 전역 실시간 웹소켓 서비스 (lib/runes/websocket.svelte.js)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 백엔드 실시간 웹소켓(/ws) 채널과 통신하여 전사 긴급 공지, 배차 변경 알림, 
 * 미니앱 신호를 지연 없이(0.1초 미만) 수신하고 반응형($state)으로 UI에 전달합니다.
 * 
 * 🌟 핵심 라이프사이클 및 보안 격리 규칙:
 * 1. [세션 1:1 동기화]: 로그인된 유저 세션에서만 연결되며, 로그아웃 시 즉시 자원을 반납(disconnect)합니다.
 * 2. [인증 거부 스마트 감지 (1008 Policy Violation)]:
 *    - 백엔드가 세션 만료나 비로그인을 이유로 1008 코드로 소켓을 닫으면, 무의미한 재연결 루프를 즉시 중단합니다.
 * 3. [지수 백오프 자동 복구 (Exponential Backoff)]:
 *    - 일시적 네트워크 끊김이나 서버 재부팅 시에만 1초 ➔ 2초 ➔ 4초 ... 단계적으로 안전하게 재연결합니다.
 * 4. [타이머 누수 원천 차단]:
 *    - disconnect() 호출 시 백그라운드 재연결 타이머(clearTimeout)를 즉시 파기합니다.
 */
class WebSocketService {
	#ws = null;
	#messageListeners = [];
	#reconnectAttempts = 0;
	#maxReconnectAttempts = 10;
	#reconnectTimeout = 1000;
	#reconnectTimer = null;          // 지수 백오프 타이머 ID (누수 방지용)
	#isIntentionalClose = false;     // 의도적 종료(로그아웃 등) 플래그

	// 📌 Svelte 5 룬 기반 반응형 상태
	status = $state('disconnected'); // 'disconnected' | 'connecting' | 'connected' | 'error' | 'unauthorized' | 'failed'
	messages = $state([]);

	constructor() {}

	/**
	 * ✅ [초기화 및 연결 시작]
	 * 브라우저 환경에서만 소켓을 생성하며, 이미 연결 중이거나 연결된 경우 중복 생성을 방지합니다.
	 */
	init() {
		if (browser) {
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
				this.#messageListeners.forEach((listener) => {
					try {
						listener(message);
					} catch (e) {
						console.error('❌ [WS] 리스너 콜백 실행 오류:', e);
					}
				});
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
				return;
			}

			// 🛡️ [규칙 3]: 그 외 비정상 네트워크 끊김이나 서버 재부팅 시에만 지수 백오프 재연결 수행
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
	 * 📤 실시간 메시지 발송
	 */
	send(message) {
		if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
			this.#ws.send(JSON.stringify(message));
		} else {
			console.warn('⚠️ [WS] 소켓이 열려있지 않아 메시지를 전송하지 못했습니다.');
		}
	}

	/**
	 * 👂 메시지 수신 리스너 등록 (해제 함수 반환)
	 */
	addMessageListener(listener) {
		this.#messageListeners.push(listener);
		return () => {
			this.#messageListeners = this.#messageListeners.filter((l) => l !== listener);
		};
	}

	/**
	 * 🛑 [안전 자원 반납] 로그아웃 또는 세션 종료 시 호출
	 */
	disconnect() {
		this.#isIntentionalClose = true;

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
