import { redirect } from '@sveltejs/kit';

export const DEFAULT_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 3;

export const SESSION_COOKIE_OPTIONS = /** @type {const} */ ({
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	secure: false
});

/**
 * Response 헤더(단일 또는 다중 Set-Cookie)에서 session_id 지시문을 파싱합니다.
 * @param {Response} response
 * @returns {{ action: 'set', value: string, maxAge: number } | { action: 'delete' } | null}
 */
export function extractSessionCookieInstruction(response) {
	if (!response?.headers) return null;

	const headerValues =
		typeof response.headers.getSetCookie === 'function'
			? response.headers.getSetCookie()
			: [response.headers.get('set-cookie')].filter(Boolean);

	for (const header of headerValues) {
		if (!header || !header.includes('session_id=')) continue;

		// 다중 쿠키가 쉼표로 합쳐진 경우(일부 런타임)에도 session_id 세그먼트를 우선 분리
		const sessionSegment =
			header
				.split(/,(?=\s*[!#$%&'*+\-.^_`|~0-9A-Za-z]+=)/)
				.find((part) => /\bsession_id=/.test(part)) || header;

		const valueMatch = sessionSegment.match(/\bsession_id=([^;,\s]+)/);
		const rawValue = valueMatch ? valueMatch[1].replace(/^"(.*)"$/, '$1') : '';
		const maxAgeMatch = sessionSegment.match(/\bMax-Age=(\d+)/i);
		const parsedMaxAge = maxAgeMatch ? Number(maxAgeMatch[1]) : DEFAULT_SESSION_MAX_AGE_SECONDS;

		if (!rawValue || (maxAgeMatch && parsedMaxAge === 0)) {
			return { action: 'delete' };
		}

		return {
			action: 'set',
			value: rawValue,
			maxAge: Number.isFinite(parsedMaxAge) && parsedMaxAge > 0 ? parsedMaxAge : DEFAULT_SESSION_MAX_AGE_SECONDS
		};
	}

	return null;
}

/**
 * 백엔드 응답의 Set-Cookie: session_id=... (및 Max-Age)를 SvelteKit cookies에 동기화합니다.
 * @param {import('@sveltejs/kit').Cookies} cookies
 * @param {Response} response
 */
export function syncSessionCookieFromResponse(cookies, response) {
	const instruction = extractSessionCookieInstruction(response);
	if (!instruction) return;

	if (instruction.action === 'delete') {
		cookies.delete('session_id', SESSION_COOKIE_OPTIONS);
		return;
	}

	cookies.set('session_id', instruction.value, {
		...SESSION_COOKIE_OPTIONS,
		maxAge: instruction.maxAge
	});
}

/**
 * 보호된 (app) SSR 라우트에서 미인증 사용자를 /login?redirect=... 로 리다이렉트합니다.
 * @param {App.Locals} locals
 * @param {URL} url
 */
export function requireAuthUser(locals, url) {
	if (!locals?.user) {
		const target = url ? `${url.pathname}${url.search}` : '/';
		throw redirect(302, `/login?redirect=${encodeURIComponent(target)}`);
	}
	return locals.user;
}

/**
 * Open Redirect 방지를 적용한 로그인 후 안전 리다이렉트 경로 계산
 * @param {string | null} rawRedirect
 * @returns {string}
 */
export function resolveSafeRedirect(rawRedirect) {
	if (typeof rawRedirect !== 'string') return '/';
	if (!rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) return '/';
	if (rawRedirect.startsWith('/login') || rawRedirect.startsWith('/logout')) return '/';
	return rawRedirect;
}
