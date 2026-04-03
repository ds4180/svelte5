import { error, redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
    // SvelteKit의 fetch는 hooks.server.js를 통해 /api를 백엔드로 프록시합니다.
    const response = await fetch(`/api/question/detail/${params.id}`);

    if (response.ok) {
        const question = await response.json();
        return { question, error: null };
    } else {
        if (response.status === 401) {
            return { question: null, error: '인증이 필요합니다.' };
        }
        return { question: null, error: '질문을 불러오는 데 실패했습니다.' };
    }
}

/** @type {import('./$types').Actions} */
export const actions = {
    // 질문 삭제 액션
    delete: async ({ params, fetch }) => {
        const response = await fetch('/api/question/delete', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: parseInt(params.id) })
        });

        if (!response.ok) {
            const err = await response.json();
            return { success: false, error: err.detail || '삭제 실패' };
        }

        throw redirect(303, '/v1/app/question');
    }
};
