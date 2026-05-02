import { redirect } from '@sveltejs/kit';

/**
 * @file logout/+page.server.js (로그아웃 서버 핸들러)
 * @description 쿠키를 만료시키고 백엔드 세션을 정리한 후 리다이렉션
 */
export async function load({ cookies, fetch }) {
	// 1. 백엔드 로그아웃 API 호출 (Redis 세션 삭제)
	try {
		await fetch('/api/users/logout', { method: 'POST' });
	} catch (e) {
		console.warn('⚠️ [Logout] Backend notify failed:', e.message);
	}

	// 2. 브라우저의 session_id 쿠키 만료 처리
	cookies.delete('session_id', { path: '/' });

	// 3. 🚀 성공 즉시 최상위 루트(/)로 리다이렉션
	throw redirect(302, '/');
}
