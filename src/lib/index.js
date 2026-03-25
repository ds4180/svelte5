/**
 * @file $lib/index.js
 * @description 시스템 엔진 지도 (Engine Registry)
 *   - AppRegistry DB의 main_component 문자열과 실제 컴포넌트를 매핑
 *   - 새 엔진 추가 시 이 파일에만 등록하면 자동으로 동적 마운트됨
 *   @example
 *   // AppRegistry.main_component = 'BoardEngine'
 *   // → Engines['BoardEngine'] = BoardEngine 컴포넌트
 */

export { default as BoardEngine } from '$lib/engines/BoardEngine.svelte';
