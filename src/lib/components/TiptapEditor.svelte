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
	class="tiptap-editor relative min-h-[600px] border-4 border-black bg-white font-['Outfit'] shadow-[12px_12px_0_rgba(0,0,0,1)] selection:bg-yellow-200"
>
	{#if editor}
		<div
			class="toolbar sticky top-0 z-20 flex flex-wrap items-center gap-1 border-b-4 border-black bg-[#fafafa] p-2"
		>
			<!-- 1. Typography -->
			<div class="flex items-center border-r-2 border-black/10 pr-2 mr-1 gap-1">
				<select 
					onchange={(e) => setFontSize(e.target.value)}
					class="h-9 border-2 border-black bg-white px-1 text-[10px] font-black uppercase outline-none focus:bg-yellow-400"
				>
					<option value="">Size</option>
					{#each ['12px', '14px', '16px', '18px', '20px', '24px', '32px', '48px'] as size}
						<option value={size}>{size.replace('px','')}</option>
					{/each}
				</select>
				<button type="button" onclick={() => toggleHeading(1)} class="tool-btn {editor.isActive('heading', { level: 1 }) ? 'active' : ''}">H1</button>
				<button type="button" onclick={() => toggleHeading(2)} class="tool-btn {editor.isActive('heading', { level: 2 }) ? 'active' : ''}">H2</button>
				<button type="button" onclick={() => toggleHeading(3)} class="tool-btn {editor.isActive('heading', { level: 3 }) ? 'active' : ''}">H3</button>
			</div>

			<!-- 2. Core Formatting -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={toggleBold} class="tool-btn {editor.isActive('bold') ? 'active' : ''}"><Icon icon="ph:text-b-bold" /></button>
				<button type="button" onclick={toggleItalic} class="tool-btn {editor.isActive('italic') ? 'active' : ''}"><Icon icon="ph:text-italic-bold" /></button>
				<button type="button" onclick={toggleUnderline} class="tool-btn {editor.isActive('underline') ? 'active' : ''}"><Icon icon="ph:text-underline-bold" /></button>
				<button type="button" onclick={toggleStrike} class="tool-btn {editor.isActive('strike') ? 'active' : ''}"><Icon icon="ph:text-strikethrough-bold" /></button>
			</div>

			<!-- 3. Colors -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1 gap-1 items-center px-1">
				{#each ['#000000', '#ff0000', '#0000ff', '#008000', '#ffa500', '#800080'] as c}
					<button type="button" onclick={() => setColor(c)} class="h-5 w-5 rounded-full border border-black/20 hover:scale-125 transition-transform" style="background-color: {c}"></button>
				{/each}
			</div>

			<!-- 4. Highlights -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1 gap-0.5">
				{#each ['#ffec99', '#b2f2bb', '#a5d8ff', '#ffc9c9'] as h}
					<button type="button" onclick={() => toggleHighlight(h)} class="h-8 w-4 border border-black/10 hover:brightness-90" style="background-color: {h}"></button>
				{/each}
				<button type="button" onclick={clearFormat} class="tool-btn !w-auto px-2 text-[10px] font-black underline" title="Clear All Formatting">CLEAR</button>
			</div>

			<!-- 5. Alignment -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={() => setTextAlign('left')} class="tool-btn {editor.isActive({ textAlign: 'left' }) ? 'active' : ''}"><Icon icon="ph:text-align-left-bold" /></button>
				<button type="button" onclick={() => setTextAlign('center')} class="tool-btn {editor.isActive({ textAlign: 'center' }) ? 'active' : ''}"><Icon icon="ph:text-align-center-bold" /></button>
				<button type="button" onclick={() => setTextAlign('right')} class="tool-btn {editor.isActive({ textAlign: 'right' }) ? 'active' : ''}"><Icon icon="ph:text-align-right-bold" /></button>
				<button type="button" onclick={() => setTextAlign('justify')} class="tool-btn {editor.isActive({ textAlign: 'justify' }) ? 'active' : ''}"><Icon icon="ph:text-align-justify-bold" /></button>
			</div>

			<!-- 6. Lists & Blocks -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={toggleBulletList} class="tool-btn {editor.isActive('bulletList') ? 'active' : ''}"><Icon icon="ph:list-bullets-bold" /></button>
				<button type="button" onclick={toggleOrderedList} class="tool-btn {editor.isActive('orderedList') ? 'active' : ''}"><Icon icon="ph:list-numbers-bold" /></button>
				<button type="button" onclick={toggleBlockquote} class="tool-btn {editor.isActive('blockquote') ? 'active' : ''}"><Icon icon="ph:quotes-bold" /></button>
				<button type="button" onclick={toggleCodeBlock} class="tool-btn {editor.isActive('codeBlock') ? 'active' : ''}"><Icon icon="ph:terminal-window-bold" /></button>
			</div>

			<!-- 7. Media -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={addLink} class="tool-btn {editor.isActive('link') ? 'active' : ''}"><Icon icon="ph:link-bold" /></button>
				<button type="button" onclick={addImage} class="tool-btn"><Icon icon="ph:image-square-bold" /></button>
				<button type="button" onclick={() => editor.chain().focus().setHorizontalRule().run()} class="tool-btn" title="Divider"><Icon icon="ph:minus-bold" /></button>
			</div>

			<!-- 8. History -->
			<div class="flex ml-auto">
				<button type="button" onclick={undo} class="tool-btn opacity-50 hover:opacity-100"><Icon icon="ph:arrow-counter-clockwise-bold" /></button>
				<button type="button" onclick={redo} class="tool-btn opacity-50 hover:opacity-100"><Icon icon="ph:arrow-clockwise-bold" /></button>
			</div>
		</div>
	{/if}

	<!-- 🖋️ Editor Body -->
	<div 
		class="editor-body prose max-w-none min-h-[500px] p-8 outline-none transition-all focus:bg-slate-50/30 {isMounted ? '' : 'invisible'}" 
		bind:this={element}>
	</div>

	{#if !isMounted}
		<div class="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white z-30">
			<span class="loading loading-lg loading-spinner text-black"></span>
			<p class="text-[10px] font-black tracking-[0.4em] uppercase italic opacity-30">Cortex Editor Booting...</p>
		</div>
	{/if}
</div>

<style>
	.tool-btn {
		height: 2.25rem;
		width: 2.25rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1rem;
		font-weight: 900;
		transition: all 0.1s;
		cursor: pointer;
		background: transparent;
		border: none;
		color: #000;
	}
	.tool-btn:hover {
		background-color: #000;
		color: #fff;
	}
	.tool-btn.active {
		background-color: #000;
		color: #fff;
	}

	:global(.ProseMirror) {
		min-height: 400px;
		outline: none;
		color: #000;
		line-height: 1.5; /* 줄 간격 최적화 */
		letter-spacing: -0.01em; /* 글자 간격 최적화 */
	}
	/* 🛡️ [색상 고정] Tailwind prose가 헤더 색상을 흰색이나 다른 색으로 바꾸는 것을 방지 */
	:global(.ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror h4) {
		color: #000 !important;
		margin-top: 1.2em;
		margin-bottom: 0.6em;
	}
	:global(.ProseMirror p) {
		margin-top: 0.5em;
		margin-bottom: 0.5em;
		color: #000;
	}
	:global(.ProseMirror span[style*='color']) {
		color: inherit;
	}
	:global(.ProseMirror p.is-editor-empty:first-child::before) {
		color: #adb5bd;
		content: attr(data-placeholder);
		float: left;
		height: 0;
		pointer-events: none;
	}
	:global(.ProseMirror img) {
		border: 4px solid black;
		transition: all 0.3s;
	}
	:global(.ProseMirror img:hover) {
		box-shadow: 10px 10px 0 #3b82f6;
		transform: translate(-4px, -4px);
	}

	/* 📱 커스텀 스크롤바 */
	.tiptap-editor ::-webkit-scrollbar {
		width: 4px;
	}
	.tiptap-editor ::-webkit-scrollbar-track {
		background: #f1f1f1;
	}
	.tiptap-editor ::-webkit-scrollbar-thumb {
		background: #000;
	}
</style>
