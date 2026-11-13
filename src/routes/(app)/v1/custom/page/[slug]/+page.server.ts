import { error, isHttpError } from '@sveltejs/kit';
import { formatApiError } from '$lib/utils/error';
import type { PageServerLoad } from './$types';

/**
 * @file (app)/v1/custom/page/[slug]/+page.server.ts
 * @description [CUSTOM 앱] DB CMS 페이지 개별 본문 SSR 로더
 */
export const load: PageServerLoad = async ({ fetch, params }) => {
	const { slug } = params;
	try {
		const res = await fetch(`/api/v1/page/detail/${slug}`);
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
