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

	// 2. [Data-Driven] 범용 데이터 로딩 (Hardcoding Zero 기반)
	let initialData = null;
	if (slug) {
		try {
			// ✅ 특정 엔진을 체크하는 if 문 없이, 범용 엔드포인트 호출
			const res = await fetch(`/api/v1/app/data/${appId}/${slug}`); 
			if (res.ok) {
				const data = await res.json();
				// [Data-Driven] 엔진의 기대 규격에 맞게 맵핑
				if (data.instance && data.instance.posts) {
					// 📋 목록 모드인 경우 (posts 리스트가 포함됨)
					initialData = {
						posts: data.instance.posts,
						total: data.instance.total || 0,
						board: data.parent_config,
						bindings: data.bindings || []
					};
				} else {
					// 📄 상세 모드인 경우
					initialData = {
						post: data.instance,
						board: data.parent_config,
						bindings: data.bindings || []
					};
				}
			}
		} catch (e) {
			console.warn('⚠️ [SSR Preload] Generic data fetch failed:', e.message);
		}
	}

	return {
		appInfo,
		slug: slug || '',
		initialData
	};
}
