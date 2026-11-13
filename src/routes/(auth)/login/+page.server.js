import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
	syncSessionCookieFromResponse,
	resolveSafeRedirect,
	buildBackendForwardHeaders
} from '$lib/server/sessionCookie.js';

/**
 * @file (auth)/login/+page.server.js
 * @description 로그인 인증 서버 액션 핸들러 (보안 강화 버전)
 *
 * 🛡️ 적용된 보안 조치:
 * 1. [실제 IP & User-Agent 전파]: 브라우저의 원본 `User-Agent`, `X-Forwarded-For`, `X-Real-IP`,
 *    그리고 기존 `Cookie`(`session_id` 재로그인 시 Session Fixation 폐기용)를 FastAPI `/users/login`에 전달합니다.
 * 2. [Brute-Force 429 잠금 & 403 비활성 계정 안내 연동]: 백엔드가 반환한 상태 코드(401 / 403 / 429)와
 *    상세 에러 메시지(`detail`)를 파싱하여 `Error.svelte`에 정확히 전달합니다.
 * 3. [Open Redirect 방어]: `resolveSafeRedirect`를 통해 외부 도메인이나 `/login`, `/logout`으로의
 *    비정상 리다이렉트를 원천 차단합니다.
 */
export async function load({ locals, url }) {
	if (locals.user) {
		throw redirect(302, resolveSafeRedirect(url.searchParams.get('redirect')));
	}
	return {};
}

export const actions = {
	default: async (event) => {
		const { request, cookies, fetch, url } = event;
		const formData = await request.formData();
		const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://backend:8000';

		// 클라이언트 원본 IP 추출 (SvelteKit getClientAddress 안전 호출)
		let clientIp = null;
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
				if (errBody && typeof errBody.detail === 'string' && errBody.detail.trim()) {
					detailMessage = errBody.detail;
				}
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
