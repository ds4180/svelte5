import { PUBLIC_API_ENDPOINT } from '$env/static/public';

/**
 * @type {import('@sveltejs/kit').Handle}
 * @description 서버 사이드에서 세션을 확인하고 사용자 정보를 설정하는 서버 훅
 */
export async function handle({ event, resolve }) {
    // 💡 Redis 기반 세션 관리 방식:
    // 더 이상 토큰을 직접 해석하지 않고, 백엔드에 사용자 정보 요청을 보내 세션 유효성을 검증합니다.
    try {
        const response = await event.fetch(`/api/users/me`);
        if (response.ok) {
            event.locals.user = await response.json();
        } else {
            event.locals.user = null;
        }
    } catch (e) {
        // API 서버가 다운되었거나 네트워크 문제 발생 시
        console.error("Error fetching user session:", e);
        event.locals.user = null;
    }
    
    return await resolve(event);
}

/**
 * @type {import('@sveltejs/kit').HandleFetch}
 * @description 클라이언트의 API 요청을 백엔드 API 서버로 프록시
 */
export async function handleFetch({ request, fetch }) {
    const apiEndpoint = PUBLIC_API_ENDPOINT || 'http://fastapi:8000';
    let internalUrl = request.url;
    
    // API 경로 재구성: 클라이언트의 /api 요청을 실제 백엔드 주소로 변경
    if (request.url.includes('/api') || request.url.startsWith('/users') || request.url.startsWith('/admin')) {
        const urlObj = new URL(request.url, 'http://localhost');
        const newPathname = urlObj.pathname.replace(/^\/api/, '');
        internalUrl = `${apiEndpoint}${newPathname}${urlObj.search}`;
    }
    
    console.log(`🚀 [handleFetch] Transforming: ${request.url} -> ${internalUrl}`);
    console.log(`🍪 [handleFetch] Request Cookie: ${request.headers.get('cookie')}`);
    
    // 쿠키는 event.fetch와 달리 자동으로 전달되지 않으므로, 필요 시 헤더를 복사해야 할 수 있으나,
    // 이 프로젝트에서는 SvelteKit의 기본 fetch 동작에 의존합니다.
    // (서버->서버 요청이므로 쿠키가 자동으로 전달될 수 있음)
    const newRequest = new Request(internalUrl, request);
    // request.headers 를 그대로 복제하므로 Cookie 가 포함되어야 함
    
    const res = await fetch(newRequest);
    console.log(`📥 [handleFetch] Response: ${res.status}`);
    return res;
}
