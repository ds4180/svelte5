<script>
	/**
	 * @file (app)/v1/pages/chart/+page.svelte
	 * @description Chart.js 연동 차트 데모 정적 페이지 (PAGES 레이어 / Svelte 5 & DaisyUI)
	 */
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '@iconify/svelte';

	/** @type {'bar'|'line'|'pie'} */
	let selectedType = $state('bar');

	const labels = ['1월', '2월', '3월', '4월', '5월', '6월'];
	let values = $state([1200, 1900, 800, 1500, 950, 1700]);

	const palette = [
		'rgba(59, 130, 246, 0.35)',
		'rgba(59, 130, 246, 0.5)',
		'rgba(59, 130, 246, 0.65)',
		'rgba(59, 130, 246, 0.8)',
		'rgba(37, 99, 235, 0.9)',
		'rgba(30, 64, 175, 1.0)'
	];

	// 선택된 차트 종류에 맞춰 데이터셋 스타일을 파생
	let chartData = $derived({
		labels,
		datasets: [
			{
				label: '총 매출 (만 원)',
				data: values,
				backgroundColor:
					selectedType === 'line' ? 'rgba(59, 130, 246, 0.15)' : palette,
				borderColor: selectedType === 'pie' ? '#ffffff' : 'rgba(37, 99, 235, 1)',
				borderWidth: selectedType === 'line' ? 3 : 1.5,
				borderRadius: selectedType === 'bar' ? 12 : 0,
				tension: 0.35,
				fill: selectedType === 'line',
				pointRadius: selectedType === 'line' ? 5 : 0,
				pointHoverRadius: 7
			}
		]
	});

	// 차트 종류에 따라 축(scales)과 한국식 숫자 포맷 옵션을 파생 (차트 내 폰트 14px)
	let chartOptions = $derived({
		responsive: true,
		maintainAspectRatio: false,
		plugins: {
			legend: {
				display: true,
				position: 'bottom',
				labels: {
					padding: 20,
					font: {
						size: 14,
						weight: 'bold'
					}
				}
			},
			tooltip: {
				titleFont: { size: 14, weight: 'bold' },
				bodyFont: { size: 14 },
				callbacks: {
					label: (ctx) => {
						const raw = selectedType === 'pie' ? ctx.parsed : ctx.parsed.y;
						const formatted = Number(raw ?? 0).toLocaleString('ko-KR');
						return `${ctx.dataset.label}: ${formatted}만 원`;
					}
				}
			}
		},
		scales:
			selectedType === 'pie'
				? undefined
				: {
						y: {
							beginAtZero: true,
							grid: { display: false },
							ticks: {
								font: { size: 14 },
								callback: (value) => `${Number(value).toLocaleString('ko-KR')}만 원`
							}
						},
						x: {
							grid: { display: false },
							ticks: {
								font: { size: 14 }
							}
						}
					}
	});

	/**
	 * @function randomizeData
	 * @description 임의의 매출 데이터로 차트 업데이트 테스트
	 */
	function randomizeData() {
		values = Array.from({ length: 6 }, () => (Math.floor(Math.random() * 20) + 3) * 100);
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-5xl space-y-10 px-4 pb-40 font-['Noto_Sans_KR','Outfit',sans-serif] md:px-8"
>
	<!-- Header -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-xs font-bold tracking-wider text-slate-400">
				시각화 엔진 v4.0 · PAGES
			</span>
			<h1 class="text-4xl font-black tracking-tight text-slate-900 md:text-5xl">
				데이터
				<span class="text-indigo-600">
					시각화
					<Icon
						icon="mdi:chart-bar"
						class="ml-1 inline-block align-text-bottom text-indigo-600"
					/>
				</span>
			</h1>
			<p class="mt-4 text-sm font-medium text-slate-500">
				복잡한 데이터를 직관적인 차트로 변환하여 비즈니스 통찰력을 제공합니다.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<select
				aria-label="차트 종류 선택"
				class="select rounded-2xl border-2 border-slate-900 text-sm font-bold"
				bind:value={selectedType}
			>
				<option value="bar">막대 차트</option>
				<option value="line">꺾은선 차트</option>
				<option value="pie">원형 차트</option>
			</select>
			<button
				class="btn rounded-2xl px-6 text-sm font-bold btn-neutral"
				onclick={randomizeData}
			>
				무작위 데이터
			</button>
		</div>
	</div>

	<!-- Chart Container -->
	<div class="relative rounded-[3rem] border-2 border-slate-900 bg-white p-8 shadow-2xl md:p-12">
		<div class="mb-10 flex items-center justify-between gap-4">
			<div>
				<h3 class="mb-1 text-2xl font-black tracking-tight text-slate-900">
					월별 매출 추이
				</h3>
				<p class="text-xs font-medium text-slate-400">
					최근 6개월간 반복 매출 흐름 분석
				</p>
			</div>
			<div class="text-right">
				<span class="text-xs font-bold text-indigo-600">실시간 렌더링</span>
			</div>
		</div>

		<div class="h-[400px]">
			<Chart
				type={selectedType}
				data={chartData}
				options={chartOptions}
				ariaLabel="월별 매출 추이 차트"
			/>
		</div>

		<div class="mt-10 grid grid-cols-2 gap-8 border-t border-slate-100 pt-8 lg:grid-cols-4">
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-slate-400">신뢰도</span>
				<span class="text-lg leading-none font-black text-slate-900">99.9%</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-slate-400">응답 속도</span>
				<span class="text-lg leading-none font-black text-slate-900">12ms</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-slate-400">차트 엔진</span>
				<span class="text-lg leading-none font-black text-slate-900">Chart.js</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-xs font-bold text-slate-400">렌더링</span>
				<span class="text-lg leading-none font-black text-slate-900">60FPS</span>
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
