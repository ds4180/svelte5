/**
 * @file +layout.server.js (전역 데이터 공급소)
 * @description hooks.server.js에서 복원된 locals.user를 모든 페이지 레이아웃에 전파
 */
export async function load({ locals }) {
    console.log("🎟️ [Layout Server] Restoring Session User:", locals.user?.username || "Guest");
    return {
        user: locals.user || null
    };
}
