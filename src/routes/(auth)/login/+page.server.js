import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * @file (auth)/login/+page.server.js
 * @description 로그인 실패 시 Error.svelte 컴포넌트 규격에 맞춰 에러를 반환
 */
export async function load({ locals }) {
	if (locals.user) {
		throw redirect(302, '/v1');
	}
	return {};
}

export const actions = {
	default: async ({ request, cookies, fetch }) => {
		const formData = await request.formData();
		const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://fastapi:8000';

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

		const setCookie = response.headers.get('set-cookie');
		if (setCookie) {
			const sessionIdMatch = setCookie.match(/session_id=([^;]+)/);
			if (sessionIdMatch) {
				const sessionId = sessionIdMatch[1];
				cookies.set('session_id', sessionId, {
					path: '/',
					httpOnly: true,
					sameSite: 'lax',
					secure: false,
					maxAge: 60 * 60 * 24 * 3
				});
			}
		}

		throw redirect(302, '/v1');
	}
};
