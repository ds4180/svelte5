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

export interface ToastItem {
	id: string;
	message: string;
	type: 'info' | 'success' | 'warning' | 'error';
	duration: number; // 밀리초(ms) 단위 노출 시간
}

class ToastState {
	// 📌 현재 화면에 떠 있는 토스트 목록 ($state 룬)
	items = $state<ToastItem[]>([]);

	/**
	 * 기본 알림 표시 공통 메서드
	 * @param message 표시할 메시지
	 * @param type 알림 성격 ('info' | 'success' | 'warning' | 'error')
	 * @param duration 유지 시간 (기본 3500ms = 3.5초)
	 */
	show(message: string, type: ToastItem['type'] = 'info', duration: number = 3500): string {
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
	info(message: string, duration?: number): string {
		return this.show(message, 'info', duration);
	}

	/**
	 * [성공] 작업 완료 알림 (초록색)
	 */
	success(message: string, duration?: number): string {
		return this.show(message, 'success', duration);
	}

	/**
	 * [경고] 주의 필요 알림 (노란색/주황색)
	 */
	warning(message: string, duration?: number): string {
		return this.show(message, 'warning', duration);
	}

	/**
	 * [에러] 시스템 오류 / 네트워크 실패 알림 (빨간색)
	 */
	error(message: string, duration?: number): string {
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
