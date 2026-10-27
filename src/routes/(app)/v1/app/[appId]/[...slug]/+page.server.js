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
export async function load({ params, fetch, locals }) {
	const { appId, slug } = params;
	const user = locals.user || null;

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

	// 1-1. 🛡️ [4단계 권한 SSR 입구 검문] (1.root(9) ➔ 2.deny_groups ➔ 3.allow_groups ➔ 4.min_read_rank)
	// 📌 백엔드 `/api/users/me` 응답 스키마의 공식 필드명인 `rank_level`을 우선 참조합니다.
	const userRank = Number(user?.rank_level ?? user?.rank ?? 0);
	const userGroups = [];
	if (user?.primary_group) userGroups.push(user.primary_group);
	if (Array.isArray(user?.secondary_groups)) {
		for (const g of user.secondary_groups) {
			if (g && !userGroups.includes(g)) userGroups.push(g);
		}
	}
	const denyGroups = Array.isArray(appInfo.deny_groups) ? appInfo.deny_groups : [];
	const allowGroups = Array.isArray(appInfo.allow_groups) ? appInfo.allow_groups : [];
	const minReadRank = Number(appInfo.min_read_rank ?? 0);

	let canReadApp = false;
	if (userRank === 9) {
		canReadApp = true; // [1단계] root(9) 프리패스
	} else if (denyGroups.some((g) => userGroups.includes(g))) {
		canReadApp = false; // [2단계] Deny-Wins
	} else if (allowGroups.some((g) => userGroups.includes(g))) {
		canReadApp = true; // [3단계] Allow-Wins
	} else {
		canReadApp = userRank >= minReadRank; // [4단계] 읽기 랭킹 비교
	}

	if (!canReadApp) {
		throw error(403, `해당 앱("${appInfo.title || appId}")에 접근할 권한이 없습니다.`);
	}

	// 2. [Data-Driven] 범용 데이터 로딩 (Hardcoding Zero 기반)
	let initialData = null;
	if (slug) {
		try {
			// ✅ 특정 엔진을 체크하는 if 문 없이, 범용 엔드포인트 호출
			const res = await fetch(`/api/v1/app/data/${appId}/${slug}`); 
			if (res.status === 403) {
				let errDetail = `해당 앱("${appInfo.title || appId}") 데이터에 접근할 권한이 없습니다.`;
				try {
					const errJson = await res.json();
					if (errJson?.detail) errDetail = errJson.detail;
				} catch (_) {}
				throw error(403, errDetail);
			}
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
			if (e?.status) throw e;
			console.warn('⚠️ [SSR Preload] Generic data fetch failed:', e.message);
		}
	}

	return {
		appInfo,
		slug: slug || '',
		initialData
	};
}
