import { fail, isRedirect, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { requireAuthUser } from '$lib/server/sessionCookie';
import { formatApiError } from '$lib/utils/error';
import type { DayoffEntry, DayoffQuotaStatus } from '$lib/types/dayoff';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, cookies, locals, url }) => {
	requireAuthUser(locals, url);
	const sessionId = cookies.get('session_id');

	// 토큰 없으면 로그인 페이지로 리다이렉트 (표준 주소 v1 기반)
	if (!sessionId) {
		throw redirect(303, `/login?redirect=${encodeURIComponent(url.pathname + url.search)}`);
	}

	try {
		// hooks.server.ts 에서 자동으로 Authorization 헤더를 붙여주므로 깨끗한 fetch 사용 가능
		const [listRes, quotaRes] = await Promise.all([
			fetch(`${env.SERVER_URL}/api/dayoff/list?skip=0&limit=100`),
			fetch(`${env.SERVER_URL}/api/dayoff/quota-status`)
		]);

		if (listRes.status === 401 || quotaRes.status === 401) {
			throw redirect(303, '/login');
		}

		const result: { data?: DayoffEntry[]; total?: number } = listRes.ok
			? await listRes.json()
			: { data: [], total: 0 };
		const quotaInfo: DayoffQuotaStatus | null = quotaRes.ok ? await quotaRes.json() : null;

		return {
			dayoff_list: result.data || [],
			total: result.total || 0,
			quota_info: quotaInfo,
			error: listRes.ok ? null : '데이터를 불러오는데 실패했습니다.'
		};
	} catch (err) {
		if (isRedirect(err)) throw err;
		return {
			dayoff_list: [] as DayoffEntry[],
			total: 0,
			quota_info: null as DayoffQuotaStatus | null,
			error: '서버 연결 실패'
		};
	}
};

export const actions: Actions = {
	// 휴무일 생성
	create: async ({ request, fetch }) => {
		const formData = await request.formData();
		const datesJson = formData.get('dates');
		const typeRaw = formData.get('type');
		const memoRaw = formData.get('memo');
		const type = typeof typeRaw === 'string' && typeRaw.trim() ? typeRaw.trim() : null;
		const memo = typeof memoRaw === 'string' ? memoRaw : '';

		let dates: string[] = [];
		try {
			const parsed = typeof datesJson === 'string' ? JSON.parse(datesJson) : [];
			dates = Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === 'string') : [];
		} catch {
			return fail(400, { error: '잘못된 날짜 형식입니다.', type, memo });
		}

		if (!dates || dates.length === 0) {
			return fail(400, { error: '날짜를 선택해주세요.', type, memo });
		}

		try {
			const response = await fetch(`${env.SERVER_URL}/api/dayoff/create`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type, dates, memo })
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: formatApiError(err, '저장에 실패했습니다.'),
					type,
					memo
				});
			}
			return { success: true };
		} catch {
			return fail(500, { error: '서버 에러가 발생했습니다.', type, memo });
		}
	},

	// 휴무일 삭제 (취소)
	delete: async ({ request, fetch }) => {
		const formData = await request.formData();
		const dayoffIdRaw = formData.get('dayoff_id');
		const dayoff_id = typeof dayoffIdRaw === 'string' ? dayoffIdRaw.trim() : '';

		if (!dayoff_id) {
			return fail(400, { error: '취소할 휴무 신청 ID가 올바르지 않습니다.' });
		}

		try {
			const response = await fetch(`${env.SERVER_URL}/api/dayoff/delete/${dayoff_id}`, {
				method: 'DELETE'
			});

			if (!response.ok) {
				const err = await response.json().catch(() => ({}));
				return fail(response.status, {
					error: formatApiError(err, '삭제에 실패했습니다.')
				});
			}
			return { success: true };
		} catch {
			return fail(500, { error: '서버 에러가 발생했습니다.' });
		}
	}
};
