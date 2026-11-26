<script lang="ts">
	/**
	 * ============================================================================
	 * [5장 슬라이드: "6개월의 산고, 그 열매는 달다!"]
	 * ============================================================================
	 * 그림 중심 + 3단계 여정(6개월 개발 → 잠깐의 불편함 → 달콤한 열매) 초간결 구성
	 */
	const stages = [
		{
			emoji: '⏳',
			step: 'STEP 1 · 약 6개월',
			title: '개발 완료까지 함께 짓는 시간!',
			boxClass: 'border-amber-200 bg-amber-50/80',
			badgeClass: 'bg-amber-600 text-white'
		},
		{
			emoji: '💪',
			step: 'STEP 2 · 산고의 고통',
			title: '잠깐의 불편함 & 복수 작업은 필수 과정!',
			boxClass: 'border-rose-200 bg-rose-50/80',
			badgeClass: 'bg-rose-600 text-white'
		},
		{
			emoji: '🍎',
			step: 'STEP 3 · 그 이후!',
			title: '모두가 웃으며 일하는 달콤한 열매!',
			boxClass: 'border-emerald-300 bg-emerald-50/90',
			badgeClass: 'bg-emerald-600 text-white'
		}
	];
</script>

<section class="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 lg:gap-6">
	<!-- 1. 크고 시원한 타이틀 -->
	<div class="text-center">
		<span class="inline-block rounded-full bg-emerald-100 px-4 py-1 text-xs font-black tracking-wider text-emerald-800 ring-1 ring-emerald-300">
			CHAPTER 05
		</span>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
			잠깐의 산고, <span class="text-emerald-600">그 열매는 달다!</span> 🍎
		</h1>
		<p class="mt-2 text-base font-extrabold text-slate-500 sm:text-xl">
			앞으로 <span class="text-amber-600">약 6개월</span>은 힘들지만, 그 뒤엔 훨씬 편한 내일이 기다려요!
		</p>
	</div>

	<!-- 2. 그림 중심 + 우측 3단계 여정 카드 -->
	<div class="grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-12">
		<!-- 메인 일러스트 -->
		<div class="lg:col-span-7">
			<div class="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl shadow-emerald-900/10 ring-1 ring-emerald-200/80">
				<img
					src="/images/intro/slide5-sweet-fruit.jpg"
					alt="함께 땀 흘려 키운 나무에서 달콤한 열매를 수확하는 모습"
					class="aspect-[16/10] w-full object-cover"
				/>
				<div class="absolute top-3 left-3 rounded-full bg-amber-600/90 px-3 py-1 text-xs font-black text-white shadow">
					🌱 6개월의 땀방울
				</div>
				<div class="absolute top-3 right-3 rounded-full bg-emerald-600/90 px-3 py-1 text-xs font-black text-white shadow">
					🍎 달콤한 열매
				</div>
			</div>
		</div>

		<!-- 우측: 3단계 카드 -->
		<div class="flex flex-col gap-3.5 lg:col-span-5">
			{#each stages as item}
				<div class="flex items-center gap-3.5 rounded-3xl border-2 p-4 shadow-sm {item.boxClass}">
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-xs">
						{item.emoji}
					</div>
					<div class="min-w-0">
						<span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black {item.badgeClass}">
							{item.step}
						</span>
						<div class="mt-1 text-base font-black text-slate-900 sm:text-lg">
							{item.title}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- 3. 한 줄 결론 배지 -->
	<div class="inline-flex items-center gap-2.5 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-lg sm:text-lg">
		<span>💡</span>
		<span><span class="text-amber-300">6개월의 수고</span>가 앞으로 <span class="text-emerald-300">10년의 편안함</span>이 됩니다!</span>
	</div>
</section>
