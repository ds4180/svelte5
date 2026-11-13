/**
 * ============================================================================
 * [전사 통합 API/예외 에러 메시지 정규화 유틸리티 (lib/utils/error.ts)]
 * ============================================================================
 *
 * 💡 역할:
 * 1. FastAPI 422 ValidationError 배열(`detail: [{ loc, msg, ... }]`), 일반 객체(`detail`,
 *    `error.message`, `message`, `msg`, `reason`), Error 인스턴스, 중첩 응답 등 다양한 에러 포맷을
 *    사람이 읽을 수 있는 단일 문자열로 정규화합니다.
 * 2. 클라이언트 토스트(`toast.svelte.ts`), API 게이트웨이(`lib/api/index.ts`), SSR 액션(`+page.server.ts`)
 *    전체에서 단일 진실 공급원(SSOT)으로 재사용하여 `"[object Object]"` 노출을 원천 차단합니다.
 */

const STRING_OBJECT_FALLBACK = '[object Object]';

function extractInternal(raw: unknown, seen: WeakSet<object>): string {
	if (raw == null) return '';

	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		// 이미 문자열로 잘못 직렬화된 '[object Object]'는 무시하고 상위 fallback이 작동하도록 비웁니다.
		return trimmed === STRING_OBJECT_FALLBACK ? '' : trimmed;
	}

	if (typeof raw === 'number' || typeof raw === 'boolean') {
		return String(raw);
	}

	if (Array.isArray(raw)) {
		const parts = raw.map((item) => extractInternal(item, seen)).filter((s) => s.length > 0);
		return parts.join(', ');
	}

	if (typeof raw === 'object') {
		if (seen.has(raw)) return '';
		seen.add(raw);

		const obj = raw as Record<string, unknown>;

		// detail -> error -> message -> msg -> reason 순으로 유효(비공백) 문자열을 재귀 탐색
		// (빈 detail: '' 나 null 인 경우에도 다음 키인 message/msg 로 자연스럽게 폴백됩니다)
		for (const key of ['detail', 'error', 'message', 'msg', 'reason'] as const) {
			if (obj[key] !== undefined && obj[key] !== null) {
				const candidate = extractInternal(obj[key], seen);
				if (candidate) return candidate;
			}
		}

		try {
			const json = JSON.stringify(obj);
			if (json && json !== '{}' && json !== '[]') return json;
		} catch {
			return '';
		}
		return '';
	}

	return '';
}

/**
 * 임의의 에러/페이로드에서 사람이 읽을 수 있는 메시지를 추출합니다. (추출 실패 시 빈 문자열 반환)
 */
export function normalizeErrorMessage(raw: unknown): string {
	return extractInternal(raw, new WeakSet<object>());
}

/**
 * 임의의 에러/페이로드에서 안전하게 에러 메시지를 추출하며, 추출할 내용이 없으면 `fallback`을 반환합니다.
 */
export function formatApiError(err: unknown, fallback: string = '알 수 없는 오류가 발생했습니다.'): string {
	const extracted = normalizeErrorMessage(err);
	return extracted || fallback;
}
