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
	import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
	import TaskList from '@tiptap/extension-task-list';
	import TaskItem from '@tiptap/extension-task-item';
	import {
		ChartNode,
		CalloutNode,
		DetailsNode,
		ActionCardNode,
		EmbedNode,
		parseChartDatasets
	} from '$lib/components/tiptap/extensions';
	import '$lib/components/tiptap/tiptap-blocks.css';
	import { env } from '$env/dynamic/public';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { portal } from '$lib/actions/portal';
	import { getSecureMediaUrl } from '$lib/config/media';
	import { registerPendingPrivateAsset, uploadFiles } from '$lib/services/mediaService';
	import { formatApiError } from '$lib/utils/error';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import PersonalMediaPickerModal from '$lib/components/PersonalMediaPickerModal.svelte';
	import Icon from '@iconify/svelte';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	const auth = getAuthContext();

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
		editorInstance = $bindable(null),
		slug = '',
		enableUpload = true
	} = $props();

	let element;
	let wrapperEl;
	let quickImageInput;
	// 🛡️ [Svelte 5] 복잡한 외부 인스턴스는 $state.raw를 사용하여 Proxy 오버헤드와 충돌을 방지합니다.
	let editor = $state.raw(null);
	let isMounted = $state(false);
	let isTableActive = $state(false);
	let isCalloutActive = $state(false);
	let showUploadModal = $state(false);
	let showPersonalPicker = $state(false);
	let activeBlockModal = $state(/** @type {'chart' | 'action' | 'embed' | null} */ (null));
	let editingChartPos = $state(/** @type {number | null} */ (null));
	let isDirectUploading = $state(false);
	let lastEmittedHtml = content || '';
	const userSubPath = $derived(auth.user?.id ? `USERS/${auth.user.id}` : '');

	let chartForm = $state({
		chartType: 'bar',
		title: '월별 운행 현황',
		labels: '1월, 2월, 3월, 4월',
		datasets: [{ label: '2026년', values: '12, 19, 15, 28', color: '#2563eb' }],
		horizontal: false,
		stacked: false,
		showLegend: true
	});
	let actionForm = $state({ label: '휴무 신청 바로가기', url: '/v1/custom/dayoff', description: '직원 휴무 신청 페이지로 이동합니다.', style: 'primary' });
	let embedForm = $state({ src: '', title: '임베드 콘텐츠' });

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
					}),
					Table.configure({ resizable: true }),
					TableRow,
					TableHeader,
					TableCell,
					TaskList,
					TaskItem.configure({ nested: true }),
					ChartNode,
					CalloutNode,
					DetailsNode,
					ActionCardNode,
					EmbedNode
				],
				content: content,
				editorProps: {
					handleDrop: (_view, event, _slice, moved) => {
						if (moved || !event.dataTransfer?.files?.length) return false;
						event.preventDefault();
						uploadAndInsertDirect(event.dataTransfer.files);
						return true;
					},
					handlePaste: (_view, event) => {
						const files = event.clipboardData?.files;
						if (!files?.length) return false;
						event.preventDefault();
						uploadAndInsertDirect(files);
						return true;
					}
				},
				onSelectionUpdate: ({ editor: e }) => {
					const tableActive = e.isActive('table');
					if (tableActive !== isTableActive) isTableActive = tableActive;
					const calloutActive = e.isActive('callout');
					if (calloutActive !== isCalloutActive) isCalloutActive = calloutActive;
				},
				onUpdate: ({ editor: e }) => {
					const html = e.getHTML();
					lastEmittedHtml = html;
					content = html;
					content_json = e.getJSON();
					const tableActive = e.isActive('table');
					if (tableActive !== isTableActive) isTableActive = tableActive;
					const calloutActive = e.isActive('callout');
					if (calloutActive !== isCalloutActive) isCalloutActive = calloutActive;
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
		if (!editor || content === undefined || content === lastEmittedHtml) return;
		if (content !== editor.getHTML()) {
			lastEmittedHtml = content || '';
			editor.commands.setContent(lastEmittedHtml, false);
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

	const insertTable = () => {
		editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
	};

	const toggleTaskList = () => editor?.chain().focus().toggleTaskList().run();

	const insertCallout = (variant = 'info') => {
		if (!editor) return;
		if (editor.isActive('callout')) {
			editor.chain().focus().updateAttributes('callout', { variant }).run();
		} else {
			editor.chain().focus().insertContent(`<div data-tiptap-callout="true" data-variant="${variant}"><p>안내 내용을 입력하세요.</p></div>`).run();
		}
	};

	const insertDetails = () => {
		const title = window.prompt('접기/펼치기 제목을 입력하세요:', '상세 안내 보기');
		if (!title) return;
		editor?.chain().focus().insertContent(`<details data-tiptap-details="true" open="open"><summary>${escapeHtml(title)}</summary><div class="details-content"><p>세부 내용을 입력하세요.</p></div></details>`).run();
	};

	function openNewChartModal() {
		editingChartPos = null;
		chartForm = {
			chartType: 'bar',
			title: '월별 운행 현황',
			labels: '1월, 2월, 3월, 4월',
			datasets: [{ label: '2026년', values: '12, 19, 15, 28', color: '#2563eb' }],
			horizontal: false,
			stacked: false,
			showLegend: true
		};
		activeBlockModal = 'chart';
	}

	function handleEditChartEvent(e) {
		const detail = e?.detail;
		if (!detail) return;
		editingChartPos = typeof detail.pos === 'number' ? detail.pos : null;
		const attrs = detail.attrs || {};
		chartForm = {
			chartType: attrs.chartType || 'bar',
			title: attrs.title || '',
			labels: attrs.labels || '',
			datasets: parseChartDatasets(attrs).map((ds, i) => ({
				label: ds.label || `시리즈 ${i + 1}`,
				values: ds.values || '',
				color: ds.color || '#2563eb'
			})),
			horizontal: Boolean(attrs.horizontal),
			stacked: Boolean(attrs.stacked),
			showLegend: attrs.showLegend !== false
		};
		activeBlockModal = 'chart';
	}

	function submitChartModal() {
		const datasetsJson = JSON.stringify(chartForm.datasets);
		const attrs = {
			chartType: chartForm.chartType,
			title: chartForm.title,
			labels: chartForm.labels,
			values: chartForm.datasets[0]?.values || '',
			datasets: datasetsJson,
			horizontal: chartForm.horizontal,
			stacked: chartForm.stacked,
			showLegend: chartForm.showLegend
		};

		if (editingChartPos !== null && editor) {
			editor
				.chain()
				.focus()
				.command(({ tr }) => {
					tr.setNodeMarkup(editingChartPos, undefined, attrs);
					return true;
				})
				.run();
		} else {
			editor
				?.chain()
				.focus()
				.insertContent({
					type: 'tiptapChart',
					attrs
				})
				.run();
		}
		editingChartPos = null;
		activeBlockModal = null;
	}

	function submitActionModal() {
		if (!actionForm.label.trim() || !actionForm.url.trim()) {
			toast.warning('버튼 문구와 이동 경로를 입력해 주세요.');
			return;
		}
		editor?.chain().focus().insertContent({
			type: 'actionCard',
			attrs: { ...actionForm }
		}).run();
		activeBlockModal = null;
	}

	function submitEmbedModal() {
		if (!embedForm.src.trim()) {
			toast.warning('유튜브 또는 임베드 URL을 입력해 주세요.');
			return;
		}
		editor?.chain().focus().insertContent({
			type: 'embedFrame',
			attrs: { ...embedForm }
		}).run();
		activeBlockModal = null;
	}

	const escapeHtml = (str) =>
		String(str || '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

	async function handleEditorUpload(newAssets) {
		const assets = Array.isArray(newAssets)
			? newAssets
			: Array.isArray(newAssets?.assets)
				? newAssets.assets
				: Array.isArray(newAssets?.data)
					? newAssets.data
					: newAssets
						? [newAssets]
						: [];
		if (assets.length === 0) return;

		const htmlParts = [];
		for (const asset of assets) {
			if (asset?.id) {
				registerPendingPrivateAsset(asset.id);
			}
			const url =
				getSecureMediaUrl(PUBLIC_SERVER_URL, asset) ||
				(asset?.id ? `${PUBLIC_SERVER_URL.replace(/\/+$/, '')}/media/serve/${asset.id}` : '');
			if (!url) continue;

			const name = asset.original_name || asset.meta_info?.original_name || '첨부파일';
			const safeUrl = escapeHtml(url);
			const safeName = escapeHtml(name);
			const isImage = asset.category === 'image' || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(name);
			if (isImage) {
				htmlParts.push(`<p><img src="${safeUrl}" alt="${safeName}" /></p>`);
			} else {
				htmlParts.push(
					`<p>📎 <strong>${safeName}</strong> — <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">미리보기</a> · <a href="${safeUrl}" download="${safeName}">다운로드</a></p>`
				);
			}
		}

		showUploadModal = false;
		await tick();

		if (htmlParts.length === 0) {
			toast.warning('업로드된 파일 URL을 생성하지 못했습니다.');
			return;
		}

		if (!editor) {
			toast.error('에디터 인스턴스가 준비되지 않았습니다.');
			return;
		}

		try {
			const html = htmlParts.join('');
			const inserted = editor.chain().focus().insertContent(html).run();
			if (!inserted) {
				editor.commands.insertContent(html);
			}
			showUploadModal = false;
			toast.success(`${htmlParts.length}개 파일이 본문에 삽입되었습니다. (저장 시 공용 영역으로 배포됩니다)`);
		} catch (err) {
			console.error('[Tiptap] 업로드 파일 본문 삽입 실패:', err);
			toast.error('본문 삽입 중 오류가 발생했습니다.');
		}
	}

	async function uploadAndInsertDirect(fileList) {
		const files = Array.from(fileList || []);
		if (files.length === 0 || isDirectUploading) return;

		isDirectUploading = true;
		try {
			const res = await uploadFiles(files, {
				app_id: 'personal_vault',
				access_level: 'PRIVATE',
				sub_path: userSubPath
			});
			await handleEditorUpload(res);
		} catch (err) {
			console.error('[Tiptap] 자체 파일 업로드 실패:', err);
			toast.error('파일 업로드 실패: ' + formatApiError(err));
		} finally {
			isDirectUploading = false;
			if (quickImageInput) quickImageInput.value = '';
		}
	}
</script>

<div
	bind:this={wrapperEl}
	ontiptap:edit-chart={handleEditChartEvent}
	class="tiptap-editor relative flex min-h-[520px] flex-col rounded-2xl border-2 border-slate-200 bg-white shadow-sm transition focus-within:border-blue-600 selection:bg-blue-100"
>
	{#if editor}
		<div class="sticky top-0 z-20 rounded-t-2xl border-b border-slate-200 bg-slate-50/95 backdrop-blur-sm">
			<div class="toolbar flex flex-wrap items-center gap-1 px-3 py-2">
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
				<button type="button" title="체크리스트 (할 일)" onclick={toggleTaskList} class="tool-btn {editor.isActive('taskList') ? 'active' : ''}"><Icon icon="ph:check-square-bold" /></button>
				<button type="button" title="인용구" onclick={toggleBlockquote} class="tool-btn {editor.isActive('blockquote') ? 'active' : ''}"><Icon icon="ph:quotes-bold" /></button>
				<button type="button" title="코드 블록" onclick={toggleCodeBlock} class="tool-btn {editor.isActive('codeBlock') ? 'active' : ''}"><Icon icon="ph:terminal-window-bold" /></button>
			</div>

			<div class="mx-1 h-5 w-px bg-slate-200"></div>

			<!-- 7. Media & Table -->
			<div class="flex items-center gap-0.5">
				<button type="button" title="링크 삽입" onclick={addLink} class="tool-btn {editor.isActive('link') ? 'active' : ''}"><Icon icon="ph:link-bold" /></button>
				<button type="button" title="이미지 URL 삽입" onclick={addImage} class="tool-btn"><Icon icon="ph:image-square-bold" /></button>
				{#if enableUpload}
					<button
						type="button"
						title="이미지 바로 업로드 (드래그·Ctrl+V 지원)"
						onclick={() => quickImageInput?.click()}
						disabled={isDirectUploading}
						class="tool-btn"
					>
						{#if isDirectUploading}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Icon icon="ph:images-bold" />
							{#if isCalloutActive}
			<div class="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs">
				<span class="mr-1 font-bold text-slate-700">콜아웃 스타일:</span>
				<button type="button" onclick={() => insertCallout('info')} class="table-btn">안내(파랑)</button>
				<button type="button" onclick={() => insertCallout('warning')} class="table-btn">주의(노랑)</button>
				<button type="button" onclick={() => insertCallout('danger')} class="table-btn">위험(빨강)</button>
				<button type="button" onclick={() => insertCallout('success')} class="table-btn">완료(초록)</button>
				<button type="button" onclick={() => editor?.chain().focus().lift('callout').run()} class="table-btn text-rose-600">박스 해제</button>
			</div>
		{/if}
	{/if}
					</button>
					<button
						type="button"
						title="파일 / 이미지 업로더 (모달)"
						onclick={() => (showUploadModal = true)}
						class="tool-btn {showUploadModal ? 'active' : ''}"
					>
						<Icon icon="ph:upload-simple-bold" />
					</button>
					{#if auth.user?.id}
						<button
							type="button"
							title="내 파일함(/USERS)에서 선택"
							onclick={() => (showPersonalPicker = true)}
							class="tool-btn {showPersonalPicker ? 'active' : ''}"
						>
							<Icon icon="ph:folder-user-bold" />
						</button>
					{/if}
					<input
						type="file"
						accept="image/*"
						multiple
						bind:this={quickImageInput}
						onchange={(e) => uploadAndInsertDirect(e.currentTarget.files)}
						class="hidden"
					/>
					{#if isCalloutActive}
			<div class="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs">
				<span class="mr-1 font-bold text-slate-700">콜아웃 스타일:</span>
				<button type="button" onclick={() => insertCallout('info')} class="table-btn">안내(파랑)</button>
				<button type="button" onclick={() => insertCallout('warning')} class="table-btn">주의(노랑)</button>
				<button type="button" onclick={() => insertCallout('danger')} class="table-btn">위험(빨강)</button>
				<button type="button" onclick={() => insertCallout('success')} class="table-btn">완료(초록)</button>
				<button type="button" onclick={() => editor?.chain().focus().lift('callout').run()} class="table-btn text-rose-600">박스 해제</button>
			</div>
		{/if}
	{/if}
				<button type="button" title="표 삽입 (3×3)" onclick={insertTable} class="tool-btn {isTableActive ? 'active' : ''}"><Icon icon="ph:table-bold" /></button>
				<button type="button" title="콜아웃 박스" onclick={() => insertCallout('info')} class="tool-btn {isCalloutActive ? 'active' : ''}"><Icon icon="ph:megaphone-bold" /></button>
				<button type="button" title="접기 / 펼치기" onclick={insertDetails} class="tool-btn"><Icon icon="ph:caret-circle-down-bold" /></button>
				<button type="button" title="바로가기 버튼 카드" onclick={() => (activeBlockModal = 'action')} class="tool-btn"><Icon icon="ph:cursor-click-bold" /></button>
				<button type="button" title="영상 / 지도 임베드" onclick={() => (activeBlockModal = 'embed')} class="tool-btn"><Icon icon="ph:video-bold" /></button>
				<button type="button" title="차트 삽입" onclick={openNewChartModal} class="tool-btn"><Icon icon="ph:chart-bar-bold" /></button>
				<button type="button" title="구분선" onclick={() => editor.chain().focus().setHorizontalRule().run()} class="tool-btn"><Icon icon="ph:minus-bold" /></button>
			</div>

			<!-- 8. History -->
			<div class="ml-auto flex items-center gap-0.5">
				<button type="button" title="실행 취소" onclick={undo} class="tool-btn text-slate-400 hover:text-slate-700"><Icon icon="ph:arrow-counter-clockwise-bold" /></button>
				<button type="button" title="다시 실행" onclick={redo} class="tool-btn text-slate-400 hover:text-slate-700"><Icon icon="ph:arrow-clockwise-bold" /></button>
			</div>
			</div>

			{#if isTableActive}
				<div class="flex flex-wrap items-center gap-1 border-t border-blue-100 bg-blue-50/80 px-3 py-1.5 text-xs">
					<span class="mr-1 inline-flex items-center gap-1 font-bold text-blue-700">
						<Icon icon="ph:table-bold" class="h-3.5 w-3.5" />
						표 편집
					</span>
					<button type="button" onclick={() => editor?.chain().focus().addRowBefore().run()} class="table-btn">위 행 추가</button>
					<button type="button" onclick={() => editor?.chain().focus().addRowAfter().run()} class="table-btn">아래 행 추가</button>
					<button type="button" onclick={() => editor?.chain().focus().deleteRow().run()} class="table-btn">행 삭제</button>
					<div class="mx-1 h-4 w-px bg-blue-200"></div>
					<button type="button" onclick={() => editor?.chain().focus().addColumnBefore().run()} class="table-btn">왼쪽 열 추가</button>
					<button type="button" onclick={() => editor?.chain().focus().addColumnAfter().run()} class="table-btn">오른쪽 열 추가</button>
					<button type="button" onclick={() => editor?.chain().focus().deleteColumn().run()} class="table-btn">열 삭제</button>
					<div class="mx-1 h-4 w-px bg-blue-200"></div>
					<button type="button" onclick={() => editor?.chain().focus().mergeCells().run()} class="table-btn">셀 병합</button>
					<button type="button" onclick={() => editor?.chain().focus().splitCell().run()} class="table-btn">셀 분할</button>
					<button type="button" onclick={() => editor?.chain().focus().toggleHeaderRow().run()} class="table-btn">헤더 행</button>
					<button type="button" onclick={() => editor?.chain().focus().deleteTable().run()} class="table-btn text-rose-600 hover:bg-rose-100 hover:text-rose-700">표 삭제</button>
				</div>
			{/if}

			{#if isCalloutActive}
				<div class="flex flex-wrap items-center gap-1 border-t border-slate-200 bg-slate-100/90 px-3 py-1.5 text-xs">
					<span class="mr-1 font-bold text-slate-700">콜아웃 스타일:</span>
					<button type="button" onclick={() => insertCallout('info')} class="table-btn">안내(파랑)</button>
					<button type="button" onclick={() => insertCallout('warning')} class="table-btn">주의(노랑)</button>
					<button type="button" onclick={() => insertCallout('danger')} class="table-btn">위험(빨강)</button>
					<button type="button" onclick={() => insertCallout('success')} class="table-btn">완료(초록)</button>
					<button type="button" onclick={() => editor?.chain().focus().lift('callout').run()} class="table-btn text-rose-600">박스 해제</button>
				</div>
			{/if}
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
		{#if isCalloutActive}
			<div class="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-100/80 px-3 py-1.5 text-xs">
				<span class="mr-1 font-bold text-slate-700">콜아웃 스타일:</span>
				<button type="button" onclick={() => insertCallout('info')} class="table-btn">안내(파랑)</button>
				<button type="button" onclick={() => insertCallout('warning')} class="table-btn">주의(노랑)</button>
				<button type="button" onclick={() => insertCallout('danger')} class="table-btn">위험(빨강)</button>
				<button type="button" onclick={() => insertCallout('success')} class="table-btn">완료(초록)</button>
				<button type="button" onclick={() => editor?.chain().focus().lift('callout').run()} class="table-btn text-rose-600">박스 해제</button>
			</div>
		{/if}
	{/if}
</div>

<PersonalMediaPickerModal
	bind:open={showPersonalPicker}
	multiple={true}
	onSelect={handleEditorUpload}
/>

{#if showUploadModal}
	<div
		use:portal
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		aria-label="파일 및 이미지 업로드"
	>
		<div class="w-full max-w-lg rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
			<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
				<div>
					<h3 class="text-base font-black text-slate-900">파일 · 이미지 업로드</h3>
					<p class="text-xs text-slate-500">
						PC 업로드 또는 내 파일함(/USERS)에서 선택할 수 있으며, 글 저장 시 {slug ? `PAGES/${slug}` : '공용 영역'}으로 자동 배포됩니다.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (showUploadModal = false)}
					class="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="닫기"
				>
					<Icon icon="ph:x-bold" class="h-4 w-4" />
				</button>
			</div>

			<ImageUploader
				app_id="personal_vault"
				access_level="PRIVATE"
				sub_path={userSubPath}
				onUpload={handleEditorUpload}
			/>
		</div>
	</div>
{/if}

{#if activeBlockModal}
	<div
		use:portal
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-md rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-2xl">
			<div class="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
				<h3 class="text-base font-black text-slate-900">
					{#if activeBlockModal === 'chart'}차트 삽입
					{:else if activeBlockModal === 'action'}바로가기 버튼 카드 삽입
					{:else}영상 · 지도 임베드{/if}
				</h3>
				<button
					type="button"
					onclick={() => (activeBlockModal = null)}
					class="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="닫기"
				>
					<Icon icon="ph:x-bold" class="h-4 w-4" />
				</button>
			</div>

			{#if activeBlockModal === 'chart'}
				<div class="space-y-3">
					<div class="grid grid-cols-2 gap-2">
						<div>
							<label class="mb-1 block text-xs font-bold text-slate-700">차트 종류</label>
							<select bind:value={chartForm.chartType} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold">
								<option value="bar">막대 차트 (Bar)</option>
								<option value="line">선형 차트 (Line)</option>
								<option value="pie">원형 차트 (Pie)</option>
								<option value="doughnut">도넛 차트 (Doughnut)</option>
							</select>
						</div>
						<div>
							<label class="mb-1 block text-xs font-bold text-slate-700">제목</label>
							<input type="text" bind:value={chartForm.title} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold" />
						</div>
					</div>
					<div>
						<label class="mb-1 block text-xs font-bold text-slate-700">항목 라벨 (쉼표 구분)</label>
						<input type="text" bind:value={chartForm.labels} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold" placeholder="1월, 2월, 3월, 4월" />
					</div>

					<div class="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
						<div class="flex items-center justify-between">
							<span class="text-xs font-black text-slate-700">데이터 시리즈 ({chartForm.datasets.length})</span>
							<button
								type="button"
								onclick={() => {
									const palette = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
									const idx = chartForm.datasets.length;
									chartForm.datasets = [
										...chartForm.datasets,
										{ label: `시리즈 ${idx + 1}`, values: '10, 20, 15, 30', color: palette[idx % palette.length] }
									];
								}}
								class="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-600"
							>
								+ 시리즈 추가
							</button>
						</div>
						{#each chartForm.datasets as ds, i}
							<div class="flex items-center gap-1.5">
								<input type="color" bind:value={ds.color} class="h-8 w-8 shrink-0 cursor-pointer rounded border border-slate-200 bg-white p-0.5" title="시리즈 색상" />
								<input type="text" bind:value={ds.label} placeholder="시리즈명" class="w-24 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold" />
								<input type="text" bind:value={ds.values} placeholder="10, 20, 30" class="flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono font-bold" />
								{#if chartForm.datasets.length > 1}
									<button
										type="button"
										onclick={() => (chartForm.datasets = chartForm.datasets.filter((_, idx) => idx !== i))}
										class="px-1.5 text-xs font-bold text-rose-500 hover:text-rose-700"
										title="시리즈 삭제"
									>
										✕
									</button>
								{/if}
							</div>
						{/each}
					</div>

					<div class="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-600">
						<label class="flex items-center gap-1.5 cursor-pointer">
							<input type="checkbox" bind:checked={chartForm.showLegend} class="checkbox checkbox-xs checkbox-primary" />
							<span>범례 표시</span>
						</label>
						{#if chartForm.chartType === 'bar' || chartForm.chartType === 'line'}
							<label class="flex items-center gap-1.5 cursor-pointer">
								<input type="checkbox" bind:checked={chartForm.stacked} class="checkbox checkbox-xs checkbox-primary" />
								<span>누적(Stacked)</span>
							</label>
						{/if}
						{#if chartForm.chartType === 'bar'}
							<label class="flex items-center gap-1.5 cursor-pointer">
								<input type="checkbox" bind:checked={chartForm.horizontal} class="checkbox checkbox-xs checkbox-primary" />
								<span>가로 막대</span>
							</label>
						{/if}
					</div>

					<div class="flex justify-end gap-2 pt-2">
						<button type="button" onclick={() => { editingChartPos = null; activeBlockModal = null; }} class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">취소</button>
						<button type="button" onclick={submitChartModal} class="rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white hover:bg-blue-700">
							{editingChartPos !== null ? '차트 수정 반영' : '차트 넣기'}
						</button>
					</div>
				</div>
			{:else if activeBlockModal === 'action'}
				<div class="space-y-3">
					<div>
						<label class="mb-1 block text-xs font-bold text-slate-700">버튼 문구</label>
						<input type="text" bind:value={actionForm.label} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold" />
					</div>
					<div>
						<label class="mb-1 block text-xs font-bold text-slate-700">이동 URL</label>
						<input type="text" bind:value={actionForm.url} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-mono font-bold" placeholder="/v1/custom/dayoff 또는 https://..." />
					</div>
					<div>
						<label class="mb-1 block text-xs font-bold text-slate-700">보조 설명 (선택)</label>
						<input type="text" bind:value={actionForm.description} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold" />
					</div>
					<div>
						<label class="mb-1 block text-xs font-bold text-slate-700">스타일</label>
						<select bind:value={actionForm.style} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold">
							<option value="primary">파란 강조 (Primary)</option>
							<option value="dark">다크 (Dark)</option>
							<option value="outline">테두리 (Outline)</option>
						</select>
					</div>
					<div class="flex justify-end gap-2 pt-2">
						<button type="button" onclick={() => (activeBlockModal = null)} class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">취소</button>
						<button type="button" onclick={submitActionModal} class="rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white hover:bg-blue-700">버튼 넣기</button>
					</div>
				</div>
			{:else if activeBlockModal === 'embed'}
				<div class="space-y-3">
					<div>
						<label class="mb-1 block text-xs font-bold text-slate-700">유튜브 또는 임베드 URL</label>
						<input type="text" bind:value={embedForm.src} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-mono font-bold" placeholder="https://www.youtube.com/watch?v=..." />
					</div>
					<div>
						<label class="mb-1 block text-xs font-bold text-slate-700">제목 (접근성 라벨)</label>
						<input type="text" bind:value={embedForm.title} class="w-full rounded-xl border-2 border-slate-200 px-3 py-2 text-xs font-bold" />
					</div>
					<div class="flex justify-end gap-2 pt-2">
						<button type="button" onclick={() => (activeBlockModal = null)} class="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600">취소</button>
						<button type="button" onclick={submitEmbedModal} class="rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white hover:bg-blue-700">임베드 넣기</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

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
	.table-btn {
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		font-size: 0.75rem;
		font-weight: 600;
		color: #1e40af;
		background: rgba(255, 255, 255, 0.75);
		border: 1px solid #bfdbfe;
		cursor: pointer;
		transition: background-color 0.15s ease, color 0.15s ease;
	}
	.table-btn:hover {
		background-color: #dbeafe;
		color: #1e3a8a;
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
	:global(.ProseMirror table) {
		border-collapse: collapse;
		table-layout: fixed;
		width: 100%;
		margin: 1rem 0;
		overflow: hidden;
	}
	:global(.ProseMirror td, .ProseMirror th) {
		border: 1px solid #cbd5e1;
		padding: 0.5rem 0.75rem;
		min-width: 60px;
		vertical-align: top;
		position: relative;
		box-sizing: border-box;
	}
	:global(.ProseMirror th) {
		background-color: #f8fafc;
		font-weight: 700;
		color: #0f172a;
		text-align: left;
	}
	:global(.ProseMirror .selectedCell::after) {
		content: '';
		position: absolute;
		inset: 0;
		background: rgba(59, 130, 246, 0.12);
		pointer-events: none;
		z-index: 2;
	}
	:global(.ProseMirror .column-resize-handle) {
		position: absolute;
		right: -2px;
		top: 0;
		bottom: -2px;
		width: 4px;
		background-color: #3b82f6;
		pointer-events: none;
	}
	:global(.ProseMirror .tableWrapper) {
		overflow-x: auto;
		margin: 1rem 0;
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
