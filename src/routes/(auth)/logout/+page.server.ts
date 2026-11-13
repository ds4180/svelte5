import { redirect } from '@sveltejs/kit';
import { SESSION_COOKIE_OPTIONS } from '$lib/server/sessionCookie';
import type { Actions, PageServerLoad } from './$types';

/**
 * @file logout/+page.server.ts (로그아웃 서버 핸들러)
 * @description GET /logout 프리페치(hover preload) 부작용을 차단하고, POST Form Action으로만 세션을 종료합니다.
 */
export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}
	return { username: locals.user.username };
};

export const actions: Actions = {
	default: async ({ cookies, fetch }) => {
		try {
			await fetch('/api/users/logout', { method: 'POST' });
		} catch (e) {
			console.warn('⚠️ [Logout] Backend notify failed:', e instanceof Error ? e.message : String(e));
		}

		cookies.delete('session_id', SESSION_COOKIE_OPTIONS);
		cookies.delete('accessToken', SESSION_COOKIE_OPTIONS);
		cookies.delete('refreshToken', SESSION_COOKIE_OPTIONS);

		throw redirect(303, '/login');
	}
};
