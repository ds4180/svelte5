import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/**
 * @file (app)/+page.server.ts (메인 리다이렉트 엔진)
 * @description 접속 즉시 백엔드에서 설정된 landing_page 로 리다이렉트 처리
 */
export const load: PageServerLoad = async ({ fetch }) => {
	let landingPage = '/v1'; // fallback

	try {
		const res = await fetch('/api/v1/admin/config/public');
		if (res.ok) {
			const config = await res.json();

			// 기본 랜딩 페이지 설정 적용
			const rawValue: unknown = config.landing_page;
			if (rawValue) {
				if (typeof rawValue === 'object' && rawValue !== null) {
					const obj = rawValue as { value?: string; text?: string; name?: string };
					// JSONB 형태인 경우 내부의 value, text, name 등을 시도
					landingPage = obj.value || obj.text || obj.name || String(rawValue);
				} else {
					landingPage = String(rawValue);
				}
			}
		}
	} catch (e) {
		console.error('❌ [Landing Redirect] Failed to fetch config:', e instanceof Error ? e.message : String(e));
	}

	// [Safety] 혹시라도 [object Object] 문자열이 생성되는 것을 방지
	if (typeof landingPage !== 'string' || landingPage.includes('[object')) {
		landingPage = '/v1';
	}

	throw redirect(302, landingPage);
};
