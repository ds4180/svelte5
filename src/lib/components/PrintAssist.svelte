<script>
	/**
	 * @file PrintAssist.svelte
	 * @description 어떤 상세/리스트 페이지에서도 본문 섹션을 자동 인식해 선택 인쇄할 수 있는 범용 프린트 어시스트 컴포넌트
	 */
	import { onDestroy } from 'svelte';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import Icon from '@iconify/svelte';

	/** @type {any} */
	let auth = null;
	try {
		auth = getAuthContext();
	} catch {
		auth = null;
	}

	let {
		title = '업무 보고서',
		subtitle = '제주 라이브 통합 관제 시스템',
		issuer = '',
		targetSelector = 'main',
		buttonLabel = '인쇄 / PDF'
	} = $props();

	let open = $state(false);
	let docTitle = $state('');
	let docDate = $state('');
	let docIssuer = $state('');

	let orientation = $state(/** @type {'portrait' | 'landscape'} */ ('portrait'));
	let paperSize = $state(/** @type {'auto' | 'A4' | 'A3' | 'A5' | 'B4' | 'B5'} */ ('A4'));
	let pageMargin = $state(/** @type {'8mm' | '12mm' | '20mm'} */ ('12mm'));
	let colorMode = $state(/** @type {'color' | 'mono'} */ ('color'));
	let showHeader = $state(true);
	let showApproval = $state(true);
	let showWatermark = $state(true);
	let watermarkText = $state('');

	/** @type {Array<{ id: string, el: HTMLElement, label: string, preview: string, checked: boolean }>} */
	let sections = $state([]);
	let printHeaderEl = $state(/** @type {HTMLElement | null} */ (null));
	let printWatermarkEl = $state(/** @type {HTMLElement | null} */ (null));
	let printedAt = $state('');

	function resolveDefaultIssuer() {
		if (issuer && issuer.trim()) return issuer.trim();
		const u = auth?.user;
		if (u) {
			const name = u.real_name || u.username || '사용자';
			return u.primary_group ? `${name} (${u.primary_group})` : name;
		}
		return '관리자';
	}

	function todayIso() {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function nowStr() {
		const d = new Date();
		return `${todayIso()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	/** 요소에서 사람이 읽기 좋은 섹션 제목 추출 */
	/** @param {HTMLElement} el @param {number} idx */
	function extractLabel(el, idx) {
		const explicit = el.getAttribute('data-print-section');
		if (explicit) return explicit;
		const heading = el.querySelector('h1, h2, h3, h4, caption');
		const hText = heading?.textContent?.trim();
		if (hText) return hText.slice(0, 40);
		if (el.tagName === 'TABLE') return `데이터 표 #${idx + 1}`;
		return `본문 섹션 #${idx + 1}`;
	}

	/** 본문 영역을 스캔해 인쇄 가능 블록 목록 생성 */
	function scanSections() {
		if (typeof document === 'undefined') return;
		const root = document.querySelector(targetSelector) || document.body;
		if (!root) return;

		// 1순위: data-print-section 속성이 명시된 블록
		let candidates = Array.from(root.querySelectorAll('[data-print-section]')).filter(
			(el) => el instanceof HTMLElement && !el.closest('[data-print-assist]')
		);

		// 2순위: 명시가 없으면 일반 상세/리스트 페이지의 주요 section, table, article 자동 탐색
		if (candidates.length === 0) {
			const raw = Array.from(root.querySelectorAll('section, article, table')).filter((el) => {
				if (!(el instanceof HTMLElement)) return false;
				if (el.closest('[data-print-assist]') || el.classList.contains('print:hidden')) return false;
				const rect = el.getBoundingClientRect();
				return rect.height >= 40;
			});
			// 다른 후보의 자식인 중첩 요소는 제외
			candidates = raw.filter((el) => !raw.some((other) => other !== el && other.contains(el)));
		}

		sections = candidates.map((el, idx) => {
			const htmlEl = /** @type {HTMLElement} */ (el);
			const text = (htmlEl.innerText || '').replace(/\s+/g, ' ').trim();
			return {
				id: `sec-${idx}`,
				el: htmlEl,
				label: extractLabel(htmlEl, idx),
				preview: text.slice(0, 60) + (text.length > 60 ? '...' : ''),
				checked: true
			};
		});
	}

	function openModal() {
		docTitle = title;
		docDate = todayIso();
		docIssuer = resolveDefaultIssuer();
		printedAt = nowStr();
		watermarkText = `대외비 · ${docIssuer} · ${printedAt}`;
		scanSections();
		open = true;
	}

	/** @param {boolean} val */
	function toggleAll(val) {
		sections = sections.map((s) => ({ ...s, checked: val }));
	}

	let cleanupPrintState = () => {};

	function executePrint() {
		if (typeof document === 'undefined') return;
		const root = /** @type {HTMLElement | null} */ (document.querySelector(targetSelector));
		printedAt = nowStr();

		// 1. 선택 해제된 섹션 숨김 마킹
		const skipped = sections.filter((s) => !s.checked).map((s) => s.el);
		for (const el of skipped) {
			el.setAttribute('data-print-skip', 'true');
		}

		// 2. 흑백 모드 마킹
		if (root && colorMode === 'mono') {
			root.setAttribute('data-print-mono', 'true');
		}

		// 3. 인쇄 전용 머리말 & 워터마크 활성화
		let originalParent = null;
		let originalNext = null;
		if (showHeader && printHeaderEl && root) {
			const container = root.firstElementChild instanceof HTMLElement ? root.firstElementChild : root;
			originalParent = printHeaderEl.parentElement;
			originalNext = printHeaderEl.nextSibling;
			container.prepend(printHeaderEl);
			printHeaderEl.setAttribute('data-print-header-active', 'true');
		}
		if (showWatermark && printWatermarkEl) {
			printWatermarkEl.setAttribute('data-print-watermark-active', 'true');
		}

		const restore = () => {
			for (const el of skipped) {
				el.removeAttribute('data-print-skip');
			}
			if (root) {
				root.removeAttribute('data-print-mono');
			}
			if (printHeaderEl && originalParent) {
				printHeaderEl.removeAttribute('data-print-header-active');
				originalParent.insertBefore(printHeaderEl, originalNext);
			}
			if (printWatermarkEl) {
				printWatermarkEl.removeAttribute('data-print-watermark-active');
			}
			window.removeEventListener('afterprint', restore);
		};

		cleanupPrintState = restore;
		window.addEventListener('afterprint', restore);

		open = false;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.print();
			});
		});
	}

	onDestroy(() => {
		cleanupPrintState();
	});

	let selectedCount = $derived(sections.filter((s) => s.checked).length);
</script>

<svelte:head>
	{@html `<style>
		@media print {
			@page {
				size: ${paperSize === 'auto' ? orientation : `${paperSize} ${orientation}`};
				margin: ${pageMargin};
			}
		}
	</style>`}
</svelte:head>

<div class="inline-block print:hidden" data-print-assist="true">
	<button
		type="button"
		onclick={openModal}
		class="btn gap-2 rounded-xl border-2 border-slate-900 bg-white px-4 text-xs font-black text-slate-900 shadow-xs transition hover:bg-slate-900 hover:text-white btn-sm md:btn-md"
	>
		<Icon icon="solar:printer-bold-duotone" class="text-base text-blue-600" />
		<span>{buttonLabel}</span>
	</button>
</div>

<!-- 인쇄 시에만 본문 최상단으로 이동해 출력되는 공용 머리말 -->
<div bind:this={printHeaderEl} class="hidden" data-print-assist-header="true">
	<div class="mb-5 flex items-start justify-between gap-4 border-b-2 border-slate-900 pb-4">
		<div>
			<p class="text-[11px] font-bold text-slate-500">{subtitle}</p>
			<h2 class="mt-1 text-2xl font-black text-slate-900">{docTitle || title}</h2>
			<div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-600">
				<span>기준일: <strong class="font-mono text-slate-900">{docDate}</strong></span>
				<span>출력자: <strong class="text-slate-900">{docIssuer}</strong></span>
				<span>출력시각: <strong class="font-mono text-slate-900">{printedAt}</strong></span>
			</div>
		</div>

		{#if showApproval}
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
	</div>
</div>

<!-- 인쇄 시에만 전 페이지에 반복 출력되는 워터마크 오버레이 -->
<div bind:this={printWatermarkEl} class="hidden" data-print-watermark="true" aria-hidden="true">
	<div class="grid h-full w-full grid-cols-2 grid-rows-3 place-items-center gap-12">
		{#each Array.from({ length: 6 }) as _, idx (idx)}
			<span class="-rotate-[28deg] text-xl font-black tracking-widest text-slate-900/10 select-none">
				{watermarkText || `대외비 · ${docIssuer} · ${printedAt}`}
			</span>
		{/each}
	</div>
</div>

<!-- 인쇄 어시스트 설정 모달 -->
{#if open}
	<div
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs print:hidden"
		role="dialog"
		aria-modal="true"
		aria-labelledby="print-assist-title"
		tabindex="-1"
		data-print-assist="true"
		onclick={(e) => {
			if (e.target === e.currentTarget) open = false;
		}}
		onkeydown={(e) => {
			if (e.key === 'Escape') open = false;
		}}
	>
		<div class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-slate-900 bg-white shadow-2xl">
			<!-- 모달 헤더 -->
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-6 py-4 text-white">
				<div class="flex items-center gap-2.5">
					<Icon icon="solar:printer-bold-duotone" class="text-2xl text-emerald-400" />
					<div>
						<h3 id="print-assist-title" class="text-base font-black">프린트 어시스트</h3>
						<p class="text-[11px] text-slate-300">본문 영역을 확인하고 출력할 항목과 용지 옵션을 선택하세요.</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-rose-500 hover:text-white"
					aria-label="닫기"
				>
					<Icon icon="solar:close-circle-bold" class="text-xl" />
				</button>
			</div>

			<!-- 본문 -->
			<div class="flex-1 space-y-5 overflow-y-auto p-6">
				<!-- 1. 본문 감지 섹션 선택 -->
				<div class="space-y-2.5">
					<div class="flex items-center justify-between">
						<span class="text-xs font-black text-slate-800">
							1. 본문 출력 항목 선택 ({selectedCount}/{sections.length}개 선택)
						</span>
						<div class="flex gap-2 text-[11px] font-bold">
							<button type="button" onclick={() => toggleAll(true)} class="text-blue-600 hover:underline">전체 선택</button>
							<span class="text-slate-300">|</span>
							<button type="button" onclick={() => toggleAll(false)} class="text-slate-500 hover:underline">전체 해제</button>
						</div>
					</div>

					{#if sections.length === 0}
						<div class="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-xs font-bold text-slate-400">
							감지된 세부 섹션이 없어 본문 전체가 그대로 인쇄됩니다.
						</div>
					{:else}
						<div class="max-h-52 space-y-2 overflow-y-auto pr-1">
							{#each sections as sec (sec.id)}
								<label
									class="flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition {sec.checked
										? 'border-blue-300 bg-blue-50/40'
										: 'border-slate-200 bg-slate-50 opacity-60'}"
								>
									<input
										type="checkbox"
										bind:checked={sec.checked}
										class="checkbox mt-0.5 checkbox-sm checkbox-primary"
									/>
									<div class="min-w-0 flex-1">
										<div class="text-xs font-black text-slate-900">{sec.label}</div>
										{#if sec.preview}
											<div class="mt-0.5 truncate text-[11px] text-slate-500">{sec.preview}</div>
										{/if}
									</div>
								</label>
							{/each}
						</div>
					{/if}
				</div>

				<!-- 2. 용지 및 머리말 옵션 -->
				<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
					<span class="block text-xs font-black text-slate-800">2. 용지 · 머리말 설정</span>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div>
							<label for="pa-title" class="mb-1 block text-[11px] font-bold text-slate-600">문서 제목</label>
							<input id="pa-title" type="text" bind:value={docTitle} class="input input-xs input-bordered w-full font-bold" />
						</div>
						<div>
							<label for="pa-date" class="mb-1 block text-[11px] font-bold text-slate-600">기준 날짜</label>
							<input id="pa-date" type="date" bind:value={docDate} class="input input-xs input-bordered w-full font-bold" />
						</div>
						<div>
							<label for="pa-issuer" class="mb-1 block text-[11px] font-bold text-slate-600">출력자</label>
							<input id="pa-issuer" type="text" bind:value={docIssuer} class="input input-xs input-bordered w-full font-bold" />
						</div>
					</div>

					<div class="grid grid-cols-1 gap-3 sm:grid-cols-4">
						<div>
							<label for="pa-paper-size" class="mb-1 block text-[11px] font-bold text-slate-600">용지 규격</label>
							<select id="pa-paper-size" bind:value={paperSize} class="select select-xs select-bordered w-full font-bold">
								<option value="A4">A4 (기본)</option>
								<option value="A3">A3 (대형)</option>
								<option value="B4">B4 (공문)</option>
								<option value="B5">B5 (중형)</option>
								<option value="A5">A5 (소형)</option>
								<option value="auto">프린터 설정 따름</option>
							</select>
						</div>
						<div>
							<span class="mb-1 block text-[11px] font-bold text-slate-600">용지 방향</span>
							<div class="join w-full">
								<button type="button" onclick={() => (orientation = 'portrait')} class="btn join-item btn-xs flex-1 {orientation === 'portrait' ? 'btn-neutral' : 'btn-outline'}">세로</button>
								<button type="button" onclick={() => (orientation = 'landscape')} class="btn join-item btn-xs flex-1 {orientation === 'landscape' ? 'btn-neutral' : 'btn-outline'}">가로</button>
							</div>
						</div>
						<div>
							<span class="mb-1 block text-[11px] font-bold text-slate-600">여백</span>
							<div class="join w-full">
								{#each ['8mm', '12mm', '20mm'] as m}
									<button type="button" onclick={() => (pageMargin = /** @type {any} */ (m))} class="btn join-item btn-xs flex-1 {pageMargin === m ? 'btn-neutral' : 'btn-outline'}">{m}</button>
								{/each}
							</div>
						</div>
						<div>
							<span class="mb-1 block text-[11px] font-bold text-slate-600">색상</span>
							<div class="join w-full">
								<button type="button" onclick={() => (colorMode = 'color')} class="btn join-item btn-xs flex-1 {colorMode === 'color' ? 'btn-neutral' : 'btn-outline'}">컬러</button>
								<button type="button" onclick={() => (colorMode = 'mono')} class="btn join-item btn-xs flex-1 {colorMode === 'mono' ? 'btn-neutral' : 'btn-outline'}">흑백</button>
							</div>
						</div>
					</div>

					<div class="flex flex-wrap gap-4 pt-1 text-xs font-bold text-slate-700">
						<label class="flex cursor-pointer items-center gap-1.5">
							<input type="checkbox" bind:checked={showHeader} class="checkbox checkbox-xs checkbox-primary" />
							공문서 머리말 삽입
						</label>
						{#if showHeader}
							<label class="flex cursor-pointer items-center gap-1.5">
								<input type="checkbox" bind:checked={showApproval} class="checkbox checkbox-xs checkbox-primary" />
								결재란(담당·팀장·대표) 포함
							</label>
						{/if}
						<label class="flex cursor-pointer items-center gap-1.5">
							<input type="checkbox" bind:checked={showWatermark} class="checkbox checkbox-xs checkbox-primary" />
							전 페이지 워터마크
						</label>
					</div>

					{#if showWatermark}
						<div>
							<label for="pa-watermark" class="mb-1 block text-[11px] font-bold text-slate-600">워터마크 문구</label>
							<input id="pa-watermark" type="text" bind:value={watermarkText} class="input input-xs input-bordered w-full font-bold" />
						</div>
					{/if}
				</div>
			</div>

			<!-- 푸터 -->
			<div class="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
				<button
					type="button"
					onclick={() => (open = false)}
					class="btn rounded-xl border border-slate-300 bg-white px-5 text-xs font-black text-slate-700 hover:bg-slate-100"
				>
					취소
				</button>
				<button
					type="button"
					onclick={executePrint}
					disabled={sections.length > 0 && selectedCount === 0}
					class="btn gap-1.5 rounded-xl border-none bg-blue-600 px-6 text-xs font-black text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
				>
					<Icon icon="solar:printer-bold" class="text-sm" />
					선택 항목 인쇄
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	@media print {
		:global([data-print-skip='true']) {
			display: none !important;
		}
		:global([data-print-mono='true']) {
			filter: grayscale(100%) !important;
		}
		:global([data-print-header-active='true']) {
			display: block !important;
		}
		:global([data-print-watermark-active='true']) {
			display: block !important;
			position: fixed !important;
			inset: 0 !important;
			pointer-events: none !important;
			z-index: 9999 !important;
		}
	}
</style>
