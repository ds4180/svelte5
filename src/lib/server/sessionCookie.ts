/**
 * ============================================================================
 * [SSR 세션 쿠키 동기화, 프록시 헤더 전파 및 인증 리다이렉트 가드 (src/lib/server/sessionCookie.ts)]
 * ============================================================================
 * 💡 역할:
 * 1. FastAPI 백엔드 응답의 `Set-Cookie: session_id=...` (Sliding Window 갱신/만료)를
 *    SvelteKit SSR `cookies`에 1:1 동기화합니다.
 * 2. SvelteKit SSR 액션 및 `handleFetch`가 내부망으로 FastAPI를 호출할 때
 *    브라우저의 실제 `User-Agent`(모바일/PC 판별용)와 클라이언트 IP(`X-Forwarded-For`, `X-Real-IP`)가
 *    유실되지 않도록 프록시 헤더를 구성합니다.
 * 3. 보호된 라우트에서 미인증 사용자의 안전 리다이렉트(Open Redirect 방어)를 보장합니다.
 */

import { redirect, type Cookies } from '@sveltejs/kit';

const parsedExpireDays =
	typeof process !== 'undefined' && process.env?.REFRESH_TOKEN_EXPIRE_DAYS
		? Number(process.env.REFRESH_TOKEN_EXPIRE_DAYS)
		: 3;

export const DEFAULT_SESSION_MAX_AGE_SECONDS =
	60 * 60 * 24 * (Number.isFinite(parsedExpireDays) && parsedExpireDays > 0 ? parsedExpireDays : 3);

/**
 * 🛡️ 쿠키 보안 옵션:
 * - httpOnly: true (XSS 스크립트를 통한 session_id 탈취 원천 차단)
 * - sameSite: 'lax' (외부 사이트 POST CSRF 공격 차단 및 일반 링크 진입 허용)
 * - secure: COOKIE_SECURE='true' 이거나 접속 요청이 HTTPS(X-Forwarded-Proto: https / https://)일 때 자동 활성화
 */
const isSecureCookieEnabled =
	typeof process !== 'undefined' &&
	typeof process.env?.COOKIE_SECURE === 'string' &&
	['true', '1', 't'].includes(process.env.COOKIE_SECURE.toLowerCase());

export const SESSION_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax',
	secure: isSecureCookieEnabled
} as const;

export function resolveCookieOptions(request?: Request | null, forceSecure?: boolean) {
	let secure: boolean = isSecureCookieEnabled;
	if (typeof forceSecure === 'boolean') {
		secure = secure || forceSecure;
	} else if (!secure && request) {
		const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim().toLowerCase();
		if (proto === 'https' || request.url?.startsWith('https://')) {
			secure = true;
		}
	}
	return {
		...SESSION_COOKIE_OPTIONS,
		secure
	};
}

/**
 * 🌐 [보안 강화 2] SvelteKit SSR -> FastAPI 백엔드 프록시 요청 시
 * 실제 클라이언트 단말의 IP와 User-Agent, 기존 쿠키를 보존하여 전달하는 헤더 빌더
 *
 * 💡 왜 필요한가?
 * - SvelteKit 서버 액션(`+page.server.js`)에서 `fetch()`로 FastAPI `/users/login`을 호출할 때
 *   브라우저 헤더를 전달하지 않으면 FastAPI는 `User-Agent: node`와 도커 내부 IP(`172.18.0.x`)만 보게 됩니다.
 * - 그 결과 모바일 접속자도 무조건 `DESKTOP`으로 오판되고, Brute-Force IP 차단 시 컨테이너 전체가
 *   잠기는 문제를 방지하기 위해 원본 클라이언트의 식별 헤더를 그대로 포워딩합니다.
 */
export function buildBackendForwardHeaders(
	request: Request,
	fallbackClientIp?: string | null,
	extraHeaders?: Record<string, string>
): Record<string, string> {
	const headers: Record<string, string> = { ...(extraHeaders ?? {}) };

	const ua = request.headers.get('user-agent');
	if (ua) headers['user-agent'] = ua;

	const cookie = request.headers.get('cookie');
	if (cookie) headers['cookie'] = cookie;

	const forwardedProto = request.headers.get('x-forwarded-proto');
	if (forwardedProto) {
		headers['x-forwarded-proto'] = forwardedProto;
	} else if (request.url?.startsWith('https://')) {
		headers['x-forwarded-proto'] = 'https';
	}

	const cfIp = request.headers.get('cf-connecting-ip')?.trim();
	const xff = request.headers.get('x-forwarded-for');
	const xRealIp = request.headers.get('x-real-ip');

	if (cfIp) {
		headers['cf-connecting-ip'] = cfIp;
	}

	if (cfIp) {
		headers['x-forwarded-for'] = cfIp;
	} else if (xff) {
		headers['x-forwarded-for'] = xff;
	} else if (xRealIp) {
		headers['x-forwarded-for'] = xRealIp;
	} else if (fallbackClientIp) {
		headers['x-forwarded-for'] = fallbackClientIp;
	}

	if (cfIp) {
		headers['x-real-ip'] = cfIp;
	} else if (xRealIp) {
		headers['x-real-ip'] = xRealIp;
	} else if (xff) {
		headers['x-real-ip'] = xff.split(',')[0].trim();
	} else if (fallbackClientIp) {
		headers['x-real-ip'] = fallbackClientIp;
	}

	return headers;
}

export type SessionCookieInstruction =
	| { action: 'set'; value: string; maxAge: number; secure?: boolean }
	| { action: 'delete'; secure?: boolean };

/**
 * Response 헤더(단일 또는 다중 Set-Cookie)에서 session_id 지시문을 파싱합니다.
 */
export function extractSessionCookieInstruction(
	response: Response | null | undefined
): SessionCookieInstruction | null {
	if (!response?.headers) return null;

	const headerValues =
		typeof response.headers.getSetCookie === 'function'
			? response.headers.getSetCookie()
			: [response.headers.get('set-cookie')].filter((v): v is string => Boolean(v));

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
		const hasSecureAttr = /(?:^|;\s*)Secure\b/i.test(sessionSegment);

		if (!rawValue || (maxAgeMatch && parsedMaxAge === 0)) {
			return hasSecureAttr ? { action: 'delete', secure: true } : { action: 'delete' };
		}

		const result: SessionCookieInstruction = {
			action: 'set',
			value: rawValue,
			maxAge:
				Number.isFinite(parsedMaxAge) && parsedMaxAge > 0
					? parsedMaxAge
					: DEFAULT_SESSION_MAX_AGE_SECONDS
		};
		if (hasSecureAttr) {
			result.secure = true;
		}
		return result;
	}

	return null;
}

/**
 * 백엔드 응답의 Set-Cookie: session_id=... (및 Max-Age)를 SvelteKit cookies에 동기화합니다.
 */
export function syncSessionCookieFromResponse(
	cookies: Cookies,
	response: Response | null | undefined,
	request?: Request | null
): void {
	const instruction = extractSessionCookieInstruction(response);
	if (!instruction) return;

	const cookieOpts = resolveCookieOptions(request, instruction.secure);

	if (instruction.action === 'delete') {
		cookies.delete('session_id', cookieOpts);
		return;
	}

	cookies.set('session_id', instruction.value, {
		...cookieOpts,
		maxAge: instruction.maxAge
	});
}

/**
 * 보호된 (app) SSR 라우트에서 미인증 사용자를 /login?redirect=... 로 리다이렉트합니다.
 */
export function requireAuthUser(locals: App.Locals, url?: URL | null) {
	if (!locals?.user) {
		const target = url ? `${url.pathname}${url.search}` : '/';
		throw redirect(302, `/login?redirect=${encodeURIComponent(target)}`);
	}
	return locals.user;
}

/**
 * Open Redirect 방지를 적용한 로그인 후 안전 리다이렉트 경로 계산
 */
export function resolveSafeRedirect(rawRedirect: string | null | undefined): string {
	if (typeof rawRedirect !== 'string') return '/';
	if (!rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) return '/';
	if (rawRedirect.startsWith('/login') || rawRedirect.startsWith('/logout')) return '/';
	return rawRedirect;
}
