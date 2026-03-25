import { redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private'; // 👈 SvelteKit 환경 변수 방식 채택

/**
 * @file (auth)/login/+page.server.js
 * @description 로그인 상태 체크 및 중복 로그인 방지 로직 (루프 차단 핵심)
 */
export async function load({ locals }) {
    // 📌 이미 로그인 된 상태에서 로그인 페이지 접근 시 즉시 대시보드(/v1)로 탈출
    if (locals.user) {
        throw redirect(302, '/v1');
    }
    return {};
}

/**
 * 로그인 액션 핸들러
 */
export const actions = {
    default: async ({ request, cookies, fetch }) => {
        const formData = await request.formData();
        
        // 백엔드 로그인 API 호출 (환경 변수 또는 기본값 사용)
        const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://fastapi:8000';
        const response = await fetch(`${apiEndpoint}/users/login`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            return { success: false, error: '아이디 혹은 비밀번호가 일치하지 않습니다.' };
        }

        const data = await response.json();
        
        // 인증 토큰 쿠키 설정 (로컬 환경 최적화)
        const opts = { path: '/', httpOnly: true, sameSite: 'lax', secure: false, maxAge: 60 * 60 * 24 };
        cookies.set('accessToken', data.access_token, opts);
        cookies.set('refreshToken', data.refresh_token, { ...opts, maxAge: 60 * 60 * 24 * 3 });

        // 🚀 성공 시 루트를 거치지 않고 대시보드(/v1)로 즉시 투입해 루프 최소화
        throw redirect(302, '/v1');
    }
};
