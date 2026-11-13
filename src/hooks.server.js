import { PUBLIC_API_ENDPOINT } from '$env/static/public';
import { SESSION_COOKIE_OPTIONS, syncSessionCookieFromResponse } from '$lib/server/sessionCookie.js';

/**
 * @file hooks.server.js (Performance Optimized v3.1)
 */
export async function handle({ event, resolve }) {
	const start = Date.now();
	const sessionId = event.cookies.get('session_id');
	const pathname = event.url.pathname;

	// 📌 1. 정적 파일 및 특정 경로는 세션 체크 제외 (속도 향상)
	const isStaticAsset = pathname.includes('.') || pathname.startsWith('/_app');
	const isAuthPath = pathname.startsWith('/login') || pathname.startsWith('/logout');

	if (sessionId && !isStaticAsset && !isAuthPath) {
		try {
			// 이미 locals에 유저 정보가 있는지 확인 (중복 호출 방지)
			if (!event.locals.user) {
				const response = await event.fetch(`/api/users/me`);
				if (response.ok) {
					event.locals.user = await response.json();
				} else if (response.status === 401) {
					event.cookies.delete('session_id', SESSION_COOKIE_OPTIONS);
				}
			}
		} catch (e) {
			console.error('❌ [Hooks] Revalidation Error:', e instanceof Error ? e.message : String(e));
		}
	}

	const response = await resolve(event);

	// 📌 실행 시간 로그 (지연 원인 파악용)
	const duration = Date.now() - start;
	if (duration > 100) {
		// 100ms 이상 걸릴 때만 출력
		console.log(`⏱️ [Hooks] Slow Request: ${pathname} took ${duration}ms`);
	}

	return response;
}

export async function handleFetch({ request, fetch, event }) {
	const apiEndpoint = PUBLIC_API_ENDPOINT || 'http://backend:8000';
	let internalUrl = request.url;

	if (
		request.url.includes('/api') ||
		request.url.startsWith('/users') ||
		request.url.startsWith('/admin')
	) {
		const urlObj = new URL(request.url, 'http://localhost');
		const newPathname = urlObj.pathname.replace(/^\/api/, '');
		internalUrl = `${apiEndpoint}${newPathname}${urlObj.search}`;
	}

	const newRequest = new Request(internalUrl, request);
	const originalCookieHeader = event.request.headers.get('cookie');
	const originalUserAgent = event.request.headers.get('user-agent');

	if (originalCookieHeader) newRequest.headers.set('cookie', originalCookieHeader);
	if (originalUserAgent) newRequest.headers.set('user-agent', originalUserAgent);

	const res = await fetch(newRequest);

	// [Sliding Window] 백엔드 Set-Cookie(session_id + Max-Age) 또는 삭제 지시를 브라우저 응답에 동기화
	syncSessionCookieFromResponse(event.cookies, res);

	return res;
}
