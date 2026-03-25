import { writable } from 'svelte/store';
import { browser } from '$app/environment';

// 브라우저 초기화 시점에만 localStorage 확인하여 즉시 초기값 설정
const initialAccessToken = browser ? localStorage.getItem('accessToken') : null;
const initialRefreshToken = browser ? localStorage.getItem('refreshToken') : null;
const initialAuth = !!initialAccessToken;

export const authStore = writable({
    accessToken: initialAccessToken,
    refreshToken: initialRefreshToken,
    isAuthenticated: initialAuth,
    user: null
});

// localStorage에서 초기 토큰 값 로드 및 store 초기화 함수
export function initializeAuthStore() {
    if (browser) { // 브라우저 환경에서만 localStorage 접근
        const initialToken = localStorage.getItem('accessToken');
        const initialRefreshToken = localStorage.getItem('refreshToken');
        authStore.update(state => ({
            ...state,
            accessToken: initialToken,
            refreshToken: initialRefreshToken,
            isAuthenticated: !!initialToken,
        }));
        // User data might need to be fetched separately or stored elsewhere if persistent
        // For now, user data might be null until fetched after login/refresh
    }
}

// 토큰을 저장하고 store 업데이트하는 함수
export function setTokens(accessToken, refreshToken) {
    if (browser) {
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', refreshToken);
        // 서버 훅이 새로고침 시 읽을 수 있도록 쿠키 설정 (액세스 5분, 리프레시 3일)
        document.cookie = `accessToken=${accessToken}; path=/; max-age=300; SameSite=Lax;`;
        document.cookie = `refreshToken=${refreshToken}; path=/; max-age=259200; SameSite=Lax;`;
    }
    authStore.update(state => ({
        ...state,
        accessToken: accessToken,
        refreshToken: refreshToken,
        isAuthenticated: true
    }));
}

export function clearTokens() {
    if (browser) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        // 쿠키 삭제
        document.cookie = "accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
        document.cookie = "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
    }
    authStore.update(state => ({
        ...state,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        user: null
    }));
}

// 사용자 정보를 store에 설정하는 함수
export function setUser(userData) {
    authStore.update(state => ({
        ...state,
        user: userData
    }));
}

// (추후 구현) 토큰 갱신 로직
// export async function refreshAuthToken() { ... }
