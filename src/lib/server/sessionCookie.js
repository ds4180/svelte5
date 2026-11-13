/**
 * ============================================================================
 * [하위 호환성 브릿지 모듈 (src/lib/server/sessionCookie.js)]
 * ============================================================================
 * ⚠️ @deprecated
 * 실제 SSR 세션 쿠키 동기화 및 가드 구현은 `src/lib/server/sessionCookie.ts`로 완전 이관되었습니다.
 *
 * 🗑️ 향후 삭제 가이드 (Safe Removal Guide):
 * 1. 프로젝트 내 `.js` 확장자 명시 임포트 검색:
 *    `grep -rn "\$lib/server/sessionCookie\.js" src/`
 * 2. 검색된 파일(`hooks.server.js`, `login/+page.server.js`, `logout/+page.server.js` 등)의
 *    import 경로를 `'$lib/server/sessionCookie'`로 변경한 뒤,
 *    이 파일(`src/lib/server/sessionCookie.js`)을 삭제하면 됩니다.
 * ============================================================================
 */
export * from './sessionCookie.ts';
