import { error, redirect } from '@sveltejs/kit';

/** @type {import('./$types').PageServerLoad} */
export async function load({ params, fetch }) {
	const response = await fetch(`/api/question/detail/${params.id}`);

	if (response.ok) {
		const question = await response.json();
		return { question, error: null };
	} else {
		if (response.status === 401) {
			return { question: null, error: '인증이 필요합니다.' };
		}
		return { question: null, error: '데이터를 불러올 수 없습니다.' };
	}
}
