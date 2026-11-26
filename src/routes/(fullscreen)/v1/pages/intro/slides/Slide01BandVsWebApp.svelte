<script lang="ts">
	/**
	 * ============================================================================
	 * [1장 슬라이드: "밴드로는 부족하다!"]
	 * ============================================================================
	 * 그림 중심 + 초간결 키워드로 한눈에 들어오는 프레젠테이션 슬라이드
	 */
	import Icon from '@iconify/svelte';

	const bandPoints = [
		{ emoji: '🌊', text: '중요한 글이 금방 묻혀요' },
		{ emoji: '❓', text: '누가 읽었는지 몰라요' },
		{ emoji: '😵', text: '신청·정리가 뒤죽박죽!' }
	];

	const webappPoints = [
		{ emoji: '🚌', text: '배차·공지가 한눈에 쏙!' },
		{ emoji: '🔔', text: '놓치지 않는 확인 알림!' },
		{ emoji: '⚡', text: '설치 없이 클릭 한 번!' }
	];
</script>

<section class="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 lg:gap-6">
	<!-- 1. 크고 시원한 타이틀 (2~6장과 크기 통일) -->
	<div class="text-center">
		<span class="inline-block rounded-full bg-amber-100 px-4 py-1 text-xs font-black tracking-wider text-amber-800 ring-1 ring-amber-300">
			CHAPTER 01
		</span>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
			"밴드로는 <span class="text-rose-600">부족하다!</span>"
		</h1>
		<p class="mt-2 text-base font-extrabold text-slate-500 sm:text-xl">
			이제는 시대에 맞는 <span class="text-blue-600">우리 회사 웹앱</span>이 필요해요 🚀
		</p>
	</div>

	<!-- 2. 그림 중심 + 좌우 초간결 키워드 -->
	<div class="grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-12">
		<!-- 메인 일러스트 (시선 집중) -->
		<div class="lg:col-span-7">
			<div class="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl shadow-sky-900/10 ring-1 ring-sky-200/80">
				<img
					src="/images/intro/slide1-band-vs-webapp.jpg"
					alt="복잡한 밴드와 깔끔한 웹앱 비교"
					class="aspect-[16/10] w-full object-cover"
				/>
				<div class="absolute top-3 left-3 rounded-full bg-rose-600/90 px-3 py-1 text-xs font-black text-white shadow">
					😰 밴드
				</div>
				<div class="absolute top-3 right-3 rounded-full bg-blue-600/90 px-3 py-1 text-xs font-black text-white shadow">
					✨ 웹앱
				</div>
			</div>
		</div>

		<!-- 우측: 핵심 키워드 3개씩 (다른 장과 높이 통일) -->
		<div class="flex flex-col gap-3 lg:col-span-5">
			<!-- BEFORE: 밴드 -->
			<div class="rounded-3xl border-2 border-rose-200 bg-rose-50/70 p-3.5 shadow-sm">
				<div class="mb-2 flex items-center gap-2">
					<span class="flex h-7 w-7 items-center justify-center rounded-xl bg-rose-600 text-white">
						<Icon icon="mdi:chat-alert" class="text-base" />
					</span>
					<h2 class="text-base font-black text-rose-950">밴드만 쓰면?</h2>
				</div>
				<ul class="space-y-1.5">
					{#each bandPoints as item}
						<li class="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-black text-slate-800 shadow-xs">
							<span class="text-base">{item.emoji}</span>
							<span>{item.text}</span>
						</li>
					{/each}
				</ul>
			</div>

			<!-- AFTER: 웹앱 -->
			<div class="rounded-3xl border-2 border-blue-300 bg-blue-50/80 p-3.5 shadow-sm">
				<div class="mb-2 flex items-center gap-2">
					<span class="flex h-7 w-7 items-center justify-center rounded-xl bg-blue-600 text-white">
						<Icon icon="mdi:rocket-launch" class="text-base" />
					</span>
					<h2 class="text-base font-black text-blue-950">웹앱을 쓰면!</h2>
				</div>
				<ul class="space-y-1.5">
					{#each webappPoints as item}
						<li class="flex items-center gap-2 rounded-xl bg-white px-3 py-1.5 text-sm font-black text-slate-900 shadow-xs">
							<span class="text-base">{item.emoji}</span>
							<span>{item.text}</span>
						</li>
					{/each}
				</ul>
			</div>
		</div>
	</div>

	<!-- 3. 한 줄 결론 배지 -->
	<div class="inline-flex items-center gap-2.5 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-lg sm:text-lg">
		<span>💡</span>
		<span>밴드는 <span class="text-amber-300">놀이터</span>, 웹앱은 우리 회사의 <span class="text-sky-300">똑똑한 지휘실</span>!</span>
	</div>
</section>
