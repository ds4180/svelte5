import { PUBLIC_API_ENDPOINT } from '$env/static/public';

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
					event.cookies.delete('session_id', { path: '/' });
				}
			}
		} catch (e) {
			console.error('❌ [Hooks] Revalidation Error:', e.message);
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
	const apiEndpoint = PUBLIC_API_ENDPOINT || 'http://fastapi:8000';
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

	// [Sliding Window]
	const setCookie = res.headers.get('set-cookie');
	if (setCookie && setCookie.includes('session_id=')) {
		const match = setCookie.match(/session_id=([^;]+)/);
		if (match) {
			event.cookies.set('session_id', match[1], {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: false,
				maxAge: 60 * 60 * 24 * 3
			});
		}
	}

	return res;
}
