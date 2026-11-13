/**
 * @file (app)/+layout.server.js
 * @description 대시보드 사이드바 메뉴 SSR 로더
 *   - 백엔드 `/api/v1/admin/menu/public` 엔드포인트에서 이미 4단계 권한 필터링 및
 *     앱 분류 체계(INSTANCE / CUSTOM / SYSTEM)에 맞춘 슬러그·URL 조립을 완료하여 반환합니다.
 *   - 비로그인(Guest, Rank 0) 상태에서도 기본 페이지(`/`) 및 공개 메뉴(min_read_rank=0)에
 *     정상 진입할 수 있도록 강제 로그인 리다이렉트 없이 `locals.user || null`을 전달합니다.
 */
export async function load({ fetch, locals }) {
	let menus = [];

	try {
		// 1. 백엔드 공개 메뉴 트리 조회 (로그인 시 세션 쿠키 포함, 비로그인 시 Rank 0 공개 메뉴 반환)
		const menuRes = await fetch('/api/v1/admin/menu/public');
		if (menuRes.ok) {
			menus = await menuRes.json();
		} else {
			console.error(`❌ [Layout SSR] Menu API Error: status ${menuRes.status}`);
		}
	} catch (err) {
		console.error('❌ [Layout SSR] Backend Fatal Error:', err instanceof Error ? err.message : String(err));
	}

	return {
		menus,
		user: locals.user || null
	};
}
