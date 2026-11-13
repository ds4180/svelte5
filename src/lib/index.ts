/**
 * ============================================================================
 * [시스템 엔진 레지스트리 (src/lib/index.ts)]
 * ============================================================================
 * 💡 역할:
 * - AppRegistry DB의 main_component 문자열과 실제 Svelte 5 엔진 컴포넌트를 매핑합니다.
 * - 새 엔진 및 서비스(댓글, 파일 업로드 등) 추가 시 이 파일에 등록합니다.
 * - 게시판(BoardEngine)은 도메인 응집(Colocation) 표준에 따라 routes/(app)/v1/app/board 로 이전되었습니다.
 */

export { default as CommentEngine } from '$lib/engines/CommentEngine.svelte';
export { default as UploadEngine } from '$lib/engines/UploadEngine.svelte';
