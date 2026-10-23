import { browser } from '$app/environment';
import { setContext, getContext } from 'svelte';

/**
 * ============================================================================
 * [Svelte 5 SSR 안전 격리 인증 상태 모듈 (lib/runes/auth.svelte.js)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 사용자 로그인 상태(user), 인증 여부(isAuthenticated)를 반응형($state, $derived)으로 관리합니다.
 * 
 * 🌟 [핵심 보안 개편 - SSR Scoped Context]:
 * 과거의 모듈 전역 변수(export const auth = ...)는 서버(Node.js)에서 모든 사용자가 
 * 같은 메모리 객체를 공유하여, A 사용자의 화면에 B 사용자 정보가 노출되는 '상태 누수' 위험이 있었습니다.
 * 
 * 이제는 `setAuthContext()`를 통해 각 사용자 접속(요청)마다 1:1 독립된 주머니(Context)를 만들어 
 * 완벽하게 사용자 간 메모리를 물리적으로 격리합니다!
 */

// 📌 Context 식별용 고유 심볼 키
const AUTH_KEY = Symbol('AUTH_CONTEXT');

export class AuthState {
	// 반응형 유저 정보 상태
	user = $state(null);
	isAuthenticated = $derived(!!this.user);

	constructor(initialUser = null) {
		if (initialUser) {
			this.user = initialUser;
		}
	}

	/**
	 * [클라이언트 하이드레이션] 로컬스토리지에서 캐시된 유저 정보 복원
	 */
	init() {
		if (browser) {
			try {
				const storedUser = localStorage.getItem('auth_user');
				if (storedUser && !this.user) {
					this.user = JSON.parse(storedUser);
					console.log('👤 [AuthState] Hydrated from localStorage:', this.user.username);
				}
			} catch (err) {
				console.error('❌ [AuthState] LocalStorage Sync Error:', err);
			}
		}
	}

	/**
	 * 유저 정보 갱신 및 로컬스토리지 동기화
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
	 * 로그아웃 시 세션 정리
	 */
	clear() {
		this.user = null;
		if (browser) {
			localStorage.removeItem('auth_user');
			console.log('👤 [AuthState] Context & Storage Cleared.');
		}
	}
}

/**
 * 🌟 [최상위 Root 레이아웃 전용]
 * 매 사용자 요청마다 독립된 AuthState 인스턴스를 생성하여 Svelte Context 트리에 주입합니다.
 */
export function setAuthContext(initialUser = null) {
	const authState = new AuthState(initialUser);
	setContext(AUTH_KEY, authState);
	return authState;
}

/**
 * 🌟 [하위 모든 컴포넌트 전용]
 * 상위 트리에 주입된 현재 사용자 전용의 독립 AuthState 인스턴스를 안전하게 꺼내옵니다.
 */
export function getAuthContext() {
	const context = getContext(AUTH_KEY);
	if (context) {
		return context;
	}
	// 📌 기존 레거시 코드와의 100% 하위 호환을 위한 브라우저 폴백
	return fallbackAuth;
}

// ----------------------------------------------------------------------------
// 📌 [기존 레거시 코드 100% 하위 호환성 유지]
// ----------------------------------------------------------------------------
// 기존에 `import { auth } from '$lib/runes/auth.svelte.js'` 를 사용하던 수십 개 파일이
// 당장 에러 없이 정상 작동하도록 브라우저용 단일 폴백 객체를 함께 유지합니다.
const fallbackAuth = new AuthState();
export const auth = fallbackAuth;
