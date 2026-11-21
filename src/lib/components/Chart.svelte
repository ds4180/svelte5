<script>
	/**
	 * @file Chart.svelte
	 * @description Chart.js 라이브러리를 사용한 Svelte 5 기반 차트 컴포넌트
	 */
	import { Chart, registerables } from 'chart.js';

	// Chart.js 구성 요소 등록 및 한글/레이아웃 전역 기본값 설정
	Chart.register(...registerables);
	Chart.defaults.font.family =
		"'Noto Sans KR', 'Pretendard', 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
	Chart.defaults.font.size = 14;
	Chart.defaults.locale = 'ko-KR';
	Chart.defaults.maintainAspectRatio = false;

	/**
	 * @type {{
	 *   type?: import('chart.js').ChartType,
	 *   data?: import('chart.js').ChartData,
	 *   options?: import('chart.js').ChartOptions,
	 *   ariaLabel?: string,
	 *   containerClass?: string
	 * }}
	 */
	let {
		type = 'bar',
		data = { labels: [], datasets: [] },
		options = {},
		ariaLabel = '데이터 차트',
		containerClass = 'relative h-full min-h-[300px] w-full'
	} = $props();

	/** @type {HTMLCanvasElement | undefined} */
	let canvasElement = $state();
	/** @type {Chart | null} */
	let myChart = null;

	// 데이터, 옵션, 또는 차트 종류가 바뀔 때마다 차트 생성/업데이트
	$effect(() => {
		if (!canvasElement) return;

		const nextType = $state.snapshot(type);
		const nextData = $state.snapshot(data);
		const nextOptions = $state.snapshot(options);

		// 차트 종류가 변경되면 기존 축/플러그인 상태가 남지 않도록 인스턴스를 재생성
		if (myChart && myChart.config.type !== nextType) {
			myChart.destroy();
			myChart = null;
		}

		if (myChart) {
			myChart.data = nextData;
			myChart.options = nextOptions;
			myChart.update();
		} else {
			myChart = new Chart(canvasElement, {
				type: nextType,
				data: nextData,
				options: nextOptions
			});
		}
	});

	// 웹폰트 로드 완료 후 캔버스 텍스트를 다시 그려 대체 폰트 고정 현상 방지
	$effect(() => {
		let cancelled = false;
		if (typeof document !== 'undefined' && document.fonts?.ready) {
			document.fonts.ready.then(() => {
				if (!cancelled && myChart) {
					myChart.update('none');
				}
			});
		}
		return () => {
			cancelled = true;
		};
	});

	// 부모 컨테이너 리사이즈 감지 (사이드바 개폐 대응) 및 언마운트 시 차트 정리
	$effect(() => {
		if (!canvasElement) return;
		const parent = canvasElement.parentElement;
		const resizeObserver = new ResizeObserver(() => {
			myChart?.resize();
		});
		if (parent) {
			resizeObserver.observe(parent);
		}
		return () => {
			resizeObserver.disconnect();
			myChart?.destroy();
			myChart = null;
		};
	});
</script>

<div class={containerClass}>
	<canvas bind:this={canvasElement} role="img" aria-label={ariaLabel}></canvas>
</div>
