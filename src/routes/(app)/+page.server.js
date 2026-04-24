import { redirect } from '@sveltejs/kit';

/**
 * @file (app)/+page.server.js (메인 리다이렉트 엔진)
 * @description 접속 즉시 백엔드에서 설정된 landing_page 로 리다이렉트 처리
 */
export async function load({ fetch }) {
	let landingPage = '/v1'; // fallback

	try {
		const res = await fetch('/api/v1/admin/config/public');
		if (res.ok) {
			const config = await res.json();
			
			// 기본 랜딩 페이지 설정 적용
			if (config.landing_page) {
				landingPage = config.landing_page;
			}
		}
	} catch (e) {
		console.error('❌ [Landing Redirect] Failed to fetch config:', e.message);
	}

	throw redirect(302, landingPage);
}
