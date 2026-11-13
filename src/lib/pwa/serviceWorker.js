/**
 * ============================================================================
 * [하위 호환성 브릿지 모듈 (src/lib/pwa/serviceWorker.js)]
 * ============================================================================
 * ⚠️ @deprecated
 * 실제 PWA 서비스 워커 및 Web Push 구독 제어 로직은 `src/lib/pwa/serviceWorker.ts`로 완전 이관되었습니다.
 *
 * 🗑️ 향후 삭제 가이드 (Safe Removal Guide):
 * 1. 프로젝트 내 `.js` 확장자 명시 임포트 검색:
 *    `grep -rn "\$lib/pwa/serviceWorker\.js" src/`
 * 2. 검색된 파일들의 import 경로를 `'$lib/pwa/serviceWorker'`로 변경한 뒤,
 *    이 파일(`src/lib/pwa/serviceWorker.js`)을 삭제하면 됩니다.
 * ============================================================================
 */
export * from './serviceWorker.ts';
