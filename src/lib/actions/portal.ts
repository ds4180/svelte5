/**
 * ============================================================================
 * [전사 공통 Svelte DOM 포탈 액션 (lib/actions/portal.ts)]
 * ============================================================================
 * 
 * 💡 역할:
 * 부모의 transform(CSS 애니메이션), overflow: hidden, z-index Stacking Context를 100% 탈출하여
 * 지정된 타겟(기본값: document.body)의 최상단 직계 자식으로 DOM 노드를 텔레포트합니다.
 * 
 * 🌟 주요 용도:
 * - 풀스크린 모달, 이미지/파일 상세 뷰어 다이얼로그
 * - 드롭다운 메뉴, 툴팁, 플로팅 팝오버
 * - 상단 고정 헤더(navbar)나 하단 탭에 가려지지 않아야 하는 모든 최상위 오버레이 UI
 * 
 * @example
 * <script>
 *   import { portal } from '$lib/actions/portal';
 * </script>
 * 
 * <div use:portal class="fixed inset-0 z-[9999] ...">
 *   <!-- 브라우저 최상위에서 렌더링되는 모달 -->
 * </div>
 */

export type PortalTarget = HTMLElement | string;

export function portal(node: HTMLElement, target: PortalTarget = 'body') {
	let targetEl: HTMLElement | null = null;

	function update(newTarget: PortalTarget = 'body') {
		if (typeof document === 'undefined') return;

		if (typeof newTarget === 'string') {
			targetEl = document.querySelector(newTarget);
		} else if (newTarget instanceof HTMLElement) {
			targetEl = newTarget;
		} else {
			targetEl = document.body;
		}

		if (targetEl && node.parentNode !== targetEl) {
			targetEl.appendChild(node);
		}
	}

	update(target);

	return {
		update,
		destroy() {
			if (node.parentNode) {
				node.parentNode.removeChild(node);
			}
		}
	};
}
