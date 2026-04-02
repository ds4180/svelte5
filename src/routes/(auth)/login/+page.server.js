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
        
        // 백엔드 로그인 API 호출
        const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://fastapi:8000';
        const response = await fetch(`${apiEndpoint}/users/login`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            return { success: false, error: '아이디 혹은 비밀번호가 일치하지 않습니다.' };
        }

        // 📌 백엔드 응답에서 session_id 쿠키 추출 및 설정 (JTI-Redis 조합 핵심)
        const setCookie = response.headers.get('set-cookie');
        if (setCookie) {
            // "session_id=xxx; ..." 형태에서 session_id 값을 추출
            const sessionIdMatch = setCookie.match(/session_id=([^;]+)/);
            if (sessionIdMatch) {
                const sessionId = sessionIdMatch[1];
                
                // 백엔드가 설정한 쿠키 사양과 동일하게 브라우저에 구워줍니다.
                cookies.set('session_id', sessionId, {
                    path: '/',
                    httpOnly: true,
                    sameSite: 'lax',
                    secure: false, // 로컬 개발 대응 (Production 환경에서는 배포 서버 환경에 맞춰야 함)
                    maxAge: 60 * 60 * 24 * 3 // 3일 (백엔드와 동일하게 맞춤)
                });
                console.log("✅ [Login] JTI Session established:", sessionId.substring(0, 8) + "...");
            }
        }

        // 🚀 로그인 성공 시 대시보드로 이동
        throw redirect(302, '/v1');
    }
};
