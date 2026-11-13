/**
 * ============================================================================
 * [하위 호환성 브릿지 모듈 (src/lib/runes/auth.svelte.js)]
 * ============================================================================
 * ⚠️ @deprecated
 * 실제 인증 룬 상태 및 SSR Context 격리 엔진(`setAuthContext`, `getAuthContext`, `auth`)은
 * `src/lib/runes/auth.svelte.ts`로 완전 이관되었습니다.
 *
 * 🗑️ 향후 삭제 가이드 (Safe Removal Guide):
 * 1. 프로젝트 내 `.js` 확장자 명시 임포트 검색:
 *    `grep -rn "\$lib/runes/auth\.svelte\.js" src/`
 * 2. 검색된 파일들의 import 경로를 `'$lib/runes/auth.svelte'`로 변경한 뒤,
 *    이 파일(`src/lib/runes/auth.svelte.js`)을 삭제하면 됩니다.
 * ============================================================================
 */
export * from './auth.svelte.ts';
