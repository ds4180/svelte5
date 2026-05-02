import { redirect } from '@sveltejs/kit';

/**
 * @type {import('./$types').RequestHandler}
 * @description 로그아웃 처리: 인증 쿠키 삭제 및 루트 페이지(/)로 리다이렉트
 */
export async function GET({ cookies }) {
	// 1. 사용자의 액세스 토큰 쿠키 삭제
	cookies.delete('accessToken', { path: '/' });
	// 2. 사용자의 리프레시 토큰 쿠키 삭제
	cookies.delete('refreshToken', { path: '/' });

	// 3. 사용자를 루트 페이지(/)로 리다이렉트
	throw redirect(302, '/');
}
