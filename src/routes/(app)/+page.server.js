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
			let rawValue = config.landing_page;
			if (rawValue) {
				if (typeof rawValue === 'object' && rawValue !== null) {
					// JSONB 형태인 경우 내부의 value, text, name 등을 시도
					landingPage = rawValue.value || rawValue.text || rawValue.name || String(rawValue);
				} else {
					landingPage = String(rawValue);
				}
			}
		}
	} catch (e) {
		console.error('❌ [Landing Redirect] Failed to fetch config:', e.message);
	}

	// [Safety] 혹시라도 [object Object] 문자열이 생성되는 것을 방지
	if (typeof landingPage !== 'string' || landingPage.includes('[object')) {
		landingPage = '/v1';
	}

	throw redirect(302, landingPage);
}
