<script lang="ts">
	/**
	 * @file PushOptionSection.svelte
	 * @description 게시판·배차·휴무·블랙박스 등 어느 관리자 설정 화면에서도 재사용 가능한 공용 웹 푸시 옵션 토글 섹션
	 */
	export interface PushOptionItem {
		key: string;
		title: string;
		desc: string;
	}

	interface Props {
		title?: string;
		subtitle?: string;
		options?: Record<string, any>;
		items?: PushOptionItem[];
		onToggle?: (key: string, checked: boolean) => void;
	}

	let {
		title = '웹 푸시 알림 연동 (Web Push)',
		subtitle = '이벤트 발생 시 모바일·PC 구독자에게 백그라운드 푸시 알림을 발송합니다.',
		options = {},
		items = [],
		onToggle
	}: Props = $props();

	function isEnabled(key: string): boolean {
		const val = options?.[key];
		return typeof val === 'object' && val !== null ? Boolean(val.value) : Boolean(val);
	}
</script>

{#if items.length > 0}
	<div class="space-y-3 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 sm:p-5">
		<div>
			<h4 class="text-xs font-black text-slate-800">{title}</h4>
			{#if subtitle}
				<p class="text-[11px] text-slate-500">{subtitle}</p>
			{/if}
		</div>
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
			{#each items as item (item.key)}
				<label class="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-300">
					<input
						type="checkbox"
						checked={isEnabled(item.key)}
						onchange={(e) => onToggle?.(item.key, e.currentTarget.checked)}
						class="checkbox checkbox-sm checkbox-primary mt-0.5"
					/>
					<div>
						<span class="block text-xs font-black text-slate-800">{item.title}</span>
						<span class="block text-[11px] text-slate-500">{item.desc}</span>
					</div>
				</label>
			{/each}
		</div>
	</div>
{/if}
