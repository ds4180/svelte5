<script>
	/**
	 * @file Canvas.svelte
	 * @description [Restored] 2D 캔버스 드로잉 엔진 (Svelte 5)
	 */
	let {
		width = 600,
		height = 400,
		buildingColor = 'lightgray',
		isPathHighlighted = $bindable(false)
	} = $props();

	/** @type {HTMLCanvasElement} */
	let canvasElement;
	/** @type {CanvasRenderingContext2D} */
	let ctx;

	/**
	 * @derived pathStroke
	 * @description 강조 여부에 따라 경로 색상 결정
	 */
	let pathStroke = $derived(isPathHighlighted ? 'red' : 'black');

	/**
	 * @function draw
	 * @description 모든 드로잉을 수행하는 메인 함수
	 */
	function draw() {
		if (!ctx) return;

		// 캔버스 초기화
		ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

		// 배경
		ctx.fillStyle = '#f0f0f0';
		ctx.fillRect(0, 0, canvasElement.width, canvasElement.height);

		// 지하철역 (사각형)
		ctx.fillStyle = 'skyblue';
		ctx.fillRect(20, 20, 80, 40);
		ctx.fillStyle = 'black';
		ctx.font = '14px sans-serif';
		ctx.fillText('지하철역', 38, 45);

		// 집 (원형)
		ctx.beginPath();
		ctx.arc(250, 150, 25, 0, Math.PI * 2);
		ctx.fillStyle = $state.snapshot(buildingColor);
		ctx.fill();
		ctx.fillStyle = 'black';
		ctx.fillText('우리 집', 230, 155);

		// 경로 (점선)
		ctx.beginPath();
		ctx.moveTo(60, 60);
		ctx.lineTo(60, 120);
		ctx.lineTo(220, 120);
		ctx.lineTo(220, 150);
		ctx.strokeStyle = pathStroke;
		ctx.lineWidth = 3;
		ctx.setLineDash([5, 5]);
		ctx.stroke();
		ctx.setLineDash([]); // 점선 해제
	}

	// 상태 변화 감지 및 자동 드로잉 (HiDPI 보정 포함)
	$effect(() => {
		if (canvasElement) {
			const dpr = window.devicePixelRatio || 1;
			ctx = canvasElement.getContext('2d');

			// 🏷️ HiDPI 대응: 물리 픽셀 크기 조절
			canvasElement.width = width * dpr;
			canvasElement.height = height * dpr;

			// CSS 크기 고정
			canvasElement.style.width = `${width}px`;
			canvasElement.style.height = `${height}px`;

			// 드로잉 컨텍스트 스케일링
			ctx.scale(dpr, dpr);

			draw();
		}
	});
</script>

<div class="space-y-4">
	<canvas
		bind:this={canvasElement}
		{width}
		{height}
		class="mx-auto block w-full rounded-xl border border-slate-300 bg-white shadow-lg"
	></canvas>
</div>
