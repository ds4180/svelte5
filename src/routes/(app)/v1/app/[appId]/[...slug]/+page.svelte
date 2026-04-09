<script>
	/**
	 * /v1/app/[appId]/[...slug]/+page.svelte
	 * @description 앱 엔진 동적 마운트 페이지
	 *   - AppRegistry의 main_component 문자열로 실제 엔진 컴포넌트를 결정
	 */
	import * as Engines from '$lib'; // $lib/index.js에 등록된 엔진 컴포넌트 맵
	import { fade } from 'svelte/transition';

	/** @type {import('./$types').PageData} */
	let { data } = $props();

	// 🚀 [v2.2.4 해결] $derived 대신 상수로 선언하여 마운트 루프 방지
	// 페이지 로드 시 엔진을 한 번만 결정하여 불필요한 재마운트(리마운트 루프)를 막습니다.
	const TargetComponent = Engines[data.appInfo.main_component];
</script>

<div class="app-viewport min-h-[70vh]" in:fade>
	{#if TargetComponent}
		<!-- 🧩 등록된 엔진 컴포넌트 동적 마운트 -->
		<TargetComponent slug={data.slug} appId={data.appInfo.app_id} initialData={data.initialData} />
	{:else}
		<!-- 엔진 컴포넌트를 찾지 못한 경우 안내 -->
		<div class="container mx-auto max-w-2xl py-16 text-center">
			<div class="alert flex-col gap-3 rounded-2xl p-8 alert-warning shadow-md">
				<span class="text-6xl">🧩</span>
				<div>
					<h3 class="text-lg font-bold">컴포넌트를 찾을 수 없습니다</h3>
					<p class="mt-1 text-sm opacity-70">
						App Registry에 등록된 컴포넌트명 (<strong>{data.appInfo.main_component}</strong>)이 엔진
						지도(<code>$lib/index.js</code>)에 존재하는지 확인하세요.
					</p>
				</div>
				<a href="/v1/admin/app" class="btn btn-sm btn-primary"> App 설정 확인하러 가기 </a>
			</div>
		</div>
	{/if}
</div>
