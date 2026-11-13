/**
 * ============================================================================
 * [시스템 기본 알림 엔진 (lib/runes/toast.svelte.ts)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 사내 업무 소통/공지용 알림 앱(Alert)과 완전히 분리된 '시스템 기본 알림(Toast)' 상태 엔진입니다.
 * 
 * 🌟 분리 목적:
 * 1. API 500 오류, 네트워크 실패, 폼 검증 에러 등은 사내 공지가 아닙니다.
 *    따라서 거대한 모달이나 전역 공지 배너가 아닌, 화면 모서리의 가벼운 토스트로 표출합니다.
 * 2. 3초 뒤에 조용히 자동 소멸되어 사용자의 업무 집중을 방해하지 않습니다.
 * 3. Svelte 5의 최신 `$state` 룬을 기반으로 반응형 UI와 초고속 동기화됩니다.
 */

import { normalizeErrorMessage } from '$lib/utils/error';

export interface ToastItem {
	id: string;
	message: string;
	type: 'info' | 'success' | 'warning' | 'error';
	duration: number; // 밀리초(ms) 단위 노출 시간
}

class ToastState {
	// 📌 현재 화면에 떠 있는 토스트 목록 ($state 룬)
	items = $state<ToastItem[]>([]);

	// 🛡️ 권한 거부(403) 디바운스 및 2차 연쇄 에러 자동 진압용 타임스탬프
	private lastAuthErrorTime = 0;

	/**
	 * 기본 알림 표시 공통 메서드
	 * @param rawMessage 표시할 메시지
	 * @param type 알림 성격 ('info' | 'success' | 'warning' | 'error')
	 * @param duration 유지 시간 (기본 3500ms = 3.5초)
	 */
	show(rawMessage: unknown, type: ToastItem['type'] = 'info', duration: number = 3500): string {
		// '[object Object]'가 단독 또는 비문자열 형태로 전달될 경우 공백 처리해 방어합니다.
		const message = normalizeErrorMessage(rawMessage);
		if (!message) return '';
		const now = Date.now();
		const isAuthError = message.includes('권한이 없습니다') || message.includes('권한 없음');

		// 🛡️ [방어 1]: 권한 오류 토스트 2초 이내 중복 발생 차단 (여러 API 동시 403 대응)
		if (isAuthError) {
			if (now - this.lastAuthErrorTime < 2000) {
				return ''; // 중복 무시
			}
			this.lastAuthErrorTime = now;
		}

		// 🛡️ [방어 2]: 권한 오류 직후(1.5초 내) 컴포넌트 catch 블록에서 날아오는
		//             2차 연쇄 에러("조회 실패", "로드 실패" 등)는 화면을 어지럽히지 않도록 자동 진압
		if (type === 'error' && now - this.lastAuthErrorTime < 1500) {
			console.warn(`[Toast Suppressed] 403 권한 차단 후속 에러 자동 진압: "${message}"`);
			return '';
		}

		// 🛡️ [방어 3]: 현재 화면에 이미 완전히 동일한 메시지가 떠 있다면 중복 추가 방지
		if (this.items.some((item) => item.message === message)) {
			return '';
		}

		const id = Math.random().toString(36).substring(2, 9);
		const newItem: ToastItem = {
			id,
			message,
			type,
			duration
		};

		// 최신 토스트를 큐에 추가 (최대 5개 동시 노출 제한으로 화면 가림 방지)
		this.items = [...this.items, newItem].slice(-5);

		// 지정된 시간(duration) 경과 후 자동 소멸
		if (duration > 0 && typeof window !== 'undefined') {
			setTimeout(() => {
				this.remove(id);
			}, duration);
		}

		return id;
	}

	/**
	 * 특정 토스트 수동 제거
	 * @param id 토스트 고유 아이디
	 */
	remove(id: string) {
		this.items = this.items.filter((item) => item.id !== id);
	}

	/**
	 * [정보] 일반 안내 알림 (파란색)
	 */
	info(message: unknown, duration?: number): string {
		return this.show(message, 'info', duration);
	}

	/**
	 * [성공] 작업 완료 알림 (초록색)
	 */
	success(message: unknown, duration?: number): string {
		return this.show(message, 'success', duration);
	}

	/**
	 * [경고] 주의 필요 알림 (노란색/주황색)
	 */
	warning(message: unknown, duration?: number): string {
		return this.show(message, 'warning', duration);
	}

	/**
	 * [에러] 시스템 오류 / 네트워크 실패 알림 (빨간색)
	 */
	error(message: unknown, duration?: number): string {
		return this.show(message, 'error', duration ?? 4500); // 에러는 인지 시간을 위해 조금 더 길게(4.5초)
	}

	/**
	 * 전체 토스트 일괄 정리
	 */
	clear() {
		this.items = [];
	}
}

// 🌐 시스템 전역에서 단일 import로 편리하게 사용할 수 있는 싱글톤 인스턴스
export const toast = new ToastState();
export default toast;
