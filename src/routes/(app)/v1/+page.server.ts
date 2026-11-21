import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, fetch }) => {
	const user = locals.user || null;
	let dispatchBriefing = null;
	let initialMiniappSummary = null;

	if (user) {
		const rank = Number(user.rank_level ?? 0);
		// 랭크 2: 기사 화면 전용 당일/명일 근무·휴무 브리핑 선조회
		if (rank === 2) {
			try {
				const res = await fetch('/api/v1/custom/my-dispatch-briefing');
				if (res.ok) {
					dispatchBriefing = await res.json();
				}
			} catch {
				// 브리핑 조회 실패 시에도 렌딩 페이지는 정상 렌더링
			}
		} else if (rank >= 3) {
			// 랭크 3+: 사무실/관리자 미니앱 요약 SSR 선조회 (로딩 중 가짜 100% 차단)
			try {
				const res = await fetch('/api/v1/miniapps/summary');
				if (res.ok) {
					initialMiniappSummary = await res.json();
				}
			} catch {
				// 선조회 실패 시 클라이언트 ensureSummaryLoaded에서 1회 재시도
			}
		}
	}

	return {
		user,
		username: user?.username || null,
		dispatchBriefing,
		initialMiniappSummary
	};
};
