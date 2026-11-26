<script lang="ts">
	/**
	 * ============================================================================
	 * [4장 슬라이드: "대 AI 시대, 앞으로 10년을 위한 혁신!"]
	 * ============================================================================
	 * 그림 중심 + 3가지 핵심 변화 키워드 구성
	 */
	const points = [
		{
			emoji: '📱',
			badge: '지금은',
			title: '스마트폰·인터넷 없인 못 사는 시대!',
			boxClass: 'border-violet-200 bg-violet-50/80',
			badgeClass: 'bg-violet-600 text-white'
		},
		{
			emoji: '🏢',
			badge: '딱 맞게',
			title: '은행 앱까진 아니어도, 우리 회사 맞춤 혁신!',
			boxClass: 'border-sky-200 bg-sky-50/80',
			badgeClass: 'bg-sky-600 text-white'
		},
		{
			emoji: '🌱',
			badge: '큰 변화',
			title: '밴드 첫 도입 때처럼, 일하는 방식이 바뀌어요!',
			boxClass: 'border-emerald-200 bg-emerald-50/80',
			badgeClass: 'bg-emerald-600 text-white'
		}
	];
</script>

<section class="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 lg:gap-6">
	<!-- 1. 크고 시원한 타이틀 -->
	<div class="text-center">
		<span class="inline-block rounded-full bg-violet-100 px-4 py-1 text-xs font-black tracking-wider text-violet-800 ring-1 ring-violet-300">
			CHAPTER 04
		</span>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
			대 AI 시대, <span class="text-violet-600">앞으로 10년</span>을 위한 혁신!
		</h1>
		<p class="mt-2 text-base font-extrabold text-slate-500 sm:text-xl">
			모두가 스마트폰으로 사는 시대, <span class="text-violet-600">변화는 선택이 아닌 필수</span> 🤖
		</p>
	</div>

	<!-- 2. 그림 중심 + 우측 3가지 핵심 포인트 -->
	<div class="grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-12">
		<!-- 메인 일러스트 -->
		<div class="lg:col-span-7">
			<div class="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl shadow-violet-900/10 ring-1 ring-violet-200/80">
				<img
					src="/images/intro/slide4-ai-era-future.jpg"
					alt="AI 도우미와 버스가 함께 밝은 미래로 달려가는 모습"
					class="aspect-[16/10] w-full object-cover"
				/>
				<div class="absolute top-3 left-3 rounded-full bg-violet-600/90 px-3 py-1 text-xs font-black text-white shadow">
					🤖 NEXT 10 YEARS
				</div>
			</div>
		</div>

		<!-- 우측: 핵심 키워드 3장 -->
		<div class="flex flex-col gap-3.5 lg:col-span-5">
			{#each points as item}
				<div class="flex items-center gap-3.5 rounded-3xl border-2 p-4 shadow-sm {item.boxClass}">
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-xs">
						{item.emoji}
					</div>
					<div class="min-w-0">
						<span class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-black {item.badgeClass}">
							{item.badge}
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
		<span>10년 뒤에도 <span class="text-violet-300">앞서가는 우리 회사</span>, 지금 혁신을 시작해요!</span>
	</div>
</section>
