<script>
	/**
	 * Error.svelte
	 * @description FastAPI의 에러 응답(detail)을 화면에 표시하는 컴포넌트 (DaisyUI 스타일 적용)
	 * @prop {object|null} error - FastAPI 에러 객체 ({ detail: string | Array })
	 */
	let { error = null } = $props();
</script>

{#if error && error.detail}
	<div class="my-2 alert alert-error">
		<!-- 문자열 에러 -->
		{#if typeof error.detail === 'string'}
			<span>⚠️ {error.detail}</span>

			<!-- 배열 에러 (FastAPI 유효성 검사 에러) -->
		{:else if Array.isArray(error.detail) && error.detail.length > 0}
			<ul class="list-inside list-disc space-y-1">
				{#each error.detail as err}
					<li>
						{#if err.loc && err.loc.length > 1}
							<strong>{err.loc[1]}</strong> :
						{/if}
						{err.msg}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
