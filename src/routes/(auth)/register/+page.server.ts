import { redirect, fail } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, fetch }) {
	if (locals.user) {
		throw redirect(302, '/');
	}

	const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://backend:8000';
	let registerMode = 'ADMIN_ONLY';

	try {
		const res = await fetch(`${apiEndpoint}/users/register-mode`);
		if (res.ok) {
			const data = await res.json();
			registerMode = data.register_mode || 'ADMIN_ONLY';
		}
	} catch (e) {
		console.error('[Register SSR] Failed to get register-mode:', e);
	}

	return { registerMode };
}

export const actions = {
	default: async ({ request, fetch }) => {
		const formData = await request.formData();
		const username = formData.get('username')?.toString() || '';
		const password1 = formData.get('password1')?.toString() || '';
		const password2 = formData.get('password2')?.toString() || '';
		const email = formData.get('email')?.toString() || '';
		const apiEndpoint = env.PUBLIC_API_ENDPOINT || 'http://backend:8000';

		if (!username.trim() || !password1.trim() || !email.trim()) {
			return fail(400, {
				error: { detail: '모든 필수 항목을 입력해주세요.' }
			});
		}

		if (password1 !== password2) {
			return fail(400, {
				error: { detail: '비밀번호 확인이 일치하지 않습니다.' }
			});
		}

		try {
			const res = await fetch(`${apiEndpoint}/users/create`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					username,
					password1,
					password2,
					email
				})
			});

			if (!res.ok) {
				const errData = await res.json().catch(() => ({}));
				return fail(res.status, {
					error: { detail: errData.detail || '가입 처리에 실패했습니다.' }
				});
			}

			const created = await res.json();
			return {
				success: true,
				username: created.username,
				rank_level: created.rank_level ?? 0
			};
		} catch (e) {
			return fail(500, {
				error: { detail: '서버 연결에 실패했습니다.' }
			});
		}
	}
};
