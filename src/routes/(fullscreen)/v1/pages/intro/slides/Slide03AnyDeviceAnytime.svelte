<script lang="ts">
	/**
	 * ============================================================================
	 * [3장 슬라이드: "데탑 · 태블릿 · 스마트폰, 언제 어디서나!"]
	 * ============================================================================
	 * 그림 중심 + 3대 기기별 맞춤 접근성 & 24시간 365일 실시간 통계 키워드 구성
	 */
	const devices = [
		{
			emoji: '🖥️',
			place: '사무실',
			device: '데스크톱',
			point: '넓은 화면으로 전체 관제!',
			boxClass: 'border-blue-200 bg-blue-50/80',
			badgeClass: 'bg-blue-600 text-white'
		},
		{
			emoji: '📱',
			place: '현장',
			device: '태블릿',
			point: '움직이며 즉시 확인·체크!',
			boxClass: 'border-teal-200 bg-teal-50/80',
			badgeClass: 'bg-teal-600 text-white'
		},
		{
			emoji: '📲',
			place: '운전원',
			device: '스마트폰',
			point: '주머니 속 내 배차·알림!',
			boxClass: 'border-orange-200 bg-orange-50/80',
			badgeClass: 'bg-orange-500 text-white'
		}
	];
</script>

<section class="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 lg:gap-6">
	<!-- 1. 크고 시원한 타이틀 -->
	<div class="text-center">
		<span class="inline-block rounded-full bg-teal-100 px-4 py-1 text-xs font-black tracking-wider text-teal-800 ring-1 ring-teal-300">
			CHAPTER 03
		</span>
		<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 sm:text-5xl">
			데탑 · 태블릿 · 스마트폰, <span class="text-teal-600">어디서나 척척!</span>
		</h1>
		<p class="mt-2 text-base font-extrabold text-slate-500 sm:text-xl">
			상황과 직책에 딱 맞게 <span class="text-teal-600">24시간 365일</span> 실시간 연결 🌐
		</p>
	</div>

	<!-- 2. 그림 중심 + 우측 기기별 카드 & 실시간 배지 -->
	<div class="grid w-full grid-cols-1 items-center gap-5 lg:grid-cols-12">
		<!-- 메인 일러스트 -->
		<div class="lg:col-span-7">
			<div class="relative overflow-hidden rounded-3xl border-4 border-white bg-white shadow-2xl shadow-teal-900/10 ring-1 ring-teal-200/80">
				<img
					src="/images/intro/slide3-multi-device.jpg"
					alt="사무실 데스크톱, 현장 태블릿, 운전원 스마트폰이 하나로 연결된 모습"
					class="aspect-[16/10] w-full object-cover"
				/>
				<div class="absolute top-3 right-3 rounded-full bg-teal-600/90 px-3 py-1 text-xs font-black text-white shadow">
					🕒 24시간 365일 LIVE
				</div>
			</div>
		</div>

		<!-- 우측: 3대 기기 + 실시간 통계 배지 -->
		<div class="flex flex-col gap-3 lg:col-span-5">
			{#each devices as item}
				<div class="flex items-center gap-3.5 rounded-3xl border-2 p-4 shadow-sm {item.boxClass}">
					<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-2xl shadow-xs">
						{item.emoji}
					</div>
					<div class="min-w-0">
						<div class="flex items-center gap-1.5">
							<span class="rounded-full px-2.5 py-0.5 text-[11px] font-black {item.badgeClass}">
								{item.place}
							</span>
							<span class="text-xs font-black text-slate-500">{item.device}</span>
						</div>
						<div class="mt-1 text-base font-black text-slate-900 sm:text-lg">
							{item.point}
						</div>
					</div>
				</div>
			{/each}

			<!-- 실시간 조회 & 365일 강조 박스 -->
			<div class="grid grid-cols-2 gap-2.5">
				<div class="flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-3 py-3 text-xs font-black text-white shadow sm:text-sm">
					<span>📊</span>
					<span>실시간 조회·통계</span>
				</div>
				<div class="flex items-center justify-center gap-2 rounded-2xl bg-teal-600 px-3 py-3 text-xs font-black text-white shadow sm:text-sm">
					<span>🌍</span>
					<span>365일 어디서나!</span>
				</div>
			</div>
		</div>
	</div>

	<!-- 3. 한 줄 결론 배지 -->
	<div class="inline-flex items-center gap-2.5 rounded-full bg-slate-900 px-6 py-2.5 text-sm font-black text-white shadow-lg sm:text-lg">
		<span>💡</span>
		<span>기기 걱정은 <span class="text-rose-300">NO</span>, 직책별 맞춤 업무는 <span class="text-teal-300">24시간 YES</span>!</span>
	</div>
</section>
