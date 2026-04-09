<script>
	/**
	 * TiptapEditor.svelte (하이드레이션 방어 버전)
	 * @description 브라우저(client) 환경에서만 초기화되도록 가드 적용
	 */
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';
	import TextAlign from '@tiptap/extension-text-align';
	import Image from '@tiptap/extension-image';
	import Highlight from '@tiptap/extension-highlight';
	import { TextStyle } from '@tiptap/extension-text-style';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
	import Icon from '@iconify/svelte';

	let {
		content = $bindable(''),
		content_json = $bindable(null),
		editorInstance = $bindable(null)
	} = $props();

	let element;
	let editor = $state(null);
	let isMounted = $state(false);

	onMount(() => {
		if (!browser) return;
		isMounted = true;

		editor = new Editor({
			element: element,
			extensions: [
				StarterKit,
				Underline,
				Highlight,
				TextStyle,
				Placeholder.configure({ placeholder: '여기에 내용을 입력하세요...' }),
				TextAlign.configure({ types: ['heading', 'paragraph'] }),
				Link.configure({
					openOnClick: false,
					HTMLAttributes: { target: '_blank', class: 'link link-primary' }
				}),
				Image.configure({
					HTMLAttributes: { class: 'max-w-full h-auto rounded-lg shadow-md my-4' }
				})
			],
			content: content,
			onUpdate: ({ editor: e }) => {
				content = e.getHTML();
				content_json = e.getJSON();
			},
			onCreate: ({ editor: e }) => {
				editorInstance = e;
			}
		});
	});

	onDestroy(() => {
		if (editor) editor.destroy();
	});

	// 툴바 명령들
	const toggleBold = () => editor?.chain().focus().toggleBold().run();
	const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
	const toggleUnderline = () => editor?.chain().focus().toggleUnderline().run();
	const toggleHeading = (level) => editor?.chain().focus().toggleHeading({ level }).run();
</script>

<div
	class="tiptap-editor min-h-[400px] overflow-hidden rounded-lg border border-base-300 bg-base-100 shadow-sm"
>
	{#if isMounted}
		{#if editor}
			<div
				class="toolbar flex flex-wrap items-center gap-2 border-b border-base-300 bg-base-200 p-2 transition-opacity"
			>
				<button
					type="button"
					onclick={toggleBold}
					class="btn btn-sm {editor.isActive('bold') ? 'btn-primary' : 'btn-ghost'}"
				>
					<Icon icon="lucide:bold" />
				</button>
				<button
					type="button"
					onclick={toggleItalic}
					class="btn btn-sm {editor.isActive('italic') ? 'btn-primary' : 'btn-ghost'}"
				>
					<Icon icon="lucide:italic" />
				</button>
				<button
					type="button"
					onclick={() => toggleHeading(1)}
					class="btn btn-sm {editor.isActive('heading', { level: 1 })
						? 'btn-primary'
						: 'btn-ghost'}"
				>
					<Icon icon="lucide:heading-1" />
				</button>
			</div>
		{/if}
		<div class="editor-body prose prose-sm min-h-[300px] max-w-none p-4" bind:this={element}></div>
	{:else}
		<!-- 서버 사이드 스켈레톤 (하이드레이션 정합성 확보) -->
		<div class="flex h-[400px] flex-col items-center justify-center gap-4 opacity-30">
			<span class="loading loading-lg loading-spinner text-primary"></span>
			<p class="text-xs font-black tracking-widest uppercase">Editor Booting...</p>
		</div>
	{/if}
</div>
