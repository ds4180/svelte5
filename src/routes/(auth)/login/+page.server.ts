import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	syncSessionCookieFromResponse,
	resolveSafeRedirect,
	buildBackendForwardHeaders
} from '$lib/server/sessionCookie';
import { formatApiError } from '$lib/utils/error';
import type { Actions, PageServerLoad } from './$types';

/**
 * @file (auth)/login/+page.server.ts
 * @description 로그인 인증 서버 액션 핸들러 (보안 강화 버전)
 */
export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		throw redirect(302, resolveSafeRedirect(url.searchParams.get('redirect')));
	}
	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies, fetch, url } = event;
		const formData = await request.formData();
		const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://backend:8000';

		// 클라이언트 원본 IP 추출 (SvelteKit getClientAddress 안전 호출)
		let clientIp: string | null = null;
		try {
			clientIp = event.getClientAddress();
		} catch {
			clientIp = null;
		}

		// 브라우저 User-Agent, 실제 IP(X-Forwarded-For), 기존 Cookie를 백엔드로 전파
		const forwardHeaders = buildBackendForwardHeaders(request, clientIp);

		const response = await fetch(`${apiEndpoint}/users/login`, {
			method: 'POST',
			headers: forwardHeaders,
			body: formData
		});

		if (!response.ok) {
			let detailMessage = '아이디 혹은 비밀번호가 일치하지 않습니다.';
			try {
				const errBody = await response.json();
				detailMessage = formatApiError(errBody, detailMessage);
			} catch {
				// JSON 파싱 실패 시 기본 메시지 유지
			}

			// ✅ Error.svelte 컴포넌트가 'error.detail'을 읽으므로 구조를 맞춥니다.
			return fail(response.status || 401, {
				error: { detail: detailMessage }
			});
		}

		syncSessionCookieFromResponse(cookies, response);

		throw redirect(302, resolveSafeRedirect(url.searchParams.get('redirect')));
	}
};
