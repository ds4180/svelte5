import type { HandleClientError } from '@sveltejs/kit';

/**
 * ============================================================================
 * [SvelteKit 공식 클라이언트 훅 (src/hooks.client.ts)]
 * ============================================================================
 * 💡 역할:
 * 새 버전 배포 직후, 이미 열려 있던 구버전 화면이 서버에서 사라진 청크(_app/immutable/...)를
 * 불러오려다 실패(Failed to fetch dynamically imported module 등)하는 경우,
 * 500 에러 화면 대신 목표 페이지를 1회 전체 새로고침하여 최신 버전으로 복구합니다.
 *
 * 📌 표준 처리 방식:
 * - 빌드 해시 기반 파일명이므로 디스크 캐시를 수동으로 갱신할 필요가 없습니다.
 *   전체 새로고침 시 새 HTML → 새 청크 경로를 받아오며, 서비스 워커는 버전별 캐시로 자동 교체됩니다.
 * - 배포 감지의 1차 방어선은 +layout.svelte 의 `updated` (kit.version.pollInterval) 입니다.
 */

const CHUNK_ERROR_PATTERNS = [
	'Failed to fetch dynamically imported module',
	'Importing a module script failed',
	'error loading dynamically imported module',
	'Unable to preload CSS'
];

export const handleError: HandleClientError = ({ error, event, message }) => {
	const errMsg = error instanceof Error ? error.message : String((error as { message?: unknown })?.message || message || '');
	const isChunkLoadError = CHUNK_ERROR_PATTERNS.some((p) => errMsg.includes(p));

	if (isChunkLoadError) {
		const targetUrl = event?.url?.href || window.location.href;
		const guardKey = `jeju_self_heal_${event?.url?.pathname || window.location.pathname}`;

		// 무한 리로드 방지: 경로당 세션 내 1회만 자동 복구
		if (!sessionStorage.getItem(guardKey)) {
			sessionStorage.setItem(guardKey, String(Date.now()));
			console.warn('🔄 [Self-Healing] 구버전 청크 로드 실패 -> 최신 버전으로 새로고침:', errMsg);
			window.location.href = targetUrl;
			return { message: '최신 화면 구성을 불러오는 중입니다...' };
		}
	}

	console.error('🚨 [Client Error]:', error);
	return {
		message: message || '일시적인 화면 로드 오류가 발생했습니다.'
	};
};
