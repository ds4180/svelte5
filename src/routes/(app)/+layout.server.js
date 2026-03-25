/**
 * @file (app)/+layout.server.js (DB 메뉴 복합 로더)
 * @description hooks.server.js에서 복원된 locals.user를 모든 페이지 레이아웃에 전파
 */
export async function load({ fetch, locals }) {
    let menus = [];
    
    try {
        // 📌 1. DB 동적 메뉴 데이터를 실시간 로드
        const response = await fetch('http://fastapi:8000/v1/admin/menu/public');
        if (response.ok) {
            menus = await response.json();
            console.log("🟢 [Layout SSR] Dynamic Menus Fetched:", menus.length);
        } else {
            console.warn("⚠️ [Layout SSR] Failed to fetch menus (Status:", response.status, ")");
        }
    } catch (err) {
        console.error("❌ [Layout SSR] Backend Fatal Error:", err.message);
        menus = []; // 에러 시 빈 레이아웃으로 최소한의 서비스 유지
    }

    return {
        menus,
        user: locals.user // hooks.server.js에서 이미 채워진 세션 정보
    };
}
