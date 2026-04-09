/**
 * @file (app)/+layout.server.js (Optimized Menu Loader with ID-to-Slug Resolution)
 */
export async function load({ fetch, locals }) {
	let menus = [];
	let boards = [];
	let pages = [];

	try {
		// 1. 필요한 모든 데이터를 병렬로 로드
		const [menuRes, boardRes, pageRes] = await Promise.all([
			fetch('/api/v1/admin/menu/public'),
			fetch('/api/v1/admin/boards'),
			fetch('/api/v1/page/admin/list')
		]);

		if (menuRes.ok) menus = await menuRes.json();
		if (boardRes.ok) boards = await boardRes.json();
		if (pageRes.ok) pages = await pageRes.json();

		// 2. ID -> Slug 변환 및 URL 완성 함수 정의 (재귀)
		const resolveSlugs = (menuList) => {
			return menuList.map(menu => {
				const m = { ...menu };
				
				// [1] APP/CUSTOM 타입인 경우 인스턴스 ID를 슬러그로 변환 및 URL 생성
				if ((m.link_type === 'APP' || m.link_type === 'CUSTOM') && m.app_id) {
					let slugPart = '';
					
					// 인스턴스 ID가 숫자로 존재하는 경우 Slug로 치환 시도
					if (m.app_instance_id && m.app_instance_id != -1) {
						if (m.app_id === 'board') {
							const found = boards.find(b => b.id == m.app_instance_id);
							slugPart = found ? `/${found.slug}` : `/${m.app_instance_id}`;
						} else if (m.app_id === 'page') {
							const found = pages.find(p => p.id == m.app_instance_id);
							slugPart = found ? `/${found.slug}` : `/${m.app_instance_id}`;
						} else {
							slugPart = `/${m.app_instance_id}`;
						}
					}
					
					// 최종 URL 완성 (관리자 여부 판별 포함)
					const is_admin = m.app_instance_id == -1 || m.page_mode === 'admin';
					const prefix = is_admin ? 'admin' : (m.link_type === 'CUSTOM' ? 'custom' : 'app');
					m.external_url = `/v1/${prefix}/${m.app_id}${slugPart}`;
				}

				// [2] 서브 메뉴가 있다면 재귀 호출
				if (m.sub_menus && m.sub_menus.length > 0) {
					m.sub_menus = resolveSlugs(m.sub_menus);
				}
				return m;
			});
		};

		// 3. 전체 메뉴 트리에 대해 Slug 변환 실행
		if (menus.length > 0) {
			menus = resolveSlugs(menus);
		}

	} catch (err) {
		console.error('❌ [Layout SSR] Backend Fatal Error:', err.message);
	}

	return {
		menus,
		user: locals.user
	};
}
