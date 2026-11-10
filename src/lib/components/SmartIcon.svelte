<script>
	/**
	 * @file src/lib/components/SmartIcon.svelte
	 * @description Iconify 문자열('ph:rocket-fill', 'bi:link-45deg'), 레거시 접두사('bi-link'),
	 *              및 이모지('🚀')를 자동으로 판별하여 깨짐 없이 렌더링하는 공용 스마트 아이콘 컴포넌트
	 */
	import Icon from '@iconify/svelte';

	/**
	 * @typedef {Object} Props
	 * @property {string | null | undefined} [icon] - DB나 설정에서 전달된 아이콘 문자열 또는 이모지
	 * @property {string} [fallback] - 값이 비어있을 때 출력할 기본 Iconify 아이콘
	 * @property {string} [class] - Iconify SVG에 적용할 CSS 클래스
	 * @property {string} [emojiClass] - 이모지/텍스트에 적용할 CSS 클래스
	 */
	let {
		icon = '',
		fallback = 'ph:rocket-fill',
		class: className = 'h-4.5 w-4.5',
		emojiClass = 'text-base leading-none'
	} = $props();

	let resolved = $derived.by(() => {
		const raw = (icon || '').trim();
		if (!raw) return { type: 'iconify', value: fallback };
		if (raw.includes(':')) return { type: 'iconify', value: raw };

		// 'bi-link', 'mdi-home', 'ph-user' 등 레거시 하이픈 접두사 호환 변환
		const legacyMatch = raw.match(/^(bi|mdi|ph|fa|lucide|heroicons)-(.+)$/i);
		if (legacyMatch) {
			return { type: 'iconify', value: `${legacyMatch[1].toLowerCase()}:${legacyMatch[2]}` };
		}

		// 그 외 문자열(이모지 등)은 텍스트로 직접 출력
		return { type: 'emoji', value: raw };
	});
</script>

{#if resolved.type === 'iconify'}
	<Icon icon={resolved.value} class={className} />
{:else}
	<span class={emojiClass} aria-hidden="true">{resolved.value}</span>
{/if}
