import { browser } from '$app/environment';
import { setContext, getContext } from 'svelte';
import type { UserProfile, CanAccessOptions, AccessAction } from '$lib/types/user';

/**
 * ============================================================================
 * [Svelte 5 SSR 안전 격리 인증 상태 모듈 (lib/runes/auth.svelte.ts)]
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

/**
 * [JSONB 듀얼 모드 그룹 추출기 (프론트엔드)]
 * 배열 모드(['운수팀']) 및 액션별 객체 모드({ read: ['운수팀'], write: ['배차담당'] })를 지원합니다.
 */
export function extractGroupsForAction(groupData: any, action: AccessAction = 'read'): string[] {
	if (!groupData) return [];
	if (Array.isArray(groupData)) {
		return groupData.filter(Boolean);
	}
	if (typeof groupData === 'object' && groupData !== null) {
		const specific = Array.isArray(groupData[action]) ? groupData[action] : [];
		const all = Array.isArray(groupData.all) ? groupData.all : [];
		return [...specific, ...all].filter(Boolean);
	}
	if (typeof groupData === 'string' && groupData) {
		return [groupData];
	}
	return [];
}

export class AuthState {
	// 반응형 유저 정보 상태
	user = $state<UserProfile | null>(null);
	isAuthenticated = $derived(!!this.user);
	isRoot = $derived(this.user?.rank_level === 9);

	constructor(initialUser: UserProfile | null = null) {
		if (initialUser) {
			this.user = initialUser;
		}
	}

	/**
	 * 사용자의 주그룹(1개)과 부그룹(N개)을 합친 배열을 반환합니다.
	 */
	getGroups(): string[] {
		if (!this.user) return [];
		const groups = new Set<string>();
		if (this.user.primary_group) {
			groups.add(this.user.primary_group);
		}
		if (Array.isArray(this.user.secondary_groups)) {
			for (const g of this.user.secondary_groups) {
				if (g) groups.add(g);
			}
		}
		return Array.from(groups);
	}

	/**
	 * 🌟 [`정책재정의.md` 4단계 권한 판별 헬퍼 (백엔드 core/permission.py와 100% 동일한 로직)]
	 */
	canAccess({
		action = 'read',
		minReadRank = 0,
		minWriteRank = 2,
		allowGroups = [],
		denyGroups = [],
		op = '>='
	}: CanAccessOptions = {}): boolean {
		const userRank = this.user?.rank_level ?? 0;

		// [1단계] root(랭킹 9) 인가?
		if (userRank === 9) return true;

		const userGroups = this.getGroups();

		// [2단계] deny 목록에 부그룹이나 주그룹이 있는가? (Deny-Wins)
		const effectiveDeny = extractGroupsForAction(denyGroups, action);
		if (effectiveDeny.length > 0) {
			if (userGroups.some((g) => effectiveDeny.includes(g))) {
				return false;
			}
		}

		// [3단계] allow 목록에 부그룹이나 주그룹이 있는가? (Allow-Wins)
		const effectiveAllow = extractGroupsForAction(allowGroups, action);
		if (effectiveAllow.length > 0) {
			if (userGroups.some((g) => effectiveAllow.includes(g))) {
				return true;
			}
		}

		// [4단계] 앱의 읽기/쓰기 랭킹과 사용자 랭킹(0~9) 비교
		const targetRank = action === 'write' ? minWriteRank : minReadRank;
		if (op === '>=') return userRank >= targetRank;
		if (op === '>') return userRank > targetRank;
		if (op === '==') return userRank === targetRank;
		if (op === '<=') return userRank <= targetRank;
		if (op === '<') return userRank < targetRank;
		return userRank >= targetRank;
	}

	/**
	 * [클라이언트 하이드레이션] 로컬스토리지에서 캐시된 유저 정보 복원
	 */
	init(): void {
		if (browser) {
			try {
				const storedUser = localStorage.getItem('auth_user');
				if (storedUser && !this.user) {
					this.user = JSON.parse(storedUser);
					console.log('👤 [AuthState] Hydrated from localStorage:', this.user?.username);
				}
			} catch (err) {
				console.error('❌ [AuthState] LocalStorage Sync Error:', err);
			}
		}
	}

	/**
	 * 유저 정보 갱신 및 로컬스토리지 동기화
	 */
	setUser(userData: UserProfile | null): void {
		this.user = userData;
		if (browser) {
			if (this !== fallbackAuth) {
				fallbackAuth.user = userData;
			}
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
	 * 로그아웃 시 세션 정리 (토큰, 쿠키, 로컬스토리지 완전 소거)
	 */
	clear(): void {
		this.user = null;
		if (browser) {
			if (this !== fallbackAuth) {
				fallbackAuth.user = null;
			}
			if (activeClientAuth && activeClientAuth !== this) {
				activeClientAuth.user = null;
			}
			localStorage.removeItem('auth_user');
			localStorage.removeItem('accessToken');
			localStorage.removeItem('refreshToken');
			document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
			document.cookie = 'refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;';
			console.log('👤 [AuthState] Context, Tokens & Cookies Completely Cleared.');
		}
	}
}

/**
 * [레거시 호환 헬퍼] 토큰 및 세션 즉시 소거
 */
export function clearTokens(): void {
	auth.clear();
}

let activeClientAuth: AuthState | null = null;

/**
 * 🌟 [최상위 Root 레이아웃 전용]
 */
export function setAuthContext(initialUser: UserProfile | null = null): AuthState {
	const authState = new AuthState(initialUser);
	if (browser) {
		activeClientAuth = authState;
		fallbackAuth.user = initialUser;
	}
	setContext(AUTH_KEY, authState);
	return authState;
}

/**
 * 🌟 [하위 모든 컴포넌트 전용]
 */
export function getAuthContext(): AuthState {
	const context = getContext<AuthState>(AUTH_KEY);
	if (context) {
		return context;
	}
	return fallbackAuth;
}

// 📌 [기존 레거시 코드 100% 하위 호환성 유지]
const fallbackAuth = new AuthState();
export const auth = fallbackAuth;
export default auth;
