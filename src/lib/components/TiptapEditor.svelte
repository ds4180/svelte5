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
	let editor = $state(null);
	let isMounted = $state(false);

	onMount(async () => {
		if (!browser) return;
		isMounted = true;
		await tick();
		if (!element) return;

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
				TextAlign.configure({ types: ['heading', 'paragraph'] }),
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
			<!-- Size & Type -->
			<div class="flex items-center border-r-2 border-black/10 pr-2 mr-1 gap-1">
				<select 
					onchange={(e) => setFontSize(e.target.value)}
					class="h-10 border-2 border-black bg-white px-2 text-xs font-black uppercase italic outline-none focus:bg-yellow-400"
				>
					<option value="">Size</option>
					<option value="12px">12</option>
					<option value="14px">14</option>
					<option value="16px">16</option>
					<option value="18px">18</option>
					<option value="20px">20</option>
					<option value="24px">24</option>
					<option value="30px">30</option>
					<option value="36px">36</option>
					<option value="48px">48</option>
					<option value="60px">60</option>
					<option value="72px">72</option>
				</select>
				<button type="button" onclick={() => toggleHeading(1)} class="tool-btn {editor.isActive('heading', { level: 1 }) ? 'active' : ''}">H1</button>
				<button type="button" onclick={() => toggleHeading(2)} class="tool-btn {editor.isActive('heading', { level: 2 }) ? 'active' : ''}">H2</button>
				<button type="button" onclick={() => toggleHeading(3)} class="tool-btn {editor.isActive('heading', { level: 3 }) ? 'active' : ''}">H3</button>
			</div>

			<!-- Core Formatting -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={toggleBold} class="tool-btn {editor.isActive('bold') ? 'active' : ''}"><Icon icon="ph:text-b-bold" /></button>
				<button type="button" onclick={toggleItalic} class="tool-btn {editor.isActive('italic') ? 'active' : ''}"><Icon icon="ph:text-italic-bold" /></button>
				<button type="button" onclick={toggleUnderline} class="tool-btn {editor.isActive('underline') ? 'active' : ''}"><Icon icon="ph:text-underline-bold" /></button>
				<button type="button" onclick={toggleStrike} class="tool-btn {editor.isActive('strike') ? 'active' : ''}"><Icon icon="ph:text-strikethrough-bold" /></button>
			</div>

			<!-- Text Colors -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1 gap-1 items-center px-1">
				<button type="button" onclick={() => setColor('#000000')} class="h-6 w-6 rounded-full border border-black/20 bg-black hover:scale-125 transition-transform" title="Black Text"></button>
				<button type="button" onclick={() => setColor('#fa5252')} class="h-6 w-6 rounded-full border border-black/20 bg-[#fa5252] hover:scale-125 transition-transform" title="Red Text"></button>
				<button type="button" onclick={() => setColor('#228be6')} class="h-6 w-6 rounded-full border border-black/20 bg-[#228be6] hover:scale-125 transition-transform" title="Blue Text"></button>
				<button type="button" onclick={() => setColor('#40c057')} class="h-6 w-6 rounded-full border border-black/20 bg-[#40c057] hover:scale-125 transition-transform" title="Green Text"></button>
			</div>

			<!-- Colors (Highlight hack) -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1 gap-1">
				<button type="button" onclick={() => toggleHighlight('#ffec99')} class="h-8 w-6 border border-black/20 bg-[#ffec99] hover:scale-110 transition-transform" title="Yellow Highlight"></button>
				<button type="button" onclick={() => toggleHighlight('#b2f2bb')} class="h-8 w-6 border border-black/20 bg-[#b2f2bb] hover:scale-110 transition-transform" title="Green Highlight"></button>
				<button type="button" onclick={() => toggleHighlight('#a5d8ff')} class="h-8 w-6 border border-black/20 bg-[#a5d8ff] hover:scale-110 transition-transform" title="Blue Highlight"></button>
				<button type="button" onclick={() => toggleHighlight('#ffc9c9')} class="h-8 w-6 border border-black/20 bg-[#ffc9c9] hover:scale-110 transition-transform" title="Pink Highlight"></button>
				<button type="button" onclick={() => { editor?.chain().focus().unsetHighlight().run(); editor?.chain().focus().unsetColor().run(); }} class="tool-btn text-[10px] font-black underline">CLR</button>
			</div>

			<!-- Code & Lists -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={toggleCode} class="tool-btn {editor.isActive('code') ? 'active' : ''}"><Icon icon="ph:code-bold" /></button>
				<button type="button" onclick={toggleCodeBlock} class="tool-btn {editor.isActive('codeBlock') ? 'active' : ''}"><Icon icon="ph:terminal-window-bold" /></button>
				<button type="button" onclick={toggleBulletList} class="tool-btn {editor.isActive('bulletList') ? 'active' : ''}"><Icon icon="ph:list-bullets-bold" /></button>
				<button type="button" onclick={toggleOrderedList} class="tool-btn {editor.isActive('orderedList') ? 'active' : ''}"><Icon icon="ph:list-numbers-bold" /></button>
				<button type="button" onclick={toggleBlockquote} class="tool-btn {editor.isActive('blockquote') ? 'active' : ''}"><Icon icon="ph:quotes-bold" /></button>
			</div>

			<!-- Alignment -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={() => setTextAlign('left')} class="tool-btn {editor.isActive({ textAlign: 'left' }) ? 'active' : ''}"><Icon icon="ph:text-align-left-bold" /></button>
				<button type="button" onclick={() => setTextAlign('center')} class="tool-btn {editor.isActive({ textAlign: 'center' }) ? 'active' : ''}"><Icon icon="ph:text-align-center-bold" /></button>
				<button type="button" onclick={() => setTextAlign('right')} class="tool-btn {editor.isActive({ textAlign: 'right' }) ? 'active' : ''}"><Icon icon="ph:text-align-right-bold" /></button>
			</div>

			<!-- Media -->
			<div class="flex border-r-2 border-black/10 pr-1 mr-1">
				<button type="button" onclick={addLink} class="tool-btn {editor.isActive('link') ? 'active' : ''}"><Icon icon="ph:link-bold" /></button>
				<button type="button" onclick={addImage} class="tool-btn"><Icon icon="ph:image-square-bold" /></button>
				<button type="button" onclick={() => editor.chain().focus().setHorizontalRule().run()} class="tool-btn" title="Divider"><Icon icon="ph:minus-bold" /></button>
			</div>

			<!-- Actions -->
			<div class="flex ml-auto">
				<button type="button" onclick={undo} class="tool-btn opacity-50 hover:opacity-100"><Icon icon="ph:arrow-counter-clockwise-bold" /></button>
				<button type="button" onclick={redo} class="tool-btn opacity-50 hover:opacity-100"><Icon icon="ph:arrow-clockwise-bold" /></button>
			</div>
		</div>
	{/if}

	<!-- 🖋️ Editor Body -->
	<div 
		class="editor-body prose prose-xl max-w-none min-h-[500px] p-12 outline-none transition-all focus:bg-slate-50/30 {isMounted ? '' : 'invisible'}" 
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
		height: 2.5rem;
		width: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.125rem;
		font-weight: 900;
		transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
