import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { extractGroupsForAction } from '$lib/runes/auth.svelte';

/**
 * ============================================================================
 * [관리자 영역 SSR 라우트 가드 (+layout.server.ts)]
 * ============================================================================
 *
 * 🛡️ 4단계 권한 인가 정책:
 * 1. 비로그인 접근 -> /login?redirect=... 302 리다이렉트
 * 2. 특정 시스템 앱(/v1/admin/{subpath}) 진입 시:
 *    - [1단계] root (rank_level == 9) -> 무조건 허용
 *    - [2단계] 앱 비활성화(is_active === false) -> 차단
 *    - [3단계] deny_groups에 소속 그룹 포함 시 -> 무조건 차단 (Deny-Wins)
 *    - [4단계] allow_groups에 소속 그룹 포함 시 -> 랭크 무관 즉시 허용 (Allow-Wins)
 *    - [5단계] rank_level >= min_read_rank 대소비교
 */

// 🌐 시스템 앱 경로와 AppRegistry app_id 표준 매핑 테이블
const PATH_TO_APP_ID: Record<string, string> = {
	'/v1/admin': 'dashboard',
	'/v1/admin/dashboard': 'dashboard',
	'/v1/admin/alerts': 'alerts',
	'/v1/admin/media': 'media',
	'/v1/admin/target-groups': 'target_groups',
	'/v1/admin/pushs': 'pushs',
	'/v1/admin/sessions': 'observability',
	'/v1/admin/observability': 'observability',
	'/v1/admin/dispatch': 'dispatch',
	'/v1/admin/route_master': 'route_master',
	'/v1/admin/dayoff': 'dayoff',
	'/v1/admin/blackbox': 'blackbox',
	'/v1/admin/board': 'board',
	'/v1/admin/boards': 'board',
	'/v1/admin/page': 'page',
	'/v1/admin/user-manage': 'user_manage',
	'/v1/admin/group-manage': 'group_manage',
	'/v1/admin/tasks': 'tasks',
	'/v1/admin/backup': 'backup',
	'/v1/admin/config': 'config',
	'/v1/admin/apps': 'apps',
	'/v1/admin/menu': 'menu',
	'/v1/admin/services': 'services'
};

export const load: LayoutServerLoad = async ({ locals, url, fetch }) => {
	const user = locals.user;

	// 1. [1차 관문] 비로그인 사용자 차단
	if (!user) {
		const redirectUrl = `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`;
		throw redirect(302, redirectUrl);
	}

	const rank = Number(user.rank_level ?? 0);

	// 2. [2차 관문] 시스템 최고 권한자(root: Rank 9)는 모든 관리자 페이지 무조건 통과
	if (rank >= 9) {
		return {
			user,
			canManageSystem: true,
			isAdmin: true
		};
	}

	// 사용자 소속 그룹 집합 구성 (주그룹 1개 + 부그룹 N개)
	const userGroups = new Set<string>();
	if (user.primary_group) userGroups.add(String(user.primary_group));
	if (Array.isArray(user.secondary_groups)) {
		user.secondary_groups.forEach((g: any) => g && userGroups.add(String(g)));
	}

	// 3. [3차 관문] 시스템 앱별 세부 권한 검사 (대시보드 admin_dashboard 포함 실시간 4단계 거버넌스)
	const currentPath = url.pathname.replace(/\/$/, ''); // 끝 슬래시 제거 정규화
	const targetAppId = PATH_TO_APP_ID[currentPath];

	// 시스템 앱 진입 시 DB의 앱 권한(allow_groups, deny_groups, min_read_rank) 조회
	if (targetAppId) {
		const isDashboard = currentPath === '/v1/admin' || currentPath === '/v1/admin/dashboard';
		const fallbackRedirect = isDashboard ? '/' : '/v1/admin';

		try {
			const res = await fetch(`/api/v1/admin/apps/${targetAppId}`);
			if (res.ok) {
				const targetApp = await res.json();

				if (targetApp) {
					// [1단계] 앱 비활성화(Kill-Switch) 검사 (root는 이미 상단에서 통과)
					if (targetApp.is_active === false) {
						console.warn(`🚧 [RouteGuard] ${targetAppId} 비활성화(점검 중) - ${user.username} 차단`);
						throw redirect(302, isDashboard ? '/' : '/v1/admin?inactive=true');
					}

					// [2단계] deny_groups 검사 (Deny-Wins)
					const denyGroups = new Set(extractGroupsForAction(targetApp.deny_groups, 'read'));
					const isDenied = [...userGroups].some((g) => denyGroups.has(g));
					if (isDenied) {
						console.warn(`🚨 [RouteGuard] ${user.username} - ${targetAppId} 접근 차단됨 (deny_groups 소속)`);
						throw redirect(302, isDashboard ? '/' : '/v1/admin?denied=true');
					}

					// [3단계] allow_groups 검사 (Allow-Wins)
					const allowGroups = new Set(extractGroupsForAction(targetApp.allow_groups, 'read'));
					const isAllowed = [...userGroups].some((g) => allowGroups.has(g));
					if (isAllowed) {
						return {
							user,
							currentApp: targetApp,
							canManageSystem: rank >= 8,
							isAdmin: true
						};
					}

					// [4단계] min_read_rank 비교
					const minRank = Number(targetApp.min_read_rank ?? 4);
					if (rank < minRank) {
						console.warn(
							`🔒 [RouteGuard] ${user.username} (Lv.${rank}) - ${targetAppId} 권한 부족 (요구: Lv.${minRank})`
						);
						throw redirect(302, isDashboard ? '/' : '/v1/admin?insufficient=true');
					}

					// /v1/admin/dashboard로 들어온 경우 표준 정규 주소 /v1/admin으로 정규화 리다이렉트
					if (currentPath === '/v1/admin/dashboard') {
						throw redirect(302, '/v1/admin');
					}

					return {
						user,
						currentApp: targetApp,
						canManageSystem: rank >= 8,
						isAdmin: rank >= 4
					};
				}
			}
		} catch (err: any) {
			// SvelteKit의 redirect 예외는 상위로 다시 던져야 정상 리다이렉트됨
			if (err?.status === 302 || err?.status === 301 || err?.location) {
				throw err;
			}
			console.error(`⚠️ [RouteGuard] 권한 조회 API 호출 중 오류 발생:`, err?.message);
		}

		// API 호출 실패 시 기본 fallback: 최소 Rank 4 이상만 허용
		if (rank < 4) {
			throw redirect(302, fallbackRedirect);
		}
	}

	return {
		user,
		canManageSystem: rank >= 8,
		isAdmin: rank >= 4
	};
};
