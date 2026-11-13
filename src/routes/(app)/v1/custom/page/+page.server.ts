import type { PageServerLoad } from './$types';

/**
 * @file (app)/v1/custom/page/+page.server.ts
 * @description [CUSTOM 앱] 페이지 엔진 사용자 화면 SSR 로더
 */
export const load: PageServerLoad = async ({ fetch }) => {
	try {
		const res = await fetch('/api/v1/page/public/list');
		if (res.ok) {
			const pages = await res.json();
			return { pages: pages || [] };
		}
	} catch (e) {
		console.error('[Custom Page SSR] Error:', e instanceof Error ? e.message : String(e));
	}
	return { pages: [] };
};
