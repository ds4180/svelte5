/**
 * @file $lib/index.js
 * @description 시스템 엔진 지도 (Engine Registry)
 *   - AppRegistry DB의 main_component 문자열과 실제 컴포넌트를 매핑
 *   - 새 엔진 및 서비스(댓글 등) 추가 시 이 파일에 등록 필수
 *   - 💡 게시판(BoardEngine)은 도메인 응집(Colocation) 표준에 따라 routes/app/board 로 완전 이전됨.
 */

// 🥨 서비스 바인딩 (게시물 하단에 바인딩되어 호출됨)
export { default as CommentEngine } from '$lib/engines/CommentEngine.svelte';
export { default as UploadEngine } from '$lib/engines/UploadEngine.svelte';
