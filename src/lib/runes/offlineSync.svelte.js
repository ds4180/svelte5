/**
 * ============================================================================
 * [하위 호환성 브릿지 모듈 (src/lib/runes/offlineSync.svelte.js)]
 * ============================================================================
 * ⚠️ @deprecated
 * 실제 오프라인 동기화 및 IndexedDB 우체통 엔진은 `src/lib/runes/offlineSync.svelte.ts`로 완전 이관되었습니다.
 *
 * 🗑️ 향후 삭제 가이드 (Safe Removal Guide):
 * 1. 프로젝트 내 `.js` 확장자 명시 임포트 검색:
 *    `grep -rn "\$lib/runes/offlineSync\.svelte\.js" src/`
 * 2. 검색된 파일들의 import 경로를 `'$lib/runes/offlineSync.svelte'`로 변경한 뒤,
 *    이 파일(`src/lib/runes/offlineSync.svelte.js`)을 삭제하면 됩니다.
 * ============================================================================
 */
export * from './offlineSync.svelte.ts';
