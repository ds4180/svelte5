<script>
	/**
	 * ============================================================================
	 * [동적 앱 엔진 런처 페이지 (+page.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 파일의 역할:
	 * 게시판(board), 페이지(page), 커스텀 앱 등 시스템에 등록된 모든 앱을 
	 * 사용자가 요청한 주소(/v1/app/앱아이디/경로)에 맞춰 화면에 띄워주는 
	 * '만능 앱 런처(Universal App Launcher)'입니다.
	 * 
	 * 🌟 핵심 수정 사항 (반응성 복구):
	 * 과거에는 '마운트 루프(무한 새로고침 현상)'를 막으려고 `const TargetComponent` 상수로 
	 * 고정해 두어서, 메뉴를 눌러 주소가 바뀌어도 화면이 안 바뀌고 F5 새로고침을 해야만 했습니다.
	 * 
	 * 이제는 Svelte 5의 `$derived` 룬과 `{#key}` 블록을 조합하여:
	 * 1. 주소창의 URL(appId 또는 slug)이 바뀌면 F5 없이 즉시 컴포넌트가 교체되고,
	 * 2. `{#key}` 블록이 이전 화면의 잔상을 깨끗이 정리(Unmount)하고 새 화면을 띄워주어
	 *    무한 루프 없이 부드러운 SPA 화면 전환을 완벽하게 지원합니다.
	 */
	import * as Engines from '$lib'; // $lib/index.js 에 등록된 모든 앱 엔진 컴포넌트 맵
	import { fade } from 'svelte/transition';

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// ----------------------------------------------------------------------------
	// [1단계: 반응형 대상 컴포넌트 결정 ($derived)]
	// ----------------------------------------------------------------------------
	// URL이 바뀌어 data.appInfo 가 변경되면, Svelte 5가 스스로 감지하여
	// 실행할 컴포넌트를 즉시 다시 찾아냅니다. (반응성 복원!)
	let TargetComponent = $derived(
		data.appInfo?.main_component ? Engines[data.appInfo.main_component] : null
	);
</script>

<div class="app-viewport min-h-[70vh]" in:fade>
	<!-- 
		🔑 [2단계: {#key} 블록을 통한 안전한 화면 갱신]
		app_id 나 slug 가 바뀔 때마다 내부를 새롭게 깨끗이 리셋(재마운트)해 줍니다.
		이를 통해 이전 데이터 잔상이 남거나 무한 루프가 도는 버그를 원천 차단합니다.
	-->
	{#key `${data.appInfo?.app_id}-${data.slug}`}
		{#if TargetComponent}
			<!-- 🧩 찾은 엔진 컴포넌트(예: BoardEngine 등)를 화면에 렌더링 -->
			<TargetComponent 
				slug={data.slug} 
				appId={data.appInfo?.app_id} 
				initialData={data.initialData} 
			/>
		{:else}
			<!-- 시스템에 등록되지 않은 컴포넌트명일 때 표시되는 친절한 안내 화면 -->
			<div class="container mx-auto max-w-2xl py-16 text-center">
				<div class="alert flex-col gap-3 rounded-2xl p-8 alert-warning shadow-md">
					<span class="text-6xl">🧩</span>
					<div>
						<h3 class="text-lg font-bold">컴포넌트를 찾을 수 없습니다</h3>
						<p class="mt-1 text-sm opacity-70">
							App Registry에 등록된 컴포넌트명 (<strong>{data.appInfo?.main_component}</strong>)이 엔진 지도(<code>$lib/index.js</code>)에 존재하는지 확인하세요.
						</p>
					</div>
					<a href="/v1/admin/app" class="btn btn-sm btn-primary"> App 설정 확인하러 가기 </a>
				</div>
			</div>
		{/if}
	{/key}
</div>
