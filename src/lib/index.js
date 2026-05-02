/**
 * @file $lib/index.js
 * @description 시스템 엔진 지도 (Engine Registry)
 *   - AppRegistry DB의 main_component 문자열과 실제 컴포넌트를 매핑
 *   - 새 엔진 및 서비스(댓글 등) 추가 시 이 파일에 등록 필수
 */

// 🧩 전역 엔진 (메인 컴포넌트로 호출 가능)
export { default as BoardEngine } from '$lib/engines/BoardEngine.svelte';

// 🥨 서비스 바인딩 (게시물 하단에 바인딩되어 호출됨)
export { default as CommentEngine } from '$lib/engines/CommentEngine.svelte';
export { default as UploadEngine } from '$lib/engines/UploadEngine.svelte';
