import { redirect } from '@sveltejs/kit';

/**
 * @file logout/+page.server.js (로그아웃 서버 핸들러)
 * @description 쿠키를 즉시 만료시키고 최상위 루트(/)로 리다이렉션
 */
export async function load({ cookies }) {
    // 1. 모든 인증 쿠키를 즉각 만료 처리 (Path: / 기준)
    cookies.set('accessToken', '', { path: '/', maxAge: 0 });
    cookies.set('refreshToken', '', { path: '/', maxAge: 0 });

    // 2. 🚀 성공 즉시 최상위 루트(/)로 리다이렉션
    throw redirect(302, '/');
}
