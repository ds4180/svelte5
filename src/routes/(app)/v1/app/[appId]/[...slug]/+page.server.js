import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * @file /v1/app/[appId]/[...slug]/+page.server.js
 * @description 앱 엔진 라우트 서버 로드 함수
 *   - appId 로 AppRegistry 정보를 조회하여 어떤 엔진(컴포넌트)을 마운트할지 결정
 *   - slug 는 엔진(BoardEngine 등)에 그대로 전달되어 내부 라우팅에 사용됨
 *
 * @example
 *   URL: /v1/app/3/notice          → appId=3, slug="notice"
 *   URL: /v1/app/3/notice/42       → appId=3, slug="notice/42"
 *   URL: /v1/app/3/notice/42/edit  → appId=3, slug="notice/42/edit"
 */

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
    const { appId, slug } = params;

    // 1. AppRegistry 에서 앱 정보 조회
    const appRes = await fetch(`${env.SERVER_URL}/api/v1/admin/apps/${appId}`);
    if (!appRes.ok) {
        throw error(appRes.status, '앱 정보를 불러오는데 실패했습니다.');
    }
    const appInfo = await appRes.json();

    // 2. [하이드레이션 해결] 엔진 데이터 프리로딩 (Pre-loading)
    let initialData = null;
    if (appInfo.main_component === 'BoardEngine' && slug) {
        try {
            const parts = slug.split("/");
            const boardSlug = parts[0];
            
            if (parts.length === 1) {
                // 목록 모드 데이터 로드
                const res = await fetch(`${env.SERVER_URL}/api/v1/board/${boardSlug}/posts?page=0&size=10`);
                if (res.ok) initialData = await res.json();
            } else if (parts[1] && !isNaN(parts[1])) {
                // 상세/수정 모드 데이터 로드
                const postId = parts[1];
                const res = await fetch(`${env.SERVER_URL}/api/v1/board/post/${postId}`);
                if (res.ok) initialData = await res.json();
            }
        } catch (e) {
            console.warn("⚠️ [SSR Preload] Failed to fetch board data:", e.message);
        }
    }

    return {
        appInfo,
        slug: slug || '',
        initialData // 👈 서버에서 가져온 "정답" 데이터
    };
}
