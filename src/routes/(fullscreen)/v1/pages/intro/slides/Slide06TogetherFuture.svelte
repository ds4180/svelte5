<script lang="ts">
	/**
	 * ============================================================================
	 * [6장 마무리 슬라이드: "우리 모두 함께, 더 스마트한 내일로!"]
	 * ============================================================================
	 * 1~5장 핵심 한눈에 요약 + 감사 인사 + 처음부터 다시 보기 / 웹앱 바로 가기
	 */
	import Icon from '@iconify/svelte';

	let { onRestart }: { onRestart?: () => void } = $props();

	const recap = [
		{ num: '01', text: '밴드를 넘어 우리만의 웹앱으로!' },
		{ num: '02', text: '중앙 서버로 모든 정보를 한 곳에!' },
		{ num: '03', text: '24시간 365일, 어떤 기기든 척척!' },
		{ num: '04', text: '대 AI 시대, 앞으로 10년의 혁신!' },
		{ num: '05', text: '6개월의 산고 뒤에 오는 달콤한 열매!' }
	];
</script>

<section class="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 lg:gap-6">
	<!-- 1. 크고 따뜻한 엔딩 타이틀 -->
	<div class="text-center">
		<span class="inline-block rounded-full bg-sky-100 px-4 py-1 text-xs font-black tracking-wider text-sky-800 ring-1 ring-sky-300">
			FINAL CHAPTER · 함께 만드는 내일
		</span>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
			모두 함께, <span class="text-blue-600">더 스마트한 내일로!</span> 🚌✨
		</h1>
		<p class="mt-2 text-base font-extrabold text-slate-500 sm:text-xl">
			기사님 · 사무실 · 경영진이 하나로 뭉치면 못 할 일이 없어요!
		</p>
	</div>

	<!-- 2. 피날레 일러스트 + 5장 한눈에 요약 -->
	<div class="grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-12">
		<!-- 메인 피날레 일러스트 -->
		<div class="lg:col-span-7">
			<div class="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl shadow-blue-900/10 ring-1 ring-sky-200/80">
				<img
					src="/images/intro/slide6-finale-together.jpg"
					alt="기사님, 사무실 직원, 현장 관리자, 상무님이 파란 버스 앞에서 함께 환호하는 모습"
					class="aspect-[16/10] w-full object-cover"
				/>
				<div class="absolute top-3 right-3 rounded-full bg-blue-600/90 px-3.5 py-1 text-xs font-black text-white shadow">
					🎉 감사합니다!
				</div>
			</div>
		</div>

		<!-- 우측: 1~5장 초간결 요약 + 액션 버튼 -->
		<div class="flex flex-col gap-3.5 lg:col-span-5">
			<div class="rounded-3xl border-2 border-sky-200 bg-white/95 p-4 shadow-sm">
				<div class="mb-2.5 flex items-center gap-2">
					<span class="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-xs font-black text-white">
						✓
					</span>
					<h2 class="text-base font-black text-slate-900">오늘의 이야기 한눈에!</h2>
				</div>
				<ul class="space-y-2">
					{#each recap as item}
						<li class="flex items-center gap-2.5 rounded-2xl bg-sky-50/70 px-3 py-2 text-sm font-black text-slate-800">
							<span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">
								{item.num}
							</span>
							<span>{item.text}</span>
						</li>
					{/each}
				</ul>
			</div>

			<!-- 하단 액션 버튼 2종 -->
			<div class="grid grid-cols-2 gap-2.5">
				<button
					type="button"
					onclick={() => onRestart?.()}
					class="inline-flex items-center justify-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-black text-slate-800 shadow-sm transition hover:bg-slate-900 hover:text-white sm:text-sm"
				>
					<Icon icon="solar:restart-bold" class="text-base" />
					<span>처음부터 보기</span>
				</button>
				<a
					href="/v1"
					class="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-3 text-xs font-black text-white shadow-md transition hover:bg-blue-700 sm:text-sm"
				>
					<Icon icon="solar:rocket-2-bold" class="text-base" />
					<span>웹앱 시작하기</span>
				</a>
			</div>
		</div>
	</div>

	<!-- 3. 마무리 감사 인사 배지 -->
	<div class="inline-flex items-center gap-2.5 rounded-full bg-slate-900 px-7 py-2.5 text-sm font-black text-white shadow-lg sm:text-lg">
		<span>🙏</span>
		<span>끝까지 들어주셔서 <span class="text-amber-300">감사합니다!</span> 함께 시작해 봐요!</span>
	</div>
</section>
