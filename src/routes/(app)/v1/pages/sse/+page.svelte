<script>
	import { onDestroy } from 'svelte';
	import Icon from '@iconify/svelte';

	/** @typedef {{ id: string, event: string, data: any, receivedAt: string }} SseLogItem */

	let status = $state('IDLE'); // IDLE | CONNECTING | OPEN | CLOSED | ERROR
	let eventCount = $state(10);
	let progress = $state(0);
	/** @type {SseLogItem[]} */
	let logs = $state([]);
	/** @type {EventSource | null} */
	let es = null;

	function appendLog(event, rawData, id = '-') {
		let parsed = rawData;
		try {
			parsed = JSON.parse(rawData);
		} catch {
			// plain text fallback
		}
		logs = [
			{
				id: String(id),
				event,
				data: parsed,
				receivedAt: new Date().toLocaleTimeString('ko-KR', { hour12: false })
			},
			...logs
		].slice(0, 50);
	}

	function connect() {
		disconnect();
		progress = 0;
		status = 'CONNECTING';

		const url = `/v1/pages/sse/stream?count=${eventCount}`;
		const source = new EventSource(url);
		es = source;

		source.onopen = () => {
			status = 'OPEN';
		};

		source.addEventListener('connected', (e) => {
			status = 'OPEN';
			appendLog('connected', e.data, e.lastEventId || '0');
		});

		source.addEventListener('tick', (e) => {
			appendLog('tick', e.data, e.lastEventId || '-');
			try {
				const payload = JSON.parse(e.data);
				if (typeof payload.progress === 'number') {
					progress = payload.progress;
				}
			} catch {
				// ignore
			}
		});

		source.addEventListener('done', (e) => {
			appendLog('done', e.data, e.lastEventId || '-');
			progress = 100;
			disconnect();
		});

		source.onerror = () => {
			if (source.readyState === EventSource.CLOSED) {
				status = 'CLOSED';
			} else {
				status = 'ERROR';
			}
		};
	}

	function disconnect() {
		if (es) {
			es.close();
			es = null;
		}
		if (status === 'OPEN' || status === 'CONNECTING') {
			status = 'CLOSED';
		}
	}

	function clearLogs() {
		logs = [];
		progress = 0;
	}

	onDestroy(() => {
		disconnect();
	});

	const statusBadgeClass = $derived(
		status === 'OPEN'
			? 'bg-emerald-100 text-emerald-700 border-emerald-200'
			: status === 'CONNECTING'
				? 'bg-amber-100 text-amber-700 border-amber-200'
				: status === 'ERROR'
					? 'bg-rose-100 text-rose-700 border-rose-200'
					: 'bg-slate-100 text-slate-600 border-slate-200'
	);
</script>

<div class="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
	<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
		<div class="flex flex-wrap items-center justify-between gap-4">
			<div>
				<div class="flex items-center gap-2">
					<Icon icon="ph:broadcast-bold" class="text-2xl text-indigo-600" />
					<h1 class="text-xl font-black text-slate-900">SSE (Server-Sent Events) 실시간 스트림 예제</h1>
				</div>
				<p class="mt-1 text-sm text-slate-500">
					HTTP 단일 연결(<code class="rounded bg-slate-100 px-1.5 py-0.5 text-xs">text/event-stream</code>)로 서버가 클라이언트에 단방향 이벤트를 푸시하는 표준 기술입니다.
				</p>
			</div>
			<span class="rounded-full border px-3 py-1 text-xs font-black {statusBadgeClass}">
				상태: {status}
			</span>
		</div>

		<!-- 컨트롤 패널 -->
		<div class="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
			<label class="flex items-center gap-2 text-xs font-bold text-slate-700">
				전송 횟수
				<select
					bind:value={eventCount}
					disabled={status === 'OPEN' || status === 'CONNECTING'}
					class="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800"
				>
					<option value={5}>5회 (5초)</option>
					<option value={10}>10회 (10초)</option>
					<option value={20}>20회 (20초)</option>
				</select>
			</label>

			<button
				type="button"
				onclick={connect}
				disabled={status === 'OPEN' || status === 'CONNECTING'}
				class="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700 disabled:opacity-50 transition cursor-pointer"
			>
				<Icon icon="ph:play-bold" />
				SSE 연결 시작
			</button>

			<button
				type="button"
				onclick={disconnect}
				disabled={status !== 'OPEN' && status !== 'CONNECTING'}
				class="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition cursor-pointer"
			>
				<Icon icon="ph:stop-bold" />
				연결 종료
			</button>

			<button
				type="button"
				onclick={clearLogs}
				class="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
			>
				<Icon icon="ph:trash-bold" />
				로그 비우기
			</button>
		</div>

		<!-- 진행률 바 -->
		<div class="mt-4">
			<div class="mb-1 flex justify-between text-xs font-bold text-slate-500">
				<span>스트림 진행률</span>
				<span>{progress}%</span>
			</div>
			<div class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
				<div
					class="h-full rounded-full bg-indigo-600 transition-all duration-300"
					style="width: {progress}%"
				></div>
			</div>
		</div>
	</div>

	<!-- 수신 로그 -->
	<div class="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
		<h2 class="text-sm font-black text-slate-800">수신 이벤트 로그 ({logs.length})</h2>
		{#if logs.length === 0}
			<p class="mt-4 rounded-2xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-400">
				"SSE 연결 시작" 버튼을 누르면 서버에서 1초 간격으로 이벤트를 전송합니다.
			</p>
		{:else}
			<div class="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
				{#each logs as item (item.id + '-' + item.receivedAt + '-' + item.event)}
					<div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs">
						<div class="flex items-center justify-between gap-2">
							<div class="flex items-center gap-2">
								<span class="rounded-lg bg-indigo-100 px-2 py-0.5 font-mono font-bold text-indigo-700">
									event: {item.event}
								</span>
								<span class="font-mono text-slate-400">id: {item.id}</span>
							</div>
							<span class="font-mono text-slate-400">{item.receivedAt}</span>
						</div>
						<pre class="mt-2 overflow-x-auto font-mono text-[11px] text-slate-700">{JSON.stringify(item.data, null, 2)}</pre>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
