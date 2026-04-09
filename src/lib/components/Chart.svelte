<script>
	/**
	 * @file Chart.svelte
	 * @description Chart.js 라이브러리를 사용한 Svelte 5 기반 차트 컴포넌트
	 */
	import { onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	// Chart.js에 모든 구성 요소를 등록
	Chart.register(...registerables);

	/**
	 * @type {{ type: string, data: object, options: object }} props
	 */
	let { type = 'bar', data = {}, options = {} } = $props();

	/** @type {HTMLCanvasElement} */
	let canvasElement;
	/** @type {Chart} */
	let myChart;

	// 데이터나 옵션이 바뀔 때마다 차트 업데이트
	$effect(() => {
		if (!canvasElement) return;

		if (myChart) {
			// 기존 인스턴스 업데이트
			myChart.config.type = $state.snapshot(type);
			myChart.data = $state.snapshot(data);
			myChart.options = $state.snapshot(options);
			myChart.update();
		} else {
			// 최초 인스턴스 생성
			myChart = new Chart(canvasElement, {
				type: $state.snapshot(type),
				data: $state.snapshot(data),
				options: $state.snapshot(options)
			});
		}
	});

	// 🔄 [v2.0 추가] 부모 리사이즈 감지 (사이드바 개폐 대응)
	$effect(() => {
		if (!canvasElement) return;
		const resizeObserver = new ResizeObserver(() => {
			if (myChart) myChart.resize();
		});
		resizeObserver.observe(canvasElement.parentElement);
		return () => resizeObserver.disconnect();
	});

	onDestroy(() => {
		myChart?.destroy();
	});
</script>

<div class="relative h-full min-h-[300px] w-full">
	<canvas bind:this={canvasElement}></canvas>
</div>
