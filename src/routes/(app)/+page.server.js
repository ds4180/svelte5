import { redirect } from '@sveltejs/kit';

/**
 * @file (app)/+page.server.js (메인 리다이렉트 엔진)
 * @description 접속 즉시 세션 상태와 상관없이 대시보드(/v1)로 진입하게 강제 조정
 */
export async function load() {
	// 🚀 [Emergency Fix] 로그인 페이지로 빠지는 현상을 막기 위해 무조건 /v1으로 리다이렉트
	throw redirect(302, '/v1');
}
