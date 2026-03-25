import { browser } from '$app/environment';

/**
 * 사용자 인증 상태를 관리하는 Rune 클래스 (에러 방어 강화 버전)
 */
class AuthState {
    accessToken = $state(null);
    refreshToken = $state(null);
    user = $state(null);

    isAuthenticated = $derived(!!this.accessToken);

    constructor() {
        // ⚠️ 생성자에서는 더 이상 localStorage에 접근하지 않습니다. (서버 정합성 확보)
    }

    /**
     * @function init
     * @description 하이드레이션 완료 후 클라이언트 사이드에서 상태를 복구합니다.
     */
    init() {
        if (browser) {
            try {
                this.accessToken = localStorage.getItem('accessToken');
                this.refreshToken = localStorage.getItem('refreshToken');
                console.log("👤 [AuthState] Storage Restored (Token:", !!this.accessToken, ")");
            } catch (e) {
                console.error("❌ [AuthState] Failed to access localStorage:", e.message);
            }
        }
    }

    setTokens(access, refresh) {
        this.accessToken = access;
        this.refreshToken = refresh;

        if (browser) {
            try {
                localStorage.setItem('accessToken', access);
                localStorage.setItem('refreshToken', refresh);
            } catch (e) {
                console.error("❌ [AuthState] Storage Write Fail:", e.message);
            }
        }
    }

    clearTokens() {
        this.accessToken = null;
        this.refreshToken = null;
        this.user = null;

        if (browser) {
            try {
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
                document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            } catch (e) {
                console.error("❌ [AuthState] Storage Clear Fail:", e.message);
            }
        }
    }

    setUser(userData) {
        this.user = userData;
    }
}

export const auth = new AuthState();
