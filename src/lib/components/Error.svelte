<script>
	/**
	 * Error.svelte
	 * @description FastAPI의 에러 응답(detail)을 고대비(High-Visibility) 경고 박스로 표시하는 컴포넌트
	 * @prop {object|null} error - FastAPI 에러 객체 ({ detail: string | Array })
	 */
	let { error = null } = $props();
</script>

{#if error && error.detail}
	<div
		role="alert"
		aria-live="assertive"
		class="error-shake my-3 border-2 border-rose-600 bg-rose-50 p-4 text-rose-950 shadow-[4px_4px_0px_0px_#e11d48]"
	>
		<div class="flex items-start gap-3">
			<span
				class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center bg-rose-600 text-xs font-black text-white"
			>
				!
			</span>

			<div class="min-w-0 flex-1">
				<div class="mb-1 text-[10px] font-black tracking-widest text-rose-600 uppercase">
					Authentication Alert / 인증 오류
				</div>

				<!-- 문자열 에러 -->
				{#if typeof error.detail === 'string'}
					<p class="text-sm leading-snug font-extrabold text-rose-800 break-keep">
						{error.detail}
					</p>

					<!-- 배열 에러 (FastAPI 유효성 검사 에러) -->
				{:else if Array.isArray(error.detail) && error.detail.length > 0}
					<ul class="list-inside list-disc space-y-1 text-sm font-bold text-rose-800">
						{#each error.detail as err}
							<li>
								{#if err.loc && err.loc.length > 1}
									<strong class="font-black text-rose-950">{err.loc[1]}</strong> :
								{/if}
								{err.msg}
							</li>
						{/each}
					</ul>
				{/if}
			</div>
		</div>
	</div>
{/if}

<style>
	.error-shake {
		animation: errorShake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
	}
	@keyframes errorShake {
		10%,
		90% {
			transform: translate3d(-2px, 0, 0);
		}
		20%,
		80% {
			transform: translate3d(4px, 0, 0);
		}
		30%,
		50%,
		70% {
			transform: translate3d(-6px, 0, 0);
		}
		40%,
		60% {
			transform: translate3d(6px, 0, 0);
		}
	}
</style>
