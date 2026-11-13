import { isRedirect } from '@sveltejs/kit';
import { requireAuthUser } from '$lib/server/sessionCookie.js';

/**
 * @file (app)/v1/custom/page/+page.server.js
 * @description [CUSTOM 앱] 페이지 엔진 사용자 화면 SSR 로더
 */
export async function load({ fetch, locals, url }) {
	requireAuthUser(locals, url);
	try {
		const res = await fetch('/api/v1/page/public/list');
		if (res.ok) {
			const pages = await res.json();
			return { pages: pages || [] };
		}
	} catch (e) {
		if (isRedirect(e)) throw e;
		console.error('[Custom Page SSR] Error:', e instanceof Error ? e.message : String(e));
	}
	return { pages: [] };
}
