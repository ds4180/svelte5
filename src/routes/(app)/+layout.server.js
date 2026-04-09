/**
 * @file (app)/+layout.server.js (Optimized Menu Loader)
 */
export async function load({ fetch, locals }) {
	let menus = [];

	// 📌 이미 locals.user가 있다면 유저 정보는 hooks에서 가져왔으므로
	// 메뉴 정보만 가져오면 됩니다.
	// fetch 함수는 SvelteKit의 fetch를 사용하여 handleFetch 프록시를 타게 합니다.
	try {
		const response = await fetch('/api/v1/admin/menu/public');
		if (response.ok) {
			menus = await response.json();
		} else {
			console.warn('⚠️ [Layout SSR] Failed to fetch menus:', response.status);
		}
	} catch (err) {
		console.error('❌ [Layout SSR] Backend Fatal Error:', err.message);
	}

	return {
		menus,
		user: locals.user // hooks.server.js에서 이미 채워진 정보 사용
	};
}
