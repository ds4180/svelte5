<script lang="ts">
	/**
	 * ============================================================================
	 * [2장 슬라이드: "서버를 구축하고 정보를 한 곳으로 모은다!"]
	 * ============================================================================
	 * 그림 중심 + 4대 핵심 효과 초간결 키워드 구성
	 */
	const benefits = [
		{
			emoji: '🖥️',
			who: '중앙 서버',
			point: '모든 보고를 온라인으로 자동 처리!',
			boxClass: 'border-indigo-200 bg-indigo-50/80',
			badgeClass: 'bg-indigo-600 text-white'
		},
		{
			emoji: '🚌',
			who: '운전원',
			point: '내 배차·공지 정보 접근성 UP!',
			boxClass: 'border-sky-200 bg-sky-50/80',
			badgeClass: 'bg-sky-600 text-white'
		},
		{
			emoji: '☕',
			who: '사무직원',
			point: '단순 업무 쏙↓ 워라밸 쑥↑',
			boxClass: 'border-emerald-200 bg-emerald-50/80',
			badgeClass: 'bg-emerald-600 text-white'
		},
		{
			emoji: '👑',
			who: '상무님',
			point: '한눈에 강력한 경영 그립감 유지!',
			boxClass: 'border-amber-200 bg-amber-50/80',
			badgeClass: 'bg-amber-600 text-white'
		}
	];
</script>

<section class="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 lg:gap-6">
	<!-- 1. 크고 시원한 타이틀 -->
	<div class="text-center">
		<span class="inline-block rounded-full bg-indigo-100 px-4 py-1 text-xs font-black tracking-wider text-indigo-800 ring-1 ring-indigo-300">
			CHAPTER 02
		</span>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
			서버를 구축하고 정보를 <span class="text-indigo-600">한 곳으로!</span>
		</h1>
		<p class="mt-2 text-base font-extrabold text-slate-500 sm:text-xl">
			온라인 보고 체계로 <span class="text-indigo-600">처리부터 조회까지</span> 한 번에 척척 ✨
		</p>
	</div>

	<!-- 2. 그림 중심 + 우측 4대 효과 카드 -->
	<div class="grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-12">
		<!-- 메인 일러스트 -->
		<div class="lg:col-span-7">
			<div class="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl shadow-indigo-900/10 ring-1 ring-indigo-200/80">
				<img
					src="/images/intro/slide2-central-server.jpg"
					alt="중앙 서버로 정보가 모여 모두가 행복해지는 모습"
					class="aspect-[16/10] w-full object-cover"
				/>
				<div class="absolute top-3 left-3 rounded-full bg-indigo-600/90 px-3 py-1 text-xs font-black text-white shadow">
					🧠 우리 회사 중앙 서버
				</div>
			</div>
		</div>

		<!-- 우측: 4가지 핵심 효과 -->
		<div class="flex flex-col gap-3 lg:col-span-5">
			{#each benefits as item}
				<div class="flex items-center gap-3.5 rounded-3xl border-2 p-4 shadow-sm {item.boxClass}">
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-xs">
						{item.emoji}
					</div>
					<div class="min-w-0">
						<span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black {item.badgeClass}">
							{item.who}
						</span>
						<div class="mt-1 text-base font-black text-slate-900 sm:text-lg">
							{item.point}
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<!-- 3. 한 줄 결론 배지 -->
	<div class="inline-flex items-center gap-2.5 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-lg sm:text-lg">
		<span>💡</span>
		<span>정보는 <span class="text-indigo-300">한곳에 쏙</span>, 현장은 <span class="text-emerald-300">편하게</span>, 관리는 <span class="text-amber-300">단단하게</span>!</span>
	</div>
</section>
