import { Node, mergeAttributes } from '@tiptap/core';
import { mount, unmount } from 'svelte';
import Chart from '$lib/components/Chart.svelte';

const CHART_COLORS = [
	'rgba(37, 99, 235, 0.85)',
	'rgba(16, 185, 129, 0.85)',
	'rgba(245, 158, 11, 0.85)',
	'rgba(239, 68, 68, 0.85)',
	'rgba(139, 92, 246, 0.85)',
	'rgba(236, 72, 153, 0.85)',
	'rgba(20, 184, 166, 0.85)'
];

const CHART_BORDERS = [
	'rgb(37, 99, 235)',
	'rgb(16, 185, 129)',
	'rgb(245, 158, 11)',
	'rgb(239, 68, 68)',
	'rgb(139, 92, 246)',
	'rgb(236, 72, 153)',
	'rgb(20, 184, 166)'
];

export type ChartKind = 'bar' | 'line' | 'pie' | 'doughnut';

export interface ChartDatasetInput {
	label: string;
	values: string;
	color?: string;
}

export interface ChartNodeConfig {
	chartType?: string;
	title?: string;
	labels?: string;
	values?: string;
	datasets?: string;
	horizontal?: boolean | string;
	stacked?: boolean | string;
	showLegend?: boolean | string;
}

function hexToRgba(hex: string, alpha: number): string {
	const cleaned = hex.replace('#', '');
	if (cleaned.length !== 6) return `rgba(37, 99, 235, ${alpha})`;
	const r = parseInt(cleaned.slice(0, 2), 16);
	const g = parseInt(cleaned.slice(2, 4), 16);
	const b = parseInt(cleaned.slice(4, 6), 16);
	return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function parseChartDatasets(cfg: ChartNodeConfig): ChartDatasetInput[] {
	if (cfg.datasets) {
		try {
			const parsed = JSON.parse(cfg.datasets);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
		} catch {
			// fallback to single values
		}
	}
	return [
		{
			label: cfg.title || '수치',
			values: cfg.values || '10, 25, 18, 32',
			color: '#2563eb'
		}
	];
}

/**
 * ChartNode 및 SafeHtml 공용 Chart.js Props 빌더 (단일/다중 시리즈, 가로/누적 막대 지원)
 */
export function buildChartProps(cfg: ChartNodeConfig) {
	const type = (['bar', 'line', 'pie', 'doughnut'].includes(cfg.chartType || '')
		? cfg.chartType
		: 'bar') as ChartKind;

	const labels = String(cfg.labels || '1월, 2월, 3월, 4월')
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);

	const rawDatasets = parseChartDatasets(cfg);
	const isCircular = type === 'pie' || type === 'doughnut';
	const isHorizontal = cfg.horizontal === true || cfg.horizontal === 'true';
	const isStacked = cfg.stacked === true || cfg.stacked === 'true';
	const showLegend = cfg.showLegend === undefined ? true : cfg.showLegend === true || cfg.showLegend === 'true';

	const datasets = rawDatasets.map((ds, idx) => {
		const data = String(ds.values || '')
			.split(',')
			.map((s) => Number(s.trim()))
			.map((n) => (Number.isFinite(n) ? n : 0));

		const baseColor = ds.color || CHART_BORDERS[idx % CHART_BORDERS.length];
		const bg = isCircular
			? labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length])
			: type === 'line'
				? hexToRgba(baseColor, 0.16)
				: hexToRgba(baseColor, 0.85);
		const border = isCircular
			? labels.map((_, i) => CHART_BORDERS[i % CHART_BORDERS.length])
			: baseColor;

		return {
			label: ds.label || `항목 ${idx + 1}`,
			data,
			backgroundColor: bg,
			borderColor: border,
			borderWidth: 2,
			borderRadius: type === 'bar' ? 6 : 0,
			tension: 0.3,
			fill: type === 'line'
		};
	});

	const scales = isCircular
		? undefined
		: {
				x: { stacked: isStacked },
				y: { stacked: isStacked, beginAtZero: true }
			};

	return {
		type,
		ariaLabel: cfg.title || '데이터 차트',
		data: { labels, datasets },
		options: {
			responsive: true,
			maintainAspectRatio: false,
			indexAxis: (!isCircular && isHorizontal ? 'y' : 'x') as 'x' | 'y',
			scales,
			plugins: {
				legend: { display: showLegend },
				title: {
					display: Boolean(cfg.title),
					text: cfg.title || '',
					font: { size: 15, weight: 'bold' as const }
				}
			}
		}
	};
}

/**
 * 1. 📊 차트 커스텀 노드 (Chart.js · 다중 시리즈 및 에디터 내 수정 지원)
 */
export const ChartNode = Node.create({
	name: 'tiptapChart',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			chartType: { default: 'bar' },
			title: { default: '월별 현황' },
			labels: { default: '1월, 2월, 3월, 4월' },
			values: { default: '10, 25, 18, 32' },
			datasets: { default: '' },
			horizontal: { default: false },
			stacked: { default: false },
			showLegend: { default: true }
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-tiptap-chart]',
				getAttrs: (el) => {
					const dom = el as HTMLElement;
					return {
						chartType: dom.getAttribute('data-chart-type') || 'bar',
						title: dom.getAttribute('data-title') || '',
						labels: dom.getAttribute('data-labels') || '',
						values: dom.getAttribute('data-values') || '',
						datasets: dom.getAttribute('data-datasets') || '',
						horizontal: dom.getAttribute('data-horizontal') === 'true',
						stacked: dom.getAttribute('data-stacked') === 'true',
						showLegend: dom.getAttribute('data-show-legend') !== 'false'
					};
				}
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-tiptap-chart': 'true',
				'data-chart-type': HTMLAttributes.chartType || 'bar',
				'data-title': HTMLAttributes.title || '',
				'data-labels': HTMLAttributes.labels || '',
				'data-values': HTMLAttributes.values || '',
				'data-datasets': HTMLAttributes.datasets || '',
				'data-horizontal': String(Boolean(HTMLAttributes.horizontal)),
				'data-stacked': String(Boolean(HTMLAttributes.stacked)),
				'data-show-legend': String(HTMLAttributes.showLegend !== false)
			})
		];
	},

	addNodeView() {
		return ({ node, getPos, editor }) => {
			let currentNode = node;
			const wrapper = document.createElement('div');
			wrapper.className = 'tiptap-chart-node';
			wrapper.contentEditable = 'false';

			const bar = document.createElement('div');
			bar.className = 'flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100';

			const labelEl = document.createElement('span');
			labelEl.className = 'text-xs font-bold text-slate-500';
			labelEl.textContent = `📊 ${currentNode.attrs.title || '차트'}`;

			const actions = document.createElement('div');
			actions.className = 'flex items-center gap-1';

			const editBtn = document.createElement('button');
			editBtn.type = 'button';
			editBtn.className =
				'rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 cursor-pointer';
			editBtn.textContent = '차트 수정';
			editBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const pos = typeof getPos === 'function' ? getPos() : null;
				wrapper.dispatchEvent(
					new CustomEvent('tiptap:edit-chart', {
						bubbles: true,
						detail: { pos, attrs: { ...currentNode.attrs } }
					})
				);
			});

			const delBtn = document.createElement('button');
			delBtn.type = 'button';
			delBtn.className =
				'rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-100 cursor-pointer';
			delBtn.textContent = '삭제';
			delBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				const pos = typeof getPos === 'function' ? getPos() : null;
				if (typeof pos === 'number') {
					editor
						.chain()
						.focus()
						.deleteRange({ from: pos, to: pos + currentNode.nodeSize })
						.run();
				}
			});

			actions.appendChild(editBtn);
			actions.appendChild(delBtn);
			bar.appendChild(labelEl);
			bar.appendChild(actions);
			wrapper.appendChild(bar);

			const canvasBox = document.createElement('div');
			canvasBox.className = 'tiptap-chart-canvas';
			wrapper.appendChild(canvasBox);

			let instance = mount(Chart, {
				target: canvasBox,
				props: buildChartProps(currentNode.attrs)
			});

			return {
				dom: wrapper,
				update(updatedNode) {
					if (updatedNode.type.name !== 'tiptapChart') return false;
					currentNode = updatedNode;
					labelEl.textContent = `📊 ${currentNode.attrs.title || '차트'}`;
					unmount(instance);
					instance = mount(Chart, {
						target: canvasBox,
						props: buildChartProps(currentNode.attrs)
					});
					return true;
				},
				destroy() {
					unmount(instance);
				}
			};
		};
	}
});

/**
 * 2. 📢 콜아웃 박스 (중요 / 주의 / 위험 / 완료)
 */
export const CalloutNode = Node.create({
	name: 'callout',
	group: 'block',
	content: 'block+',
	defining: true,

	addAttributes() {
		return {
			variant: {
				default: 'info',
				parseHTML: (el) => (el as HTMLElement).getAttribute('data-variant') || 'info',
				renderHTML: (attrs) => ({ 'data-variant': attrs.variant || 'info' })
			}
		};
	},

	parseHTML() {
		return [{ tag: 'div[data-tiptap-callout]' }];
	},

	renderHTML({ HTMLAttributes }) {
		return [
			'div',
			mergeAttributes(HTMLAttributes, {
				'data-tiptap-callout': 'true',
				class: `tiptap-callout tiptap-callout-${HTMLAttributes['data-variant'] || 'info'}`
			}),
			0
		];
	}
});

/**
 * 3. 📂 접기/펼치기 아코디언 (네이티브 <details>)
 */
export const DetailsNode = Node.create({
	name: 'detailsBox',
	group: 'block',
	content: 'block+',
	defining: true,

	addAttributes() {
		return {
			title: {
				default: '상세 내용 보기 (클릭)'
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'details[data-tiptap-details]',
				getAttrs: (el) => {
					const summary = (el as HTMLElement).querySelector('summary');
					return {
						title: summary?.textContent?.trim() || '상세 내용 보기'
					};
				},
				contentElement: (el) =>
					((el as HTMLElement).querySelector('.details-content') as HTMLElement) || (el as HTMLElement)
			}
		];
	},

	renderHTML({ node, HTMLAttributes }) {
		return [
			'details',
			mergeAttributes(HTMLAttributes, {
				'data-tiptap-details': 'true',
				open: 'open',
				class: 'tiptap-details'
			}),
			['summary', { class: 'tiptap-details-summary' }, node.attrs.title || '상세 내용 보기'],
			['div', { class: 'details-content' }, 0]
		];
	}
});

/**
 * 4. 🔗 바로가기 버튼 카드 (ActionCard)
 */
export const ActionCardNode = Node.create({
	name: 'actionCard',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			label: { default: '바로가기' },
			url: { default: '/v1' },
			description: { default: '' },
			style: { default: 'primary' }
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-tiptap-action]',
				getAttrs: (el) => {
					const dom = el as HTMLElement;
					const link = dom.querySelector('a');
					return {
						label: dom.getAttribute('data-label') || link?.textContent?.trim() || '바로가기',
						url: dom.getAttribute('data-url') || link?.getAttribute('href') || '/v1',
						description: dom.getAttribute('data-description') || '',
						style: dom.getAttribute('data-style') || 'primary'
					};
				}
			}
		];
	},

	renderHTML({ node }) {
		const style = node.attrs.style || 'primary';
		const label = node.attrs.label || '바로가기';
		const url = node.attrs.url || '/v1';
		const description = node.attrs.description || '';
		const isExternal = /^https?:\/\//i.test(url);

		const children: any[] = [
			[
				'a',
				{
					href: url,
					target: isExternal ? '_blank' : undefined,
					rel: isExternal ? 'noopener noreferrer' : undefined,
					class: `tiptap-action-btn tiptap-action-${style}`
				},
				`${label} →`
			]
		];
		if (description) {
			children.unshift(['span', { class: 'tiptap-action-desc' }, description]);
		}

		return [
			'div',
			{
				'data-tiptap-action': 'true',
				'data-label': label,
				'data-url': url,
				'data-description': description,
				'data-style': style,
				class: 'tiptap-action-card'
			},
			...children
		];
	}
});

/**
 * 유튜브/외부 URL을 안전한 Embed URL로 정규화
 */
export function normalizeEmbedUrl(rawUrl: string): string {
	const trimmed = String(rawUrl || '').trim();
	if (!trimmed) return '';
	try {
		const u = new URL(trimmed);
		if (u.hostname.includes('youtu.be')) {
			const id = u.pathname.replace('/', '');
			return id ? `https://www.youtube.com/embed/${id}` : trimmed;
		}
		if (u.hostname.includes('youtube.com')) {
			if (u.pathname.startsWith('/shorts/')) {
				const id = u.pathname.split('/shorts/')[1]?.split('/')[0];
				return id ? `https://www.youtube.com/embed/${id}` : trimmed;
			}
			const v = u.searchParams.get('v');
			if (v) return `https://www.youtube.com/embed/${v}`;
		}
		return trimmed;
	} catch {
		return trimmed;
	}
}

/**
 * 5. 🎬 영상 / 지도 임베드 (Iframe)
 */
export const EmbedNode = Node.create({
	name: 'embedFrame',
	group: 'block',
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			src: { default: '' },
			title: { default: '임베드 콘텐츠' }
		};
	},

	parseHTML() {
		return [
			{
				tag: 'div[data-tiptap-embed]',
				getAttrs: (el) => {
					const dom = el as HTMLElement;
					const iframe = dom.querySelector('iframe');
					return {
						src: dom.getAttribute('data-src') || iframe?.getAttribute('src') || '',
						title: dom.getAttribute('data-title') || iframe?.getAttribute('title') || '임베드 콘텐츠'
					};
				}
			}
		];
	},

	renderHTML({ node }) {
		const src = normalizeEmbedUrl(node.attrs.src || '');
		const title = node.attrs.title || '임베드 콘텐츠';
		return [
			'div',
			{
				'data-tiptap-embed': 'true',
				'data-src': src,
				'data-title': title,
				class: 'tiptap-embed-wrap'
			},
			[
				'iframe',
				{
					src,
					title,
					frameborder: '0',
					allowfullscreen: 'true',
					loading: 'lazy',
					class: 'tiptap-embed-iframe'
				}
			]
		];
	}
});
