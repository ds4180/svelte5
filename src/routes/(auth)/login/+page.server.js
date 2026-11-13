import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { syncSessionCookieFromResponse, resolveSafeRedirect } from '$lib/server/sessionCookie.js';

/**
 * @file (auth)/login/+page.server.js
 * @description 로그인 실패 시 Error.svelte 컴포넌트 규격에 맞춰 에러를 반환
 */
export async function load({ locals, url }) {
	if (locals.user) {
		throw redirect(302, resolveSafeRedirect(url.searchParams.get('redirect')));
	}
	return {};
}

export const actions = {
	default: async ({ request, cookies, fetch, url }) => {
		const formData = await request.formData();
		const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://backend:8000';

		const response = await fetch(`${apiEndpoint}/users/login`, {
			method: 'POST',
			body: formData
		});

		if (!response.ok) {
			// ✅ Error.svelte 컴포넌트가 'error.detail'을 읽으므로 구조를 맞춥니다.
			return fail(401, {
				error: { detail: '아이디 혹은 비밀번호가 일치하지 않습니다.' }
			});
		}

		syncSessionCookieFromResponse(cookies, response);

		throw redirect(302, resolveSafeRedirect(url.searchParams.get('redirect')));
	}
};
