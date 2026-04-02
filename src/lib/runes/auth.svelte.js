import { browser } from '$app/environment';

/**
 * @file auth.svelte.js (JTI/Redis v2.0 최적화 및 런타임 방어 버전)
 */
class AuthState {
    user = $state(null);
    isAuthenticated = $derived(!!this.user);

    constructor() { }

    // ✅ [복구] 최상위 레이아웃(root layout)에서 호출하는 초기화 함수
    init() {
        if (browser) {
            console.log("👤 [AuthState] Runtime Initialized.");
        }
    }

    setUser(userData) {
        this.user = userData;
        if (browser) {
            console.log("👤 [AuthState] Context Sync:", this.user?.username || 'Guest');
        }
    }

    clear() {
        this.user = null;
        if (browser) {
            console.log("👤 [AuthState] Context Cleared.");
        }
    }
}

export const auth = new AuthState();
