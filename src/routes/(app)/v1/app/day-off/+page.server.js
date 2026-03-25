import { fail, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/** @type {import('./$types').PageServerLoad} */
export async function load({ fetch, cookies }) {
    const accessToken = cookies.get('accessToken');

    // 토큰 없으면 로그인 페이지로 리다이렉트 (표준 주소 v1 기반)
    if (!accessToken) {
        throw redirect(303, '/login');
    }

    try {
        // hooks.server.js 에서 자동으로 Authorization 헤더를 붙여주므로 깨끗한 fetch 사용 가능
        const response = await fetch(`${env.SERVER_URL}/api/dayoff/list?skip=0&limit=100`);

        if (response.ok) {
            const result = await response.json();
            return {
                dayoff_list: result.data || [],
                total: result.total || 0,
                error: null
            };
        } else {
            if (response.status === 401) throw redirect(303, '/login');
            return { dayoff_list: [], total: 0, error: '데이터를 불러오는데 실패했습니다.' };
        }
    } catch (error) {
        if (error.status === 303) throw error;
        return { dayoff_list: [], total: 0, error: '서버 연결 실패' };
    }
}

/** @type {import('./$types').Actions} */
export const actions = {
    // 휴무일 생성
    create: async ({ request, fetch }) => {
        const formData = await request.formData();
        const datesJson = formData.get('dates');
        const type = formData.get('type');
        const memo = formData.get('memo');

        let dates = [];
        try { dates = JSON.parse(datesJson); } 
        catch (e) { return fail(400, { error: '잘못된 날짜 형식입니다.', type, memo }); }

        if (!dates || dates.length === 0) return fail(400, { error: '날짜를 선택해주세요.', type, memo });

        try {
            const response = await fetch(`${env.SERVER_URL}/api/dayoff/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, dates, memo })
            });

            if (!response.ok) {
                const err = await response.json();
                return fail(response.status, { error: err.detail || '저장에 실패했습니다.', type, memo });
            }
            return { success: true };
        } catch (error) {
            return fail(500, { error: '서버 에러가 발생했습니다.', type, memo });
        }
    },

    // 휴무일 삭제 (취소)
    delete: async ({ request, fetch }) => {
        const formData = await request.formData();
        const dayoff_id = formData.get('dayoff_id');

        try {
            const response = await fetch(`${env.SERVER_URL}/api/dayoff/delete/${dayoff_id}`, {
                method: 'DELETE'
            });

            if (!response.ok) return fail(response.status, { error: '삭제에 실패했습니다.' });
            return { success: true };
        } catch (error) {
            return fail(500, { error: '서버 에러가 발생했습니다.' });
        }
    }
};
