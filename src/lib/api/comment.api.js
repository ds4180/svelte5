/**
 * ============================================================================
 * [하위 호환성 브릿지 모듈 (src/lib/api/comment.api.js)]
 * ============================================================================
 * ⚠️ @deprecated
 * 실제 댓글(Comment) API 구현은 `src/lib/api/comment.ts`로 완전 이관되었습니다.
 *
 * 🗑️ 향후 삭제 가이드 (Safe Removal Guide):
 * 1. 프로젝트 내 `comment.api.js` 임포트 검색:
 *    `grep -rn "\$lib/api/comment\.api" src/`
 * 2. 검색된 파일들의 import 경로를 `'$lib/api/comment'`로 변경한 뒤,
 *    이 파일(`src/lib/api/comment.api.js`)을 삭제하면 됩니다.
 * ============================================================================
 */
export * from './comment';
