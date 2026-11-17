import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const user = locals.user || null;
	let dispatchBriefing = null;

	if (user) {
		const rank = Number(user.rank_level ?? 0);
		const groups = [user.primary_group, ...(Array.isArray(user.all_groups) ? user.all_groups : [])]
			.filter(Boolean)
			.join(' ');
		const isDriver = rank < 4 && (rank === 1 || /운전|운수|승무/.test(groups));

		if (isDriver) {
			try {
				const res = await fetch('/api/v1/custom/my-dispatch-briefing');
				if (res.ok) {
					dispatchBriefing = await res.json();
				}
			} catch {
				// 브리핑 조회 실패 시에도 렌딩 페이지는 정상 렌더링
			}
		}
	}

	return {
		user,
		username: user?.username || null,
		dispatchBriefing
	};
};
