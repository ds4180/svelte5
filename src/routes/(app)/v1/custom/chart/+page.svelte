<script>
	/**
	 * @file (app)/v1/app/chart/+page.svelte
	 * @description Chart.js 연동 차트 데모 페이지 (Svelte 5 & DaisyUI)
	 */
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '@iconify/svelte';

	/** @type {'bar'|'line'|'pie'} */
	let selectedType = $state('bar');

	// 차트 데이터 (반응형)
	let chartData = $state({
		labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
		datasets: [
			{
				label: 'Total Revenue ($)',
				data: [12, 19, 3, 5, 2, 3],
				backgroundColor: [
					'rgba(59, 130, 246, 0.2)',
					'rgba(59, 130, 246, 0.4)',
					'rgba(59, 130, 246, 0.6)',
					'rgba(59, 130, 246, 0.8)',
					'rgba(59, 130, 246, 1.0)',
					'rgba(30, 64, 175, 1.0)'
				],
				borderColor: 'rgba(59, 130, 246, 1)',
				borderWidth: 1,
				borderRadius: 12
			}
		]
	});

	const chartOptions = {
		responsive: true,
		plugins: {
			legend: {
				display: true,
				position: 'bottom',
				labels: {
					font: {
						family: 'Outfit',
						weight: 'bold'
					}
				}
			}
		},
		scales: {
			y: {
				beginAtZero: true,
				grid: {
					display: false
				}
			},
			x: {
				grid: {
					display: false
				}
			}
		}
	};

	/**
	 * @function randomizeData
	 * @description 임의의 데이터로 차트 업데이트 테스트
	 */
	function randomizeData() {
		chartData.datasets[0].data = Array.from({ length: 6 }, () => Math.floor(Math.random() * 20));
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-5xl space-y-12 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- Header -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase"
				>Visualization Engine v4.0</span
			>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				데이터 <span class="NOT-ITALIC text-indigo-600"
					>시각화 <Icon
						icon="mdi:chart-bar"
						class="ml-1 inline-block align-text-bottom text-indigo-600"
					/></span
				>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				복잡한 데이터를 직관적인 차트로 변환하여 비즈니스 통찰력을 제공합니다.
			</p>
		</div>
		<div class="flex items-center gap-2">
			<select
				class="select rounded-2xl border-2 border-slate-900 text-xs font-black uppercase italic"
				bind:value={selectedType}
			>
				<option value="bar">Bar Chart</option>
				<option value="line">Line Chart</option>
				<option value="pie">Pie Chart</option>
			</select>
			<button
				class="btn rounded-2xl px-6 text-xs font-black uppercase btn-neutral"
				onclick={randomizeData}
			>
				Randomize
			</button>
		</div>
	</div>

	<!-- Chart Container -->
	<div class="relative rounded-[3rem] border-2 border-slate-900 bg-white p-10 shadow-2xl md:p-14">
		<div class="mb-14 flex items-center justify-between">
			<div>
				<h3 class="mb-1 text-2xl font-black tracking-tighter text-slate-900 uppercase italic">
					Fiscal Performance Snapshot
				</h3>
				<p class="text-[10px] font-bold text-slate-400 uppercase">
					Analysis of recurring revenue flows
				</p>
			</div>
			<div class="text-right">
				<span class="text-xs font-black text-indigo-600 uppercase italic"
					>Live Rendering Engine</span
				>
			</div>
		</div>

		<div class="h-[400px]">
			<Chart type={selectedType} data={chartData} options={chartOptions} />
		</div>

		<div class="mt-14 grid grid-cols-2 gap-8 border-t border-slate-100 pt-10 lg:grid-cols-4">
			<div class="flex flex-col">
				<span class="mb-1 text-[10px] font-black tracking-widest text-slate-300 uppercase"
					>Reliability</span
				>
				<span class="text-lg leading-none font-black text-slate-900">99.9%</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-[10px] font-black tracking-widest text-slate-300 uppercase"
					>Latency</span
				>
				<span class="text-lg leading-none font-black text-slate-900">12ms</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-[10px] font-black tracking-widest text-slate-300 uppercase"
					>Engine</span
				>
				<span class="text-lg leading-none font-black text-slate-900 uppercase italic">ChartJS</span>
			</div>
			<div class="flex flex-col">
				<span class="mb-1 text-[10px] font-black tracking-widest text-slate-300 uppercase"
					>Renders</span
				>
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
