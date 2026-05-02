import { error } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
    const { slug } = params;

    try {
        // 백엔드 페이지 상세 조회 API 호출 (권한 체크 등은 백엔드에서 수행)
        const res = await fetch(`/api/v1/page/detail/${slug}`);
        
        if (!res.ok) {
            if (res.status === 404) {
                // 페이지가 없을 경우
                return { page: null, slug };
            }
            // 403 리다이렉트 등 특수 에러 처리
            const errData = await res.json().catch(() => ({}));
            if (errData.detail?.redirect) {
                return { redirect: errData.detail.redirect };
            }
            throw error(res.status, errData.detail || '페이지 로드 실패');
        }

        const pageData = await res.json();
        return {
            page: pageData,
            slug
        };
    } catch (e) {
        console.error('[SSR] Page Load Error:', e);
        // 에러 발생 시에도 빈 페이지 객체를 넘겨 엔진에서 처리하도록 함
        return { page: null, slug };
    }
}
