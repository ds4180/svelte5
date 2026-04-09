import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * @file /v1/app/[appId]/[...slug]/+page.server.js
 * @description 앱 엔진 라우트 서버 로드 함수
 *   - appId 로 AppRegistry 정보를 조회하여 어떤 엔진(컴포넌트)을 마운트할지 결정
 *   - slug 는 엔진(BoardEngine 등)에 그대로 전달되어 내부 라우팅에 사용됨
 *
 * @example
 *   URL: /v1/app/board/notice          → appId="board", slug="notice"         → 목록 모드
 *   URL: /v1/app/board/notice/42       → appId="board", slug="notice/42"      → 상세 모드
 *   URL: /v1/app/board/notice/42/edit  → appId="board", slug="notice/42/edit" → 수정 모드
 *
 * BoardEngine initialData 구조:
 *   - 목록: { posts: [...], board: {...}, total: N }
 *   - 상세: { post: {...}, board: {...}, bindings: [...] }
 */

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
	const { appId, slug } = params;

	// appId → 컴포넌트 자동 추론 매핑 (AppRegistry 폴백용)
	const AUTO_COMPONENT_MAP = {
		board: 'BoardEngine',
		boards: 'BoardEngine',
		calendar: 'CalendarEngine',
		dayoff: 'DayOffEngine'
	};

	// 1. AppRegistry 에서 앱 정보 조회
	let appInfo = null;
	let appRes = null;
	try {
		appRes = await fetch(`/api/v1/admin/apps/${appId}`);
		if (appRes.ok) {
			appInfo = await appRes.json();
		}
	} catch (e) {
		console.warn(`⚠️ [SSR] AppRegistry fetch error:`, e.message);
	}

	if (!appInfo) {
		// ⚡ 폴백: AppRegistry 조회 실패 시 appId 로 컴포넌트를 추론
		const inferredComponent = AUTO_COMPONENT_MAP[appId.toLowerCase()];
		if (inferredComponent) {
			console.warn(
				`⚠️ [SSR] AppRegistry miss for "${appId}". Falling back to inferred component: ${inferredComponent}`
			);
			appInfo = {
				app_id: appId,
				name: appId,
				main_component: inferredComponent
			};
		} else {
			// 알 수 없는 appId → 명확한 404
			throw error(
				404,
				`앱 "${appId}"을 찾을 수 없습니다. 관리자에서 앱을 먼저 등록해주세요.`
			);
		}
	}

	// 2. BoardEngine SSR 프리로딩
	//    목록/상세 구분: slug 파트 수로 판단
	//    · parts.length === 1         → 목록 (notice)
	//    · parts.length >= 2, [1]이 숫자 → 상세/수정 (notice/42 or notice/42/edit)
	let initialData = null;
	if (appInfo.main_component === 'BoardEngine' && slug) {
		try {
			const parts = slug.split('/').filter(Boolean);
			const boardSlug = parts[0];

			if (parts.length === 1) {
				// 📋 목록 모드: GET /api/v1/board/list/{slug}?page=0&size=10
				const res = await fetch(`/api/v1/board/list/${boardSlug}?page=0&size=10`);
				if (res.ok) {
					initialData = await res.json();
				} else {
					console.warn(`⚠️ [SSR] Board list fetch failed: ${res.status}`);
				}
			} else if (parts[1] && !isNaN(parts[1])) {
				// 📄 상세/수정 모드: GET /api/v1/board/post/{postId}
				const postId = parts[1];
				const res = await fetch(`/api/v1/board/post/${postId}`);
				if (res.ok) {
					const rawPost = await res.json();
					// 백엔드가 단일 Post 객체를 반환하므로 BoardEngine 구조에 맞게 래핑
					initialData = { 
						post: rawPost, 
						board: rawPost.board || null, 
						bindings: [] // 서비스 바인딩 정보가 post 객체 내부에 없으면 기본값
					};
				} else {
					console.warn(`⚠️ [SSR] Board post fetch failed: ${res.status} (postId: ${postId})`);
				}
			}
		} catch (e) {
			console.warn('⚠️ [SSR Preload] BoardEngine data fetch failed:', e.message);
		}
	}

	return {
		appInfo,
		slug: slug || '',
		initialData
	};
}
