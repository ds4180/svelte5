<script>
	/**
	 * @file UploadEngine.svelte
	 * @description 파일 업로드 및 관리 서비스 엔진 (Lego Architecture)
	 * @prop {object} post - 부모 게시물 객체
	 * @prop {object} config - 서비스 앱 설정 (allow_types, max_size 등)
	 */
	import { onMount } from 'svelte';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import Icon from '@iconify/svelte';

	let { post, config = {} } = $props();

	// 게시물에 이미 연결된 파일들이 있다면 표시 (extra_data 또는 별도 테이블 연동 예정)
	// 현재는 간단히 ImageUploader의 내부 상태로 관리하거나 부모로부터 넘겨받음
	let uploadedFiles = $state(post?.extra_data?.attachments || []);

	$effect(() => {
		// 파일 목록이 변경되면 부모 데이터 등에 반영하는 로직 (필요시)
		console.log('🔗 [UploadEngine] Attached files:', uploadedFiles);
	});
</script>

<div class="upload-engine mt-8 border-t-2 border-slate-100 pt-8">
	<div class="mb-6 flex items-center justify-between">
		<h4 class="flex items-center gap-2 text-lg font-black uppercase italic tracking-tighter">
			<Icon icon="ph:file-arrow-up-bold" class="text-blue-600" />
			Attached <span class="text-blue-600">Files</span>
		</h4>
		<span class="text-[10px] font-bold opacity-30 uppercase tracking-widest">
			Engine: Upload_v1.0
		</span>
	</div>

	<!-- 공통 이미지 업로더 컴포넌트 재사용 -->
	<ImageUploader 
		bind:uploadedFiles 
		multiple={config.multiple !== false}
	/>

	{#if uploadedFiles.length === 0}
		<p class="mt-4 text-center text-xs font-bold italic opacity-30">
			No files have been authorized for this entry.
		</p>
	{/if}
</div>

<style>
	/* 서비스별 커스텀 스타일 */
</style>
