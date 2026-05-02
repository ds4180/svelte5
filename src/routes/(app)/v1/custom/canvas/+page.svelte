<script>
	/**
	 * @file (app)/v1/app/canvas/+page.svelte
	 * @description [Restored] Canvas 2D 드로잉 데모 및 약도 서비스 (Svelte 5 & DaisyUI)
	 */
	import Canvas from '$lib/components/Canvas.svelte';
	import Icon from '@iconify/svelte';

	let buildingColor = $state('lightgray');
	let isPathHighlighted = $state(false);

	/**
	 * @function toggleHighlight
	 * @description 경로 강조 상태 토글
	 */
	function toggleHighlight() {
		isPathHighlighted = !isPathHighlighted;
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-5xl space-y-12 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- Header Section -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase"
				>Navigation Engine v1.0</span
			>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				약도 <span class="NOT-ITALIC text-rose-600"
					>도면 <Icon
						icon="mdi:drawing-box"
						class="ml-1 inline-block align-text-bottom text-rose-600"
					/></span
				>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				2D 캔버스 API를 활용하여 정교한 위치 정보와 도면을 작성합니다.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				class="btn btn-lg {isPathHighlighted
					? 'btn-neutral'
					: 'btn-ghost'} rounded-2xl border-2 border-slate-900 px-8 text-xs font-black uppercase shadow-xl transition-all"
				onclick={toggleHighlight}
			>
				<Icon icon={isPathHighlighted ? 'mdi:eye-off' : 'mdi:eye-check'} class="mr-1 h-5 w-5" />
				{isPathHighlighted ? 'Highlight Off' : 'Highlight Target'}
			</button>
		</div>
	</div>

	<!-- Drawing Board Content -->
	<div class="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
		<!-- Left: Canvas Area -->
		<div
			class="flex min-h-[500px] items-center justify-center rounded-[3rem] border-2 border-slate-900 bg-white p-8 shadow-2xl md:p-14 lg:col-span-8"
		>
			<Canvas {buildingColor} bind:isPathHighlighted />
		</div>

		<!-- Right: Control Panel Area -->
		<div class="space-y-6 lg:col-span-4">
			<div
				class="rounded-[3.5rem] border-2 border-slate-900 bg-indigo-600 p-10 text-white shadow-2xl"
			>
				<h3
					class="mb-10 border-b border-indigo-400 pb-4 text-3xl font-black tracking-tighter uppercase italic"
				>
					Architectural Config
				</h3>

				<div class="space-y-8">
					<div class="space-y-4">
						<label class="block text-[10px] font-black tracking-[0.2em] uppercase opacity-60"
							>Asset Colorimetry</label
						>
						<div class="grid grid-cols-4 gap-4">
							{#each ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b'] as color}
								<button
									class="aspect-square w-full rounded-2xl border-4 transition-all {buildingColor ===
									color
										? 'scale-110 border-white shadow-lg'
										: 'border-transparent'}"
									style="background: {color};"
									onclick={() => (buildingColor = color)}
								></button>
							{/each}
						</div>
					</div>

					<div class="flex flex-col items-center border-t border-indigo-400 pt-10">
						<Icon icon="mdi:cube-scan" class="mb-6 h-16 w-16 text-indigo-400" />
						<p
							class="text-center text-[10px] font-black tracking-widest text-indigo-200 uppercase italic"
						>
							2D Vector Raster Engine Active. Renders are calculated based on reactive svelte 5
							runes.
						</p>
					</div>
				</div>
			</div>

			<!-- Operational Notice Log -->
			<div class="rounded-[2.5rem] border-2 border-slate-900 bg-white p-8 shadow-xl">
				<h4
					class="mb-4 flex items-center gap-2 text-xs font-black tracking-widest text-slate-800 uppercase italic"
				>
					<span class="h-2 w-2 animate-pulse rounded-full bg-rose-500"></span>
					Live Feed Status
				</h4>
				<div class="space-y-3 font-mono text-[9px] leading-none text-slate-500">
					<p>[{new Date().toISOString()}] Initializing raster engine...</p>
					<p>[{new Date().toISOString()}] Draw sequence executed.</p>
					<p>[{new Date().toISOString()}] Building color changed to {buildingColor}.</p>
					<p>[{new Date().toISOString()}] Path highlight set to {isPathHighlighted}.</p>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
