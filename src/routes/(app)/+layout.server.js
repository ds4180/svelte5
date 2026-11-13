import { isRedirect, redirect } from '@sveltejs/kit';
import { requireAuthUser } from '$lib/server/sessionCookie.js';

/**
 * @file (app)/+layout.server.js
 * @description 대시보드 사이드바 메뉴 SSR 로더
 *   - 백엔드 `/api/v1/admin/menu/public` 엔드포인트에서 이미 4단계 권한 필터링 및
 *     앱 분류 체계(INSTANCE / CUSTOM / SYSTEM)에 맞춘 슬러그·URL 조립을 완료하여 반환합니다.
 *   - 프론트엔드에서 불필요하게 관리자 전용 API(`/admin/boards` 등)를 중복 호출하거나
 *     백엔드가 결정한 `external_url`을 덮어쓰지 않고 그대로 신뢰하여 전달합니다.
 */
export async function load({ fetch, locals, url }) {
	const user = requireAuthUser(locals, url);
	let menus = [];

	try {
		// 1. 백엔드 공개 메뉴 트리 조회 (현재 로그인 세션 쿠키 자동 포함)
		const menuRes = await fetch('/api/v1/admin/menu/public');
		if (menuRes.ok) {
			menus = await menuRes.json();
		} else if (menuRes.status === 401) {
			throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
		} else {
			console.error(`❌ [Layout SSR] Menu API Error: status ${menuRes.status}`);
		}
	} catch (err) {
		if (isRedirect(err)) throw err;
		console.error('❌ [Layout SSR] Backend Fatal Error:', err instanceof Error ? err.message : String(err));
	}

	return {
		menus,
		user
	};
}
