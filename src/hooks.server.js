import { PUBLIC_API_ENDPOINT } from '$env/static/public';

/**
 * @type {import('@sveltejs/kit').Handle}
 * @description 서버 사이드에서 세션을 확인하고 사용자 정보를 설정하는 서버 훅
 */
export async function handle({ event, resolve }) {
    const sessionId = event.cookies.get('session_id');

    if (sessionId) {
        try {
            const response = await event.fetch(`/api/users/me`);
            if (response.ok) {
                event.locals.user = await response.json();
            } else {
                event.locals.user = null;
                if (response.status === 401) {
                    event.cookies.delete('session_id', { path: '/' });
                }
            }
        } catch (e) {
            event.locals.user = null;
        }
    } else {
        event.locals.user = null;
    }

    return await resolve(event);
}

/**
 * @type {import('@sveltejs/kit').HandleFetch}
 * @description 클라이언트의 API 요청을 백엔드 API 서버로 프록시
 */
export async function handleFetch({ request, fetch, event }) {
    const apiEndpoint = PUBLIC_API_ENDPOINT || 'http://fastapi:8000';
    let internalUrl = request.url;

    if (request.url.includes('/api') || request.url.startsWith('/users') || request.url.startsWith('/admin')) {
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

    // 🔄 [Sliding Window] 백엔드에서 세션이 연장되었다면(Set-Cookie), 브라우저 쿠키를 업데이트
    const setCookie = res.headers.get('set-cookie');
    if (setCookie && setCookie.includes('session_id=')) {
        const match = setCookie.match(/session_id=([^;]+)/);
        if (match) {
            event.cookies.set('session_id', match[1], {
                path: '/',
                httpOnly: true,
                sameSite: 'lax',
                secure: false,
                maxAge: 60 * 60 * 24 * 3 // 3일 연장
            });
        }
    }

    return res;
}
