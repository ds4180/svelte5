<script>
	/**
	 * @file (app)/v1/pages/print-demo/+page.svelte
	 * @description 물리적 백업(종이 인쇄 / PDF 저장) 통합 데모 페이지
	 */
	import { onMount } from 'svelte';
	import Chart from '$lib/components/Chart.svelte';
	import PrintAssist from '$lib/components/PrintAssist.svelte';
	import Icon from '@iconify/svelte';

	// --- 인쇄 옵션 상태 ---
	let docTitle = $state('일일 노선 운행 및 배차 백업 대장');
	let docSubtitle = $state('제주 라이브 운수 통합 관제 시스템 · 물리적 백업 문서');
	let docDate = $state('2026-11-17');
	let issuerName = $state('관리자 (배차팀)');

	/** @type {'portrait' | 'landscape'} */
	let orientation = $state('portrait');
	/** @type {'8mm' | '12mm' | '20mm'} */
	let pageMargin = $state('12mm');
	/** @type {'color' | 'mono'} */
	let colorMode = $state('color');
	/** @type {'11px' | '13px' | '15px'} */
	let tableFontSize = $state('13px');
	let rowCount = $state(25);
	let chartType = $state(/** @type {'bar' | 'line'} */ ('bar'));
	let previewMode = $state(false);

	// 포함 섹션 토글
	let showApprovalBox = $state(true);
	let showKpiCards = $state(true);
	let showChart = $state(true);
	let showTable = $state(true);
	let showFooterSign = $state(true);
	let noteText = $state('특이사항 없음. 정상 운행 완료 및 일일 물리적 백업 보관.');

	let printedAt = $state('');

	onMount(() => {
		const d = new Date();
		printedAt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	});

	// --- 목 데이터 생성 ---
	const routeNames = ['202번 (일주서)', '121번 (급행)', '291번 (한림)', '311번 (시내)', '500번 (공항)'];
	const drivers = ['김철수', '이영희', '박민수', '최지훈', '정수진', '한동훈', '강미영', '오세훈'];
	const garages = ['제주차고지', '고산차고지', '신서귀포', '한림체육관'];
	const statuses = ['운행완료', '운행중', '대기', '예비'];

	let mockRows = $derived(
		Array.from({ length: rowCount }, (_, i) => {
			const hour = 5 + Math.floor(i / 3);
			const min = (i % 3) * 20;
			const startTime = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
			const endTime = `${String(hour + 1).padStart(2, '0')}:${String((min + 35) % 60).padStart(2, '0')}`;
			return {
				seq: i + 1,
				route: routeNames[i % routeNames.length],
				vehicle: `${3110 + i}호`,
				driver: drivers[i % drivers.length],
				garage: garages[i % garages.length],
				startTime,
				endTime,
				passengers: 24 + ((i * 7) % 45),
				status: statuses[i % statuses.length]
			};
		})
	);

	let kpiSummary = $derived({
		totalTrips: mockRows.length,
		completed: mockRows.filter((r) => r.status === '운행완료').length,
		totalPassengers: mockRows.reduce((acc, r) => acc + r.passengers, 0),
		activeVehicles: new Set(mockRows.map((r) => r.vehicle)).size
	});

	let chartData = $derived({
		labels: routeNames.map((r) => r.split(' ')[0]),
		datasets: [
			{
				label: '노선별 총 탑승 인원 (명)',
				data: routeNames.map((r) =>
					mockRows.filter((row) => row.route === r).reduce((s, x) => s + x.passengers, 0)
				),
				backgroundColor:
					chartType === 'line'
						? 'rgba(37, 99, 235, 0.15)'
						: ['rgba(37,99,235,0.75)', 'rgba(16,185,129,0.75)', 'rgba(245,158,11,0.75)', 'rgba(99,102,241,0.75)', 'rgba(239,68,68,0.75)'],
				borderColor: 'rgba(37, 99, 235, 1)',
				borderWidth: 2,
				borderRadius: chartType === 'bar' ? 8 : 0,
				tension: 0.3,
				fill: chartType === 'line'
			}
		]
	});

	/** @type {import('chart.js').ChartOptions} */
	const chartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		animation: false, // 인쇄 직전 렌더링 깨짐 방지
		plugins: {
			legend: { position: 'bottom', labels: { font: { size: 13, weight: 'bold' } } }
		},
		scales: {
			y: { beginAtZero: true },
			x: { grid: { display: false } }
		}
	};

	function handlePrint() {
		window.print();
	}
</script>

<svelte:head>
	{@html `<style>
		@media print {
			@page {
				size: A4 ${orientation};
				margin: ${pageMargin};
			}
		}
	</style>`}
</svelte:head>

<div class="mx-auto max-w-6xl space-y-6 pb-20 font-['Noto_Sans_KR','Outfit',sans-serif] md:pb-8 print:max-w-none print:space-y-4 print:pb-0">
	<!-- 🎛️ 화면 전용 인쇄 옵션 컨트롤러 (인쇄 시 숨김) -->
	<section class="rounded-3xl border-2 border-slate-900 bg-white p-5 shadow-md md:p-6 print:hidden">
		<div class="flex flex-col justify-between gap-4 border-b border-slate-200 pb-4 md:flex-row md:items-center">
			<div>
				<span class="text-xs font-black tracking-wider text-blue-600 uppercase">Print & PDF Backup Demo</span>
				<h1 class="mt-0.5 text-2xl font-black text-slate-900">물리적 백업 프린팅 데모</h1>
				<p class="mt-1 text-xs font-medium text-slate-500">
					용지 방향, 여백, 흑백 모드, 포함 섹션을 조합해 종이 인쇄 또는 PDF로 저장할 수 있습니다.
				</p>
			</div>
			<div class="flex flex-wrap items-center gap-2">
				<PrintAssist title={docTitle} subtitle={docSubtitle} issuer={issuerName} buttonLabel="프린트 어시스트" />
				<button
					type="button"
					onclick={() => (previewMode = !previewMode)}
					class="btn rounded-xl btn-sm md:btn-md {previewMode ? 'btn-neutral' : 'btn-outline'}"
				>
					<Icon icon="solar:eye-bold" class="text-base" />
					{previewMode ? '편집 화면으로' : 'A4 미리보기'}
				</button>
				<button
					type="button"
					onclick={handlePrint}
					class="btn rounded-xl border-none bg-blue-600 text-white btn-sm hover:bg-blue-700 md:btn-md"
				>
					<Icon icon="solar:printer-bold-duotone" class="text-lg" />
					인쇄 / PDF 저장
				</button>
			</div>
		</div>

		<!-- 옵션 그리드 -->
		<div class="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<label for="doc-title" class="mb-1 block text-xs font-black text-slate-700">문서 제목</label>
				<input id="doc-title" type="text" bind:value={docTitle} class="input input-sm input-bordered w-full font-bold" />
			</div>
			<div>
				<label for="doc-date" class="mb-1 block text-xs font-black text-slate-700">기준 날짜</label>
				<input id="doc-date" type="date" bind:value={docDate} class="input input-sm input-bordered w-full font-bold" />
			</div>
			<div>
				<label for="doc-issuer" class="mb-1 block text-xs font-black text-slate-700">출력자</label>
				<input id="doc-issuer" type="text" bind:value={issuerName} class="input input-sm input-bordered w-full font-bold" />
			</div>
			<div>
				<label for="row-count" class="mb-1 block text-xs font-black text-slate-700">목 데이터 행 수</label>
				<select id="row-count" bind:value={rowCount} class="select select-sm select-bordered w-full font-bold">
					<option value={10}>10행 (1페이지 분량)</option>
					<option value={25}>25행 (다중 페이지 테스트)</option>
					<option value={40}>40행 (대용량 분할 테스트)</option>
				</select>
			</div>

			<div>
				<span class="mb-1 block text-xs font-black text-slate-700">용지 방향</span>
				<div class="join w-full">
					<button type="button" onclick={() => (orientation = 'portrait')} class="btn join-item btn-xs flex-1 {orientation === 'portrait' ? 'btn-neutral' : 'btn-outline'}">세로 (A4)</button>
					<button type="button" onclick={() => (orientation = 'landscape')} class="btn join-item btn-xs flex-1 {orientation === 'landscape' ? 'btn-neutral' : 'btn-outline'}">가로 (A4)</button>
				</div>
			</div>
			<div>
				<span class="mb-1 block text-xs font-black text-slate-700">용지 여백</span>
				<div class="join w-full">
					{#each ['8mm', '12mm', '20mm'] as m}
						<button type="button" onclick={() => (pageMargin = /** @type {any} */ (m))} class="btn join-item btn-xs flex-1 {pageMargin === m ? 'btn-neutral' : 'btn-outline'}">{m}</button>
					{/each}
				</div>
			</div>
			<div>
				<span class="mb-1 block text-xs font-black text-slate-700">색상 / 잉크 모드</span>
				<div class="join w-full">
					<button type="button" onclick={() => (colorMode = 'color')} class="btn join-item btn-xs flex-1 {colorMode === 'color' ? 'btn-neutral' : 'btn-outline'}">컬러 유지</button>
					<button type="button" onclick={() => (colorMode = 'mono')} class="btn join-item btn-xs flex-1 {colorMode === 'mono' ? 'btn-neutral' : 'btn-outline'}">흑백 절약</button>
				</div>
			</div>
			<div>
				<span class="mb-1 block text-xs font-black text-slate-700">표 글자 · 차트</span>
				<div class="flex gap-1.5">
					<select aria-label="표 글자 크기" bind:value={tableFontSize} class="select select-xs select-bordered flex-1 font-bold">
						<option value="11px">11px</option>
						<option value="13px">13px</option>
						<option value="15px">15px</option>
					</select>
					<select aria-label="차트 종류" bind:value={chartType} class="select select-xs select-bordered flex-1 font-bold">
						<option value="bar">막대</option>
						<option value="line">꺾은선</option>
					</select>
				</div>
			</div>
		</div>

		<!-- 포함 섹션 토글 -->
		<div class="mt-4 flex flex-wrap items-center gap-4 border-t border-slate-100 pt-4 text-xs font-bold text-slate-700">
			<span class="text-slate-400">포함 섹션:</span>
			<label class="flex cursor-pointer items-center gap-1.5">
				<input type="checkbox" bind:checked={showApprovalBox} class="checkbox checkbox-xs checkbox-primary" />
				결재란
			</label>
			<label class="flex cursor-pointer items-center gap-1.5">
				<input type="checkbox" bind:checked={showKpiCards} class="checkbox checkbox-xs checkbox-primary" />
				요약 KPI
			</label>
			<label class="flex cursor-pointer items-center gap-1.5">
				<input type="checkbox" bind:checked={showChart} class="checkbox checkbox-xs checkbox-primary" />
				통계 차트
			</label>
			<label class="flex cursor-pointer items-center gap-1.5">
				<input type="checkbox" bind:checked={showTable} class="checkbox checkbox-xs checkbox-primary" />
				상세 데이터 표
			</label>
			<label class="flex cursor-pointer items-center gap-1.5">
				<input type="checkbox" bind:checked={showFooterSign} class="checkbox checkbox-xs checkbox-primary" />
				하단 비고 · 서명란
			</label>
		</div>
	</section>

	<!-- 📄 실제 출력 문서 본문 (미리보기 시 A4 용지 프레임 적용, 인쇄 시 전체 페이지로 출력) -->
	<article
		class="print-sheet rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all md:p-8 print:rounded-none print:border-none print:p-0 print:shadow-none
		{previewMode ? (orientation === 'landscape' ? 'mx-auto max-w-[1120px] border-2 border-slate-400 shadow-2xl' : 'mx-auto max-w-[794px] border-2 border-slate-400 shadow-2xl') : ''}
		{colorMode === 'mono' ? 'grayscale' : ''}"
	>
		<!-- 1. 문서 머리말 & 결재란 -->
		<header class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-4 sm:flex-row sm:items-start">
			<div>
				<p class="text-[11px] font-bold text-slate-500">{docSubtitle}</p>
				<h2 class="mt-1 text-2xl font-black text-slate-900">{docTitle}</h2>
				<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
					<span>기준일: <strong class="font-mono text-slate-900">{docDate}</strong></span>
					<span>출력자: <strong class="text-slate-900">{issuerName}</strong></span>
					<span>출력시각: <strong class="font-mono text-slate-900">{printedAt || '-'}</strong></span>
				</div>
			</div>

			{#if showApprovalBox}
				<table class="w-auto shrink-0 border-collapse border border-slate-900 text-center text-[11px]">
					<thead>
						<tr class="bg-slate-100">
							<th rowspan="2" class="w-6 border border-slate-900 px-1 py-1 font-black">결<br />재</th>
							<th class="w-16 border border-slate-900 px-2 py-1 font-bold">담당</th>
							<th class="w-16 border border-slate-900 px-2 py-1 font-bold">팀장</th>
							<th class="w-16 border border-slate-900 px-2 py-1 font-bold">대표</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td class="h-12 border border-slate-900"></td>
							<td class="h-12 border border-slate-900"></td>
							<td class="h-12 border border-slate-900"></td>
						</tr>
					</tbody>
				</table>
			{/if}
		</header>

		<!-- 2. 요약 KPI 카드 -->
		{#if showKpiCards}
			<section data-print-section="요약 KPI 지표" class="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 print:break-inside-avoid">
				<div class="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
					<span class="block text-[11px] font-bold text-slate-500">총 배차 회차</span>
					<span class="mt-1 block font-mono text-xl font-black text-slate-900">{kpiSummary.totalTrips}건</span>
				</div>
				<div class="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
					<span class="block text-[11px] font-bold text-slate-500">운행 완료</span>
					<span class="mt-1 block font-mono text-xl font-black text-emerald-700">{kpiSummary.completed}건</span>
				</div>
				<div class="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
					<span class="block text-[11px] font-bold text-slate-500">투입 차량</span>
					<span class="mt-1 block font-mono text-xl font-black text-blue-700">{kpiSummary.activeVehicles}대</span>
				</div>
				<div class="rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
					<span class="block text-[11px] font-bold text-slate-500">총 탑승 인원</span>
					<span class="mt-1 block font-mono text-xl font-black text-slate-900">{kpiSummary.totalPassengers.toLocaleString('ko-KR')}명</span>
				</div>
			</section>
		{/if}

		<!-- 3. 통계 차트 (Chart.js) -->
		{#if showChart}
			<section data-print-section="노선별 탑승 현황 차트" class="mt-5 rounded-2xl border border-slate-300 p-4 print:break-inside-avoid">
				<h3 class="mb-3 text-sm font-black text-slate-800">노선별 탑승 현황 요약</h3>
				<div class="h-[240px]">
					<Chart type={chartType} data={chartData} options={chartOptions} ariaLabel="노선별 탑승 현황 차트" />
				</div>
			</section>
		{/if}

		<!-- 4. 상세 데이터 표 -->
		{#if showTable}
			<section data-print-section="상세 운행 내역 표" class="mt-5">
				<h3 class="mb-2 text-sm font-black text-slate-800">상세 운행 내역 ({mockRows.length}건)</h3>
				<div class="overflow-x-auto print:overflow-visible">
					<table
						class="w-full border-collapse border border-slate-400 text-left"
						style="font-size: {tableFontSize};"
					>
						<thead class="bg-slate-100 text-slate-900">
							<tr>
								<th class="border border-slate-400 px-2.5 py-2 text-center font-black">순번</th>
								<th class="border border-slate-400 px-2.5 py-2 font-black">노선</th>
								<th class="border border-slate-400 px-2.5 py-2 font-black">차량번호</th>
								<th class="border border-slate-400 px-2.5 py-2 font-black">기사명</th>
								<th class="border border-slate-400 px-2.5 py-2 font-black">차고지</th>
								<th class="border border-slate-400 px-2.5 py-2 text-center font-black">출발~도착</th>
								<th class="border border-slate-400 px-2.5 py-2 text-right font-black">탑승(명)</th>
								<th class="border border-slate-400 px-2.5 py-2 text-center font-black">상태</th>
							</tr>
						</thead>
						<tbody>
							{#each mockRows as row (row.seq)}
								<tr class="even:bg-slate-50/70">
									<td class="border border-slate-300 px-2.5 py-1.5 text-center font-mono">{row.seq}</td>
									<td class="border border-slate-300 px-2.5 py-1.5 font-bold">{row.route}</td>
									<td class="border border-slate-300 px-2.5 py-1.5 font-mono">{row.vehicle}</td>
									<td class="border border-slate-300 px-2.5 py-1.5">{row.driver}</td>
									<td class="border border-slate-300 px-2.5 py-1.5">{row.garage}</td>
									<td class="border border-slate-300 px-2.5 py-1.5 text-center font-mono">{row.startTime} ~ {row.endTime}</td>
									<td class="border border-slate-300 px-2.5 py-1.5 text-right font-mono">{row.passengers}</td>
									<td class="border border-slate-300 px-2.5 py-1.5 text-center font-bold">{row.status}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}

		<!-- 5. 하단 비고 · 서명란 -->
		{#if showFooterSign}
			<footer data-print-section="특이사항 및 확인 서명란" class="mt-6 rounded-xl border border-slate-400 p-4 print:break-inside-avoid">
				<div class="text-xs font-black text-slate-700">특이사항 및 확인</div>
				<p class="mt-1 text-xs text-slate-600">{noteText}</p>
				<div class="mt-4 flex justify-end gap-8 border-t border-slate-200 pt-3 text-xs font-bold text-slate-700">
					<span>작성자: {issuerName} (인)</span>
					<span>확인자: _______________ (인)</span>
				</div>
			</footer>
		{/if}
	</article>
</div>

<style>
	@media print {
		:global(body) {
			background: #ffffff !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		.print-sheet thead {
			display: table-header-group;
		}
		.print-sheet tr {
			break-inside: avoid;
			page-break-inside: avoid;
		}
	}
</style>
