import { error, isHttpError, redirect } from '@sveltejs/kit';
import { formatApiError } from '$lib/utils/error';
import type { PageServerLoad } from './$types';

/**
 * @file (app)/v1/custom/page/[slug]/+page.server.ts
 * @description [CUSTOM 앱] DB CMS 페이지 개별 본문 SSR 로더
 */
export const load: PageServerLoad = async ({ fetch, params, locals, url }) => {
	const { slug } = params;
	const isEditRequest = url.searchParams.get('edit') === 'true';

	// 🛡️ 편집 모드(?edit=true)는 로그인 + 관리자(rank_level >= 4)만 진입 허용
	if (isEditRequest) {
		if (!locals.user) {
			throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
		}
		if (Number(locals.user.rank_level ?? 0) < 4) {
			throw error(403, '페이지 편집 권한이 없습니다. (관리자 전용)');
		}
	}

	try {
		const detailUrl = isEditRequest
			? `/api/v1/page/detail/${slug}?count_view=false`
			: `/api/v1/page/detail/${slug}`;
		const res = await fetch(detailUrl);
		if (!res.ok) {
			const err = await res.json().catch(() => ({}));
			throw error(res.status, formatApiError(err, '페이지를 불러오지 못했습니다.'));
		}
		const pageData = await res.json();
		return { pageData };
	} catch (e) {
		if (isHttpError(e)) throw e;
		throw error(500, formatApiError(e, '페이지 조회 중 서버 오류가 발생했습니다.'));
	}
};
