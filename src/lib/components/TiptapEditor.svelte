<script>
	/**
	 * TiptapEditor.svelte (하이드레이션 방어 버전)
	 * @description 브라우저(client) 환경에서만 초기화되도록 가드 적용
	 */
	import { onMount, onDestroy, tick } from 'svelte';
	import { browser } from '$app/environment';
	import { Editor, Extension } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Placeholder from '@tiptap/extension-placeholder';
	import TextAlign from '@tiptap/extension-text-align';
	import Image from '@tiptap/extension-image';
	import Highlight from '@tiptap/extension-highlight';
	import { TextStyle } from '@tiptap/extension-text-style';
	import Underline from '@tiptap/extension-underline';
	import Link from '@tiptap/extension-link';
	import Icon from '@iconify/svelte';

	// 🎨 Custom Font Size Extension
	const FontSize = Extension.create({
		name: 'fontSize',
		addOptions() { return { types: ['textStyle'] }; },
		addGlobalAttributes() {
			return [{
				types: this.options.types,
				attributes: {
					fontSize: {
						default: null,
						parseHTML: el => el.style.fontSize.replace(/['"]+/g, ''),
						renderHTML: attr => attr.fontSize ? { style: `font-size: ${attr.fontSize}` } : {}
					}
				}
			}];
		},
		addCommands() {
			return {
				setFontSize: size => ({ chain }) => chain().setMark('textStyle', { fontSize: size }).run(),
				unsetFontSize: () => ({ chain }) => chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run(),
			};
		}
	});

	// 🖍️ Custom Color Extension
	const Color = Extension.create({
		name: 'color',
		addOptions() { return { types: ['textStyle'] }; },
		addGlobalAttributes() {
			return [{
				types: this.options.types,
				attributes: {
					color: {
						default: null,
						parseHTML: el => el.style.color.replace(/['"]+/g, ''),
						renderHTML: attr => attr.color ? { style: `color: ${attr.color}` } : {}
					}
				}
			}];
		},
		addCommands() {
			return {
				setColor: color => ({ chain }) => chain().setMark('textStyle', { color }).run(),
				unsetColor: () => ({ chain }) => chain().setMark('textStyle', { color: null }).removeEmptyTextStyle().run(),
			};
		}
	});

	let {
		content = $bindable(''),
		content_json = $bindable(null),
		editorInstance = $bindable(null)
	} = $props();

	let element;
	// 🛡️ [Svelte 5] 복잡한 외부 인스턴스는 $state.raw를 사용하여 Proxy 오버헤드와 충돌을 방지합니다.
	let editor = $state.raw(null);
	let isMounted = $state(false);

	onMount(async () => {
		if (!browser) return;
		
		console.log('[Tiptap] 초기화 시작...');
		isMounted = true;
		
		try {
			await tick();
			if (!element) {
				console.error('[Tiptap] 에디터 엘리먼트를 찾을 수 없습니다.');
				return;
			}

			editor = new Editor({
				element: element,
				extensions: [
					StarterKit,
					Underline,
					Highlight.configure({ multicolor: true }),
					TextStyle,
					FontSize,
					Color,
					Placeholder.configure({ placeholder: '여기에 내용을 입력하세요...' }),
					TextAlign.configure({ 
						types: ['heading', 'paragraph'],
						alignments: ['left', 'center', 'right', 'justify'] 
					}),
					Link.configure({
						openOnClick: false,
						HTMLAttributes: { target: '_blank', class: 'link link-primary' }
					}),
					Image.configure({
						HTMLAttributes: { class: 'max-w-full h-auto rounded-lg shadow-md my-4 transition-all hover:scale-[1.02]' }
					})
				],
				content: content,
				onUpdate: ({ editor: e }) => {
					content = e.getHTML();
					content_json = e.getJSON();
				},
				onCreate: ({ editor: e }) => {
					console.log('[Tiptap] 에디터 생성 완료');
					editorInstance = e;
				}
			});
		} catch (error) {
			console.error('[Tiptap] 에디터 로딩 중 치명적 오류 발생:', error);
		}
	});

	// 🔄 외부에서 content prop이 비동기로 로드되거나 초기화된 경우 에디터 본문과 동기화
	$effect(() => {
		if (editor && content !== undefined && content !== editor.getHTML()) {
			editor.commands.setContent(content || '', false);
		}
	});

	onDestroy(() => {
		if (browser) {
			console.log('[Tiptap] onDestroy 실행: 에디터 인스턴스 정리');
		}
		if (editor) {
			editor.destroy();
		}
	});

	// 툴바 명령들
	const toggleBold = () => editor?.chain().focus().toggleBold().run();
	const toggleItalic = () => editor?.chain().focus().toggleItalic().run();
	const toggleUnderline = () => editor?.chain().focus().toggleUnderline().run();
	const toggleStrike = () => editor?.chain().focus().toggleStrike().run();
	const toggleCode = () => editor?.chain().focus().toggleCode().run();
	const toggleCodeBlock = () => editor?.chain().focus().toggleCodeBlock().run();
	const toggleHeading = (level) => editor?.chain().focus().toggleHeading({ level }).run();
	const toggleBulletList = () => editor?.chain().focus().toggleBulletList().run();
	const toggleOrderedList = () => editor?.chain().focus().toggleOrderedList().run();
	const toggleBlockquote = () => editor?.chain().focus().toggleBlockquote().run();
	const setTextAlign = (align) => editor?.chain().focus().setTextAlign(align).run();
	const toggleHighlight = (color) => editor?.chain().focus().toggleHighlight({ color }).run();
	const setFontSize = (size) => editor?.chain().focus().setFontSize(size).run();
	const setColor = (color) => editor?.chain().focus().setColor(color).run();
	const undo = () => editor?.chain().focus().undo().run();
	const redo = () => editor?.chain().focus().redo().run();
	const clearFormat = () => editor?.chain().focus().unsetAllMarks().clearNodes().run();

	const addLink = () => {
		const url = window.prompt('URL을 입력하세요:');
		if (url) {
			editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
		}
	};

	const addImage = () => {
		const url = window.prompt('이미지 URL을 입력하세요:');
		if (url) {
			editor?.chain().focus().setImage({ src: url }).run();
		}
	};
</script>

<div
	class="tiptap-editor relative flex min-h-[520px] flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition focus-within:border-blue-600 selection:bg-blue-100"
>
	{#if editor}
		<div
			class="toolbar sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50/95 px-3 py-2 backdrop-blur-sm"
		>
			<!-- 1. Typography -->
			<div class="flex items-center gap-1">
				<select
					aria-label="글자 크기"
					onchange={(e) => setFontSize(e.target.value)}
					class="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
				>
					<option value="">크기</option>
					{#each ['12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'] as size}
						<option value={size}>{size.replace('px', '')}px</option>
					{/each}
				</select>
				<button type="button" title="제목 1" onclick={() => toggleHeading(1)} class="tool-btn text-xs {editor.isActive('heading', { level: 1 }) ? 'active' : ''}">H1</button>
				<button type="button" title="제목 2" onclick={() => toggleHeading(2)} class="tool-btn text-xs {editor.isActive('heading', { level: 2 }) ? 'active' : ''}">H2</button>
				<button type="button" title="제목 3" onclick={() => toggleHeading(3)} class="tool-btn text-xs {editor.isActive('heading', { level: 3 }) ? 'active' : ''}">H3</button>
			</div>

			<div class="mx-1 h-5 w-px bg-slate-200"></div>

			<!-- 2. Core Formatting -->
			<div class="flex items-center gap-0.5">
				<button type="button" title="굵게" onclick={toggleBold} class="tool-btn {editor.isActive('bold') ? 'active' : ''}"><Icon icon="ph:text-b-bold" /></button>
				<button type="button" title="기울임" onclick={toggleItalic} class="tool-btn {editor.isActive('italic') ? 'active' : ''}"><Icon icon="ph:text-italic-bold" /></button>
				<button type="button" title="밑줄" onclick={toggleUnderline} class="tool-btn {editor.isActive('underline') ? 'active' : ''}"><Icon icon="ph:text-underline-bold" /></button>
				<button type="button" title="취소선" onclick={toggleStrike} class="tool-btn {editor.isActive('strike') ? 'active' : ''}"><Icon icon="ph:text-strikethrough-bold" /></button>
			</div>

			<div class="mx-1 h-5 w-px bg-slate-200"></div>

			<!-- 3. Colors -->
			<div class="flex items-center gap-1.5 px-1">
				{#each [
					{ color: '#0f172a', label: '검정' },
					{ color: '#dc2626', label: '빨강' },
					{ color: '#2563eb', label: '파랑' },
					{ color: '#16a34a', label: '초록' },
					{ color: '#d97706', label: '주황' },
					{ color: '#9333ea', label: '보라' }
				] as item}
					<button
						type="button"
						title="글자색: {item.label}"
						onclick={() => setColor(item.color)}
						class="h-4.5 w-4.5 rounded-full ring-1 ring-slate-300 transition-transform hover:scale-115"
						style="background-color: {item.color}"
					></button>
				{/each}
			</div>

			<div class="mx-1 h-5 w-px bg-slate-200"></div>

			<!-- 4. Highlights -->
			<div class="flex items-center gap-1 px-0.5">
				{#each [
					{ color: '#fef08a', label: '노랑 형광펜' },
					{ color: '#bbf7d0', label: '초록 형광펜' },
					{ color: '#bfdbfe', label: '파랑 형광펜' },
					{ color: '#fecaca', label: '분홍 형광펜' }
				] as item}
					<button
						type="button"
						title={item.label}
						onclick={() => toggleHighlight(item.color)}
						class="h-5 w-5 rounded-md ring-1 ring-slate-200 transition-transform hover:scale-105"
						style="background-color: {item.color}"
					></button>
				{/each}
				<button type="button" onclick={clearFormat} class="tool-btn ml-0.5 text-slate-500" title="서식 지우기">
					<Icon icon="ph:eraser-bold" />
				</button>
			</div>

			<div class="mx-1 h-5 w-px bg-slate-200"></div>

			<!-- 5. Alignment -->
			<div class="flex items-center gap-0.5">
				<button type="button" title="왼쪽 정렬" onclick={() => setTextAlign('left')} class="tool-btn {editor.isActive({ textAlign: 'left' }) ? 'active' : ''}"><Icon icon="ph:text-align-left-bold" /></button>
				<button type="button" title="가운데 정렬" onclick={() => setTextAlign('center')} class="tool-btn {editor.isActive({ textAlign: 'center' }) ? 'active' : ''}"><Icon icon="ph:text-align-center-bold" /></button>
				<button type="button" title="오른쪽 정렬" onclick={() => setTextAlign('right')} class="tool-btn {editor.isActive({ textAlign: 'right' }) ? 'active' : ''}"><Icon icon="ph:text-align-right-bold" /></button>
				<button type="button" title="양쪽 정렬" onclick={() => setTextAlign('justify')} class="tool-btn {editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}"><Icon icon="ph:text-align-justify-bold" /></button>
			</div>

			<div class="mx-1 h-5 w-px bg-slate-200"></div>

			<!-- 6. Lists & Blocks -->
			<div class="flex items-center gap-0.5">
				<button type="button" title="글머리 기호 목록" onclick={toggleBulletList} class="tool-btn {editor.isActive('bulletList') ? 'active' : ''}"><Icon icon="ph:list-bullets-bold" /></button>
				<button type="button" title="번호 매기기 목록" onclick={toggleOrderedList} class="tool-btn {editor.isActive('orderedList') ? 'active' : ''}"><Icon icon="ph:list-numbers-bold" /></button>
				<button type="button" title="인용구" onclick={toggleBlockquote} class="tool-btn {editor.isActive('blockquote') ? 'active' : ''}"><Icon icon="ph:quotes-bold" /></button>
				<button type="button" title="코드 블록" onclick={toggleCodeBlock} class="tool-btn {editor.isActive('codeBlock') ? 'active' : ''}"><Icon icon="ph:terminal-window-bold" /></button>
			</div>

			<div class="mx-1 h-5 w-px bg-slate-200"></div>

			<!-- 7. Media -->
			<div class="flex items-center gap-0.5">
				<button type="button" title="링크 삽입" onclick={addLink} class="tool-btn {editor.isActive('link') ? 'active' : ''}"><Icon icon="ph:link-bold" /></button>
				<button type="button" title="이미지 URL 삽입" onclick={addImage} class="tool-btn"><Icon icon="ph:image-square-bold" /></button>
				<button type="button" title="구분선" onclick={() => editor.chain().focus().setHorizontalRule().run()} class="tool-btn"><Icon icon="ph:minus-bold" /></button>
			</div>

			<!-- 8. History -->
			<div class="ml-auto flex items-center gap-0.5">
				<button type="button" title="실행 취소" onclick={undo} class="tool-btn text-slate-400 hover:text-slate-700"><Icon icon="ph:arrow-counter-clockwise-bold" /></button>
				<button type="button" title="다시 실행" onclick={redo} class="tool-btn text-slate-400 hover:text-slate-700"><Icon icon="ph:arrow-clockwise-bold" /></button>
			</div>
		</div>
	{/if}

	<!-- 🖋️ Editor Body -->
	<div
		class="editor-body prose prose-slate max-w-none flex-1 min-h-[420px] px-6 py-5 outline-none transition-colors {isMounted ? '' : 'invisible'}"
		bind:this={element}>
	</div>

	{#if !isMounted}
		<div class="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/95">
			<span class="loading loading-md loading-spinner text-blue-600"></span>
			<p class="text-xs font-medium text-slate-400">에디터를 불러오는 중...</p>
		</div>
	{/if}
</div>

<style>
	.tool-btn {
		height: 2rem;
		min-width: 2rem;
		padding: 0 0.375rem;
		border-radius: 0.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 0.95rem;
		font-weight: 600;
		transition: background-color 0.15s ease, color 0.15s ease;
		cursor: pointer;
		background: transparent;
		border: none;
		color: #475569;
	}
	.tool-btn:hover {
		background-color: #e2e8f0;
		color: #0f172a;
	}
	.tool-btn.active {
		background-color: #eff6ff;
		color: #2563eb;
		box-shadow: inset 0 0 0 1px #bfdbfe;
	}

	:global(.ProseMirror) {
		min-height: 380px;
		outline: none;
		color: #1e293b;
		line-height: 1.7;
		letter-spacing: -0.01em;
	}
	:global(.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4) {
		color: #0f172a !important;
		font-weight: 700;
		margin-top: 1.25em;
		margin-bottom: 0.5em;
	}
	:global(.ProseMirror p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		color: #1e293b;
	}
	:global(.ProseMirror span[style*='color']) {
		color: inherit;
	}
	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: #94a3b8;
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
	:global(.ProseMirror blockquote) {
		border-left: 3px solid #3b82f6;
		background-color: #f8fafc;
		padding: 0.75rem 1rem;
		border-radius: 0 0.5rem 0.5rem 0;
		color: #475569;
	}
	:global(.ProseMirror pre) {
		background-color: #0f172a;
		color: #f8fafc;
		border-radius: 0.75rem;
		padding: 1rem 1.25rem;
	}
	:global(.ProseMirror img) {
		border-radius: 0.75rem;
		border: 1px solid #e2e8f0;
		box-shadow: 0 4px 12px rgba(15, 23, 42, 0.06);
		transition: box-shadow 0.2s ease, transform 0.2s ease;
	}
	:global(.ProseMirror img:hover) {
		box-shadow: 0 8px 20px rgba(15, 23, 42, 0.1);
	}

	/* 📱 커스텀 스크롤바 */
	.tiptap-editor ::-webkit-scrollbar {
		width: 6px;
	}
	.tiptap-editor ::-webkit-scrollbar-track {
		background: transparent;
	}
	.tiptap-editor ::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 9999px;
	}
	.tiptap-editor ::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>
