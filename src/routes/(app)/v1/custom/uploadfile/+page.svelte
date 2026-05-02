<script>
	/**
	 * @file (app)/v1/app/uploadfile/+page.svelte
	 * @description 고도화된 파일 업로드 테스트 페이지 (Svelte 5 & DaisyUI)
	 */
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import Icon from '@iconify/svelte';

	/** @type {any[]} */
	let uploadedFiles = $state([]);
</script>

<div
	class="animate-fade-in mx-auto max-w-4xl space-y-12 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- Header -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase"
				>Storage Asset Engine</span
			>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				파일 <span class="NOT-ITALIC text-blue-600"
					>업로드 <Icon
						icon="mdi:cloud-upload-outline"
						class="ml-1 inline-block align-text-bottom text-blue-600"
					/></span
				>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				안전하고 빠른 클라우드 스토리지를 기반으로 자산을 관리합니다.
			</p>
		</div>
	</div>

	<!-- Main Content -->
	<div
		class="overflow-hidden rounded-[3rem] border-2 border-slate-900 bg-white p-10 shadow-2xl md:p-14"
	>
		<div class="mb-10">
			<h3 class="mb-2 text-2xl font-black tracking-tighter text-slate-900 uppercase italic">
				Asset Dropzone
			</h3>
			<p class="text-xs font-bold text-slate-400 uppercase">
				Modular uploader component with instant preview
			</p>
		</div>

		<!-- Uploader Component Integration -->
		<ImageUploader bind:uploadedFiles multiple={true} />

		<div class="mt-16 flex flex-col items-center border-t border-slate-100 pt-10">
			<Icon icon="mdi:information-outline" class="mb-4 h-8 w-8 text-slate-200" />
			<p
				class="max-w-sm text-center text-[10px] font-black tracking-[0.2em] text-slate-300 uppercase"
			>
				이미지 뿐만 아니라 PDF, DOC, XLS 등 다양한 문서 형식을 지원하며 업로드 즉시 썸네일이
				생성되어 관리의 편의성을 제공합니다.
			</p>
		</div>
	</div>

	<!-- Result Data (Admin or Debug view) -->
	{#if uploadedFiles.length > 0}
		<div class="animate-slide-up mt-16 space-y-6">
			<h3
				class="flex items-center gap-2 text-xl font-black tracking-tighter text-slate-400 uppercase italic"
			>
				Server Response Metadata
				<span
					class="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-600 not-italic"
					>{uploadedFiles.length} FILLES</span
				>
			</h3>
			<div
				class="overflow-x-auto rounded-[2rem] bg-slate-900 p-8 font-mono text-[11px] text-emerald-400 shadow-2xl md:p-10"
			>
				<pre class="whitespace-pre-wrap">{JSON.stringify(uploadedFiles, null, 2)}</pre>
			</div>
		</div>
	{/if}
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	.animate-slide-up {
		animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
	@keyframes slideUp {
		from {
			opacity: 0;
			transform: translateY(40px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
