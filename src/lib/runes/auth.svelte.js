import { browser } from '$app/environment';

/**
 * @file auth.svelte.js (Session Sync & Runtime Defense v3.0)
 * @description [v3.0] Svelte 5 룬 기반 인증 상태 관리. 로컬스토리지와 서버 데이터를 동기화하여 깜빡임 방지.
 */
class AuthState {
	// 📌 유저 정보 상태 (로컬스토리지에서 초기값 로드 시도)
	user = $state(null);
	isAuthenticated = $derived(!!this.user);

	constructor() {}

	/**
	 * ✅ [초기화] 클라이언트 사이드에서 초기 실행 시 호출
	 */
	init() {
		if (browser) {
			try {
				const storedUser = localStorage.getItem('auth_user');
				if (storedUser) {
					this.user = JSON.parse(storedUser);
					console.log('👤 [AuthState] Hydrated from localStorage:', this.user.username);
				}
			} catch (err) {
				console.error('❌ [AuthState] LocalStorage Sync Error:', err);
			}
		}
	}

	/**
	 * 사용자 정보 주입 및 로컬스토리지 동기화
	 */
	setUser(userData) {
		this.user = userData;
		if (browser) {
			if (userData) {
				localStorage.setItem('auth_user', JSON.stringify(userData));
				console.log('👤 [AuthState] User Synced:', userData.username);
			} else {
				localStorage.removeItem('auth_user');
				console.log('👤 [AuthState] User Cleared.');
			}
		}
	}

	/**
	 * 인증 해제 (로그아웃 등)
	 */
	clear() {
		this.user = null;
		if (browser) {
			localStorage.removeItem('auth_user');
			console.log('👤 [AuthState] Context & Storage Cleared.');
		}
	}
}

export const auth = new AuthState();
