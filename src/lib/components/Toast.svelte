<script lang="ts">
	/**
	 * ============================================================================
	 * [시스템 기본 알림 뷰어 컴포넌트 (lib/components/Toast.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 파일의 역할:
	 * API 오류, 네트워크 실패, 폼 검증 안내 등 시스템의 일상적인 피드백을
	 * 화면 우측 하단에 조용하고 깔끔하게 띄워주는 DaisyUI 5 기반 기본 토스트입니다.
	 * 
	 * 🌟 사내 알림 앱(Alert)과의 차별점:
	 * - 거대한 모달이나 전역 쉬머 배너를 띄우지 않고, 우측 하단에서 3~4초 뒤 자동 소멸합니다.
	 * - 사내 업무 공지와 시스템 피드백이 시각적으로 명확하게 구분됩니다.
	 */
	import { toast, type ToastItem } from '$lib/runes/toast.svelte';
	import { fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	// 타입별 DaisyUI 클래스 및 아이콘 매핑
	const TYPE_CONFIG = {
		info: {
			alertClass: 'alert-info text-info-content',
			icon: 'mdi:information-outline',
			label: '안내'
		},
		success: {
			alertClass: 'alert-success text-success-content',
			icon: 'mdi:check-circle-outline',
			label: '완료'
		},
		warning: {
			alertClass: 'alert-warning text-warning-content',
			icon: 'mdi:alert-outline',
			label: '주의'
		},
		error: {
			alertClass: 'alert-error text-error-content',
			icon: 'mdi:alert-circle-outline',
			label: '오류'
		}
	};
</script>

<!-- 🍞 화면 우측 하단 기본 토스트 컨테이너 (모바일 퀵메뉴 상단 안착 및 z-index 최상위 보장) -->
{#if toast.items.length > 0}
	<aside
		class="toast toast-end toast-bottom z-[10002] mb-20 mr-2 flex max-w-sm flex-col gap-2 p-0 md:mb-4 md:mr-4"
		aria-live="polite"
		aria-label="시스템 알림"
	>
		{#each toast.items as item (item.id)}
			{@const config = TYPE_CONFIG[item.type] || TYPE_CONFIG.info}
			<div
				class="alert {config.alertClass} flex items-center justify-between rounded-2xl border-none px-4 py-3 shadow-xl backdrop-blur-md"
				transition:fly={{ y: 20, duration: 250 }}
				role="alert"
			>
				<div class="flex items-center gap-3 overflow-hidden">
					<Icon icon={config.icon} class="h-6 w-6 shrink-0" />
					<div class="flex flex-col overflow-hidden">
						<span class="text-xs font-semibold opacity-80 uppercase tracking-wider">{config.label}</span>
						<span class="text-sm font-medium leading-snug break-words whitespace-pre-wrap">{item.message}</span>
					</div>
				</div>

				<!-- 수동 닫기 버튼 -->
				<button
					type="button"
					class="btn btn-circle btn-ghost btn-xs shrink-0 opacity-70 hover:opacity-100"
					onclick={() => toast.remove(item.id)}
					aria-label="닫기"
				>
					✕
				</button>
			</div>
		{/each}
	</aside>
{/if}
