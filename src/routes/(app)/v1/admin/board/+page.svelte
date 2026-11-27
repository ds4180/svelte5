<script>
	/**
	 * @file (app)/v1/admin/board/+page.svelte
	 * @description 게시판 인스턴스(공지, 자유, 갤러리 등) 통합 관리자
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 4대 핵심 관제 지표 요약 카드
	 *              - 반응형 카드 기반 본문 레이아웃 (모바일 세로/태블릿/데스크탑 최적화)
	 *              - 브라우저 탭 단일 진실 공급원(SSOT) 환경설정 타이틀 연동
	 *              - 탭 기반 네비게이션 (명부 조회 / 새 인스턴스 생성 및 설정)
	 */
	import { onDestroy, onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import { navState } from '$lib/runes/nav.svelte';
	import { buildOptionMenuItems } from '$lib/utils/dynamicOptions';
	import {
		ALL_POST_META_KEYS,
		DEFAULT_POST_CATEGORIES,
		POST_META_CATALOG
	} from '../../app/board/layouts/boardUtils';
	import { getSiteTitle } from '$lib/config/site';
	import { RANK_LEVELS } from '$lib/config/rank';
	import {
		SERVICE_READ_POLICY_OPTIONS,
		SERVICE_WRITE_POLICY_OPTIONS
	} from '$lib/utils/servicePermission';
	import {
		updateBoardServicePermissionOption,
		groupServiceAppsByRegistry
	} from '$lib/services/serviceAdminHelper';
	import PushOptionSection from '$lib/components/PushOptionSection.svelte';
	import Icon from '@iconify/svelte';

	let boards = $state(/** @type {any[]} */ ([]));
	let serviceInstances = $state(/** @type {any[]} */ ([]));
	let serviceApps = $state(/** @type {any[]} */ ([]));
	let serviceEngines = $state(/** @type {any[]} */ ([]));
	let serviceRegistries = $state(/** @type {any[]} */ ([]));
	let serviceSearchQuery = $state('');
	let loading = $state(true);
	let activeTab = $state('list'); // 'list' | 'create'
	let filterLayout = $state('ALL'); // 'ALL' | 'list' | 'gallery' | 'blog'
	let fieldsJsonMode = $state(false);
	let fieldsJsonText = $state('[]');
	const DEFAULT_BOARD_OPTIONS = {
		use_list: true,
		use_view: true,
		use_pin: {
			label: '상단 고정 사용',
			type: 'toggle',
			description: '공지글 상단 고정 기능 활성화',
			value: true
		},
		new_hours: 24,
		categories: [...DEFAULT_POST_CATEGORIES],
		admin_groups: /** @type {string[]} */ ([]),
		view_meta_keys: [...ALL_POST_META_KEYS],
		write_meta_keys: [...ALL_POST_META_KEYS]
	};

	let optionsJsonMode = $state(false);
	let optionsJsonText = $state(JSON.stringify(DEFAULT_BOARD_OPTIONS, null, 2));

	let editingBoard = $state({
		id: /** @type {number|null} */ (null),
		slug: '',
		name: '',
		description: '',
		layout_type: 'list',
		items_per_page: 10,
		min_read_rank: 0,
		min_write_rank: 2,
		service_instance_id: /** @type {number|null} */ (null),
		service_app_ids: /** @type {number[]} */ ([]),
		fields_def: /** @type {any[]} */ ([]),
		options: /** @type {Record<string, any>} */ (structuredClone(DEFAULT_BOARD_OPTIONS)),
		is_active: true
	});

	// 📊 4대 관제 지표 요약 (반응형 파생 상태)
	const countTotal = $derived(boards.length);
	const countList = $derived(
		boards.filter((b) => !b.layout_type || b.layout_type === 'list').length
	);
	const countGallery = $derived(boards.filter((b) => b.layout_type === 'gallery').length);
	const countBlog = $derived(boards.filter((b) => b.layout_type === 'blog').length);

	// 필터링된 게시판 목록
	const filteredBoards = $derived(
		filterLayout === 'ALL'
			? boards
			: boards.filter((b) => (b.layout_type || 'list') === filterLayout)
	);

	// 📌 생성/수정 탭에서 게시판 세부 옵션(options JSON)을 우측 다이나믹 폼 상단에 실시간 동기화
	$effect(() => {
		if (activeTab !== 'create') {
			navState.clearPageMenus();
			return;
		}
		try {
			const parsed = JSON.parse(optionsJsonText || '{}');
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				const items = buildOptionMenuItems(parsed, (key, nextVal) => {
					const updated = { ...parsed, [key]: nextVal };
					editingBoard.options = updated;
					optionsJsonText = JSON.stringify(updated, null, 2);
				});
				navState.setPageMenus(items);
			} else {
				navState.clearPageMenus();
			}
		} catch {
			// JSON 편집 중 문법 오류 시 기존 메뉴 유지
		}
	});

	onDestroy(() => {
		navState.clearPageMenus();
	});

	async function loadBoards() {
		loading = true;
		try {
			const [boardList, instanceList, appList, engineList, regList] = await Promise.all([
				api.adminGetBoards(),
				api.adminGetServiceInstances({ silent: true }).catch(() => []),
				api.adminGetServiceApps({ silent: true }).catch(() => []),
				api.adminGetServiceEngines({ silent: true }).catch(() => []),
				api.adminGetServiceRegistries({ silent: true }).catch(() => [])
			]);
			boards = boardList;
			serviceInstances = Array.isArray(instanceList) ? instanceList : [];
			serviceApps = Array.isArray(appList) ? appList : [];
			serviceEngines = Array.isArray(engineList) ? engineList : [];
			serviceRegistries = Array.isArray(regList) ? regList : [];
		} catch (/** @type {any} */ e) {
			toast.error('게시판 목록 로드 실패: ' + (e.message || '오류가 발생했습니다.'));
		} finally {
			loading = false;
		}
	}

	onMount(loadBoards);

	function resetForm() {
		fieldsJsonMode = false;
		optionsJsonMode = false;
		serviceSearchQuery = '';
		fieldsJsonText = '[]';
		optionsJsonText = JSON.stringify(DEFAULT_BOARD_OPTIONS, null, 2);
		editingBoard = {
			id: null,
			slug: '',
			name: '',
			description: '',
			layout_type: 'list',
			items_per_page: 10,
			min_read_rank: 0,
			min_write_rank: 2,
			service_instance_id: null,
			service_app_ids: [],
			fields_def: [],
			options: structuredClone(DEFAULT_BOARD_OPTIONS),
			is_active: true
		};
	}

	function startCreate() {
		resetForm();
		activeTab = 'create';
	}

	/**
	 * @param {any} b
	 */
	function startEdit(b) {
		const nextFields = Array.isArray(b.fields_def) ? b.fields_def : [];
		const nextOptions =
			b.options && typeof b.options === 'object' ? b.options : { use_list: true, use_view: true };
		fieldsJsonMode = false;
		optionsJsonMode = false;
		serviceSearchQuery = '';
		fieldsJsonText = JSON.stringify(nextFields, null, 2);
		optionsJsonText = JSON.stringify(nextOptions, null, 2);
		editingBoard = {
			...b,
			layout_type: b.layout_type || 'list',
			min_read_rank: Number(b.min_read_rank ?? 0),
			min_write_rank: Number(b.min_write_rank ?? 2),
			service_instance_id: b.service_instance_id ?? null,
			service_app_ids: Array.isArray(b.service_app_ids) ? [...b.service_app_ids] : [],
			fields_def: nextFields,
			options: nextOptions,
			is_active: b.is_active ?? true
		};
		activeTab = 'create';
	}

	/** @param {number} appId */
	function toggleBoardServiceApp(appId) {
		const current = editingBoard.service_app_ids || [];
		if (current.includes(appId)) {
			editingBoard.service_app_ids = current.filter((id) => id !== appId);
		} else {
			editingBoard.service_app_ids = [...current, appId];
		}
	}

	/**
	 * @param {number} idx
	 * @param {number} delta
	 */
	function moveBoardServiceApp(idx, delta) {
		const list = [...(editingBoard.service_app_ids || [])];
		const nextIdx = idx + delta;
		if (nextIdx < 0 || nextIdx >= list.length) return;
		[list[idx], list[nextIdx]] = [list[nextIdx], list[idx]];
		editingBoard.service_app_ids = list;
	}

	/** @param {number | null} bundleId */
	function applyBundlePreset(bundleId) {
		if (!bundleId) return;
		const bundle = serviceInstances.find((i) => Number(i.id) === Number(bundleId));
		if (!bundle) return;
		editingBoard.service_app_ids = [...(bundle.service_app_ids || [])];
		toast.info(`'${bundle.name}' 번들 구성을 프리셋으로 불러왔습니다. 필요에 맞게 조정하세요.`);
	}

	function getGroupedServiceApps() {
		return groupServiceAppsByRegistry(
			serviceApps,
			serviceEngines,
			serviceRegistries,
			serviceSearchQuery
		);
	}

	function addCustomField() {
		const next = [
			...(editingBoard.fields_def || []),
			{
				key: `field_${(editingBoard.fields_def?.length || 0) + 1}`,
				label: '새 항목',
				type: 'text',
				placeholder: '',
				options_text: ''
			}
		];
		editingBoard.fields_def = next;
		fieldsJsonText = JSON.stringify(next, null, 2);
	}

	/**
	 * @param {number} idx
	 */
	function removeCustomField(idx) {
		const next = (editingBoard.fields_def || []).filter((_, i) => i !== idx);
		editingBoard.fields_def = next;
		fieldsJsonText = JSON.stringify(next, null, 2);
	}

	function toggleFieldsJsonMode() {
		if (!fieldsJsonMode) {
			fieldsJsonText = JSON.stringify(editingBoard.fields_def || [], null, 2);
			fieldsJsonMode = true;
		} else {
			try {
				const parsed = JSON.parse(fieldsJsonText || '[]');
				if (!Array.isArray(parsed)) throw new Error('배열 형식이어야 합니다.');
				editingBoard.fields_def = parsed;
				fieldsJsonMode = false;
			} catch (/** @type {any} */ err) {
				toast.error(
					'동적 필드 JSON 형식 오류: ' + (err.message || '올바른 JSON 배열을 입력하세요.')
				);
			}
		}
	}

	function isMetaKeyEnabled(
		/** @type {'write_meta_keys'|'view_meta_keys'} */ modeKey,
		/** @type {string} */ metaKey
	) {
		const list = editingBoard.options?.[modeKey];
		if (!Array.isArray(list)) return true;
		return list.includes(metaKey);
	}

	function toggleMetaKey(
		/** @type {'write_meta_keys'|'view_meta_keys'} */ modeKey,
		/** @type {string} */ metaKey
	) {
		const opts = { ...(editingBoard.options || {}) };
		const current = Array.isArray(opts[modeKey]) ? [...opts[modeKey]] : [...ALL_POST_META_KEYS];
		const exists = current.includes(metaKey);
		const next = exists ? current.filter((k) => k !== metaKey) : [...current, metaKey];
		const ordered = ALL_POST_META_KEYS.filter((k) => next.includes(k));
		opts[modeKey] = ordered;
		editingBoard.options = opts;
		optionsJsonText = JSON.stringify(opts, null, 2);
	}

	function setAllMetaKeys(
		/** @type {'write_meta_keys'|'view_meta_keys'} */ modeKey,
		/** @type {boolean} */ enabled
	) {
		const opts = { ...(editingBoard.options || {}) };
		opts[modeKey] = enabled ? [...ALL_POST_META_KEYS] : [];
		editingBoard.options = opts;
		optionsJsonText = JSON.stringify(opts, null, 2);
	}

	/**
	 * 게시판 인스턴스별 서비스앱 권한 예외 설정 (options.service_permissions) 헬퍼
	 * @param {string} serviceId
	 * @param {'read_policy' | 'write_policy'} field
	 * @param {string} value
	 */
	function setBoardServicePermission(serviceId, field, value) {
		const opts = updateBoardServicePermissionOption(editingBoard.options, serviceId, field, value);
		editingBoard.options = opts;
		optionsJsonText = JSON.stringify(opts, null, 2);
	}

	function getOptionEntries() {
		const opts =
			editingBoard.options && typeof editingBoard.options === 'object' ? editingBoard.options : {};
		return Object.entries(opts)
			.filter(
				([key]) =>
					key !== 'view_meta_keys' &&
					key !== 'write_meta_keys' &&
					key !== 'admin_groups' &&
					key !== 'categories' &&
					key !== 'service_permissions'
			)
			.map(([key, raw]) => {
				const isObj =
					raw !== null &&
					typeof raw === 'object' &&
					!Array.isArray(raw) &&
					('value' in raw || 'type' in raw);
				if (isObj) {
					const inferredType =
						raw.type ||
						(typeof raw.value === 'boolean'
							? 'toggle'
							: typeof raw.value === 'number'
								? 'slider'
								: 'text');
					return {
						key,
						label: String(raw.label ?? raw.title ?? ''),
						type: inferredType,
						value:
							raw.value ?? (inferredType === 'toggle' ? false : inferredType === 'slider' ? 0 : ''),
						dynamic_form:
							raw.dynamic_form !== false &&
							raw.show_in_dynamic_form !== false &&
							raw.visible !== false,
						raw
					};
				}
				const inferredType =
					typeof raw === 'boolean' ? 'toggle' : typeof raw === 'number' ? 'slider' : 'text';
				return {
					key,
					label: '',
					type: inferredType,
					value: raw ?? '',
					dynamic_form: true,
					raw: null
				};
			});
	}

	/** @param {Record<string, any>} nextOpts */
	function syncOptionsState(nextOpts) {
		editingBoard.options = nextOpts;
		optionsJsonText = JSON.stringify(nextOpts, null, 2);
	}

	/**
	 * @param {string} key
	 * @param {boolean} checked
	 */
	function setBoardOptionFlag(key, checked) {
		syncOptionsState({
			...(editingBoard.options || {}),
			[key]: checked
		});
	}

	const boardPushOptionItems = [
		{
			key: 'push_on_post',
			title: '새 글 작성 시 푸시 발송',
			desc: '이 게시판 열람 권한을 가진 구독자에게 알림 전송 (작성자 제외)'
		},
		{
			key: 'push_on_comment',
			title: '새 댓글 작성 시 푸시 발송',
			desc: '게시글 작성자 본인에게 댓글 알림 전송 (본인 댓글 제외)'
		},
		{
			key: 'push_on_reply',
			title: '대댓글(답글) 작성 시 푸시 발송',
			desc: '원댓글 작성자 본인에게 답글 알림 전송 (본인 및 중복 발송 제외)'
		}
	];

	function addOptionEntry() {
		const cur = { ...(editingBoard.options || {}) };
		let idx = Object.keys(cur).length + 1;
		while (`option_${idx}` in cur) idx++;
		cur[`option_${idx}`] = {
			label: `옵션 ${idx}`,
			type: 'toggle',
			value: true,
			dynamic_form: true
		};
		syncOptionsState(cur);
	}

	/**
	 * @param {string} oldKey
	 * @param {string} newKey
	 * @param {{ label: string, type: string, value: any, dynamic_form: boolean, raw?: any }} entry
	 */
	function updateOptionEntry(oldKey, newKey, entry) {
		const cur = { ...(editingBoard.options || {}) };
		const cleanKey = (newKey || '').trim() || oldKey;
		if (cleanKey !== oldKey) {
			delete cur[oldKey];
		}
		let normalizedVal = entry.value;
		if (entry.type === 'toggle') normalizedVal = Boolean(entry.value);
		else if (entry.type === 'slider') normalizedVal = Number(entry.value || 0);
		else normalizedVal = String(entry.value ?? '');

		cur[cleanKey] = {
			...(entry.raw && typeof entry.raw === 'object' ? entry.raw : {}),
			label: entry.label || cleanKey,
			type: entry.type,
			value: normalizedVal,
			dynamic_form: Boolean(entry.dynamic_form)
		};
		syncOptionsState(cur);
	}

	/** @param {string} key */
	function removeOptionEntry(key) {
		const cur = { ...(editingBoard.options || {}) };
		delete cur[key];
		syncOptionsState(cur);
	}

	function toggleOptionsJsonMode() {
		if (!optionsJsonMode) {
			optionsJsonText = JSON.stringify(editingBoard.options || {}, null, 2);
			optionsJsonMode = true;
		} else {
			try {
				const parsed = JSON.parse(optionsJsonText || '{}');
				if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
					throw new Error('JSON 객체 형식이어야 합니다.');
				}
				editingBoard.options = parsed;
				optionsJsonMode = false;
			} catch (/** @type {any} */ err) {
				toast.error(
					'세부 옵션 JSON 형식 오류: ' + (err.message || '올바른 JSON 객체를 입력하세요.')
				);
			}
		}
	}

	async function handleSave() {
		if (!editingBoard.slug || !editingBoard.name) {
			toast.warning('게시판 주소(슬러그)와 이름은 필수 항목입니다.');
			return;
		}

		let finalFields = editingBoard.fields_def || [];
		if (fieldsJsonMode) {
			try {
				const parsed = JSON.parse(fieldsJsonText || '[]');
				if (!Array.isArray(parsed)) throw new Error('fields_def는 JSON 배열이어야 합니다.');
				finalFields = parsed;
			} catch (/** @type {any} */ err) {
				toast.error('동적 필드 JSON 오류: ' + (err.message || 'JSON 형식을 확인하세요.'));
				return;
			}
		}

		let finalOptions = editingBoard.options || {};
		try {
			const parsedOpt = JSON.parse(optionsJsonText || '{}');
			if (!parsedOpt || typeof parsedOpt !== 'object' || Array.isArray(parsedOpt)) {
				throw new Error('options는 JSON 객체여야 합니다.');
			}
			finalOptions = parsedOpt;
		} catch (/** @type {any} */ err) {
			toast.error('세부 옵션 JSON 오류: ' + (err.message || 'JSON 형식을 확인하세요.'));
			return;
		}

		const payload = {
			...editingBoard,
			service_instance_id: editingBoard.service_instance_id
				? Number(editingBoard.service_instance_id)
				: null,
			// 정수 ID 또는 레이아웃 객체({ app_id, row, display, wrap, align }) 모두 안전하게 보존
			service_app_ids: (editingBoard.service_app_ids || []).map((entry) =>
				entry && typeof entry === 'object' ? entry : Number(entry)
			),
			fields_def: finalFields,
			options: finalOptions
		};

		try {
			if (!editingBoard.id) {
				await api.adminCreateBoard(payload);
				toast.success(`[${editingBoard.name}] 게시판 인스턴스가 성공적으로 생성되었습니다.`);
			} else {
				await api.adminUpdateBoard(editingBoard.id, payload);
				toast.success(`[${editingBoard.name}] 게시판 설정이 업데이트되었습니다.`);
			}
			resetForm();
			activeTab = 'list';
			await loadBoards();
		} catch (/** @type {any} */ e) {
			toast.error('저장 실패: ' + (e.message || '오류가 발생했습니다.'));
		}
	}

	/**
	 * @param {string} type
	 */
	function getLayoutBadge(type) {
		switch (type) {
			case 'gallery':
				return { label: '갤러리형', class: 'bg-amber-50 text-amber-700 border-amber-200' };
			case 'blog':
				return { label: '블로그형', class: 'bg-purple-50 text-purple-700 border-purple-200' };
			default:
				return { label: '리스트형', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
		}
	}
</script>

<svelte:head>
	<title>{getSiteTitle('게시판 인스턴스 관리')}</title>
</svelte:head>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 우측 컨트롤 바 -->
	<!-- ===================================================================== -->
	<header
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<div class="mb-2 flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black tracking-widest text-blue-700 uppercase"
				>
					<Icon icon="ph:clipboard-text-bold" class="text-sm" />
					SYSTEM GOVERNANCE • BOARD INSTANCE
				</span>
				<span class="font-mono text-xs font-bold text-slate-400">v1/admin/board</span>
			</div>
			<h1
				class="text-3xl font-black tracking-tighter text-slate-900 uppercase italic sm:text-4xl md:text-5xl"
			>
				게시판 <span class="text-blue-600 not-italic">인스턴스 관리</span>
			</h1>
			<p class="mt-2 text-xs font-bold text-slate-500 sm:text-sm">
				공지사항, 자유게시판 등 시스템에서 가동할 실제 게시판 인스턴스를 설계하고 설정합니다.
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 -->
		<div class="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
			<button
				onclick={startCreate}
				class="flex items-center gap-1.5 rounded-2xl border-2 border-blue-600 bg-blue-600 px-4 py-2.5 text-xs font-black tracking-wider text-white uppercase shadow-sm transition hover:bg-blue-700"
			>
				<Icon icon="ph:plus-circle-bold" class="text-base" />
				<span>새 게시판 등록</span>
			</button>

			<button
				onclick={loadBoards}
				disabled={loading}
				class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-xs font-black tracking-wider text-slate-700 uppercase shadow-sm transition hover:border-slate-400 disabled:opacity-50"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="flex items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-xs font-black tracking-wider text-slate-700 uppercase shadow-sm transition hover:border-slate-400"
			>
				<Icon icon="ph:house-bold" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- ===================================================================== -->
	<!-- 2. 알림/요약 지표 카드 (최대 4개, 최소 1개 규격) -->
	<!-- ===================================================================== -->
	<section class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4">
		<!-- 카드 1: 전체 게시판 -->
		<button
			onclick={() => {
				activeTab = 'list';
				filterLayout = 'ALL';
			}}
			class="group relative w-full overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 text-left shadow-sm transition {filterLayout ===
			'ALL'
				? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20'
				: 'border-slate-100 hover:border-blue-300'}"
		>
			<div class="mb-3 flex w-full items-center justify-between gap-2">
				<span
					class="min-w-0 truncate text-xs font-black tracking-widest text-slate-400 uppercase group-hover:text-blue-600"
					>Total Boards</span
				>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 transition-transform group-hover:scale-110"
				>
					<Icon icon="ph:squares-four-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black tracking-tight text-slate-900">
				{loading ? '...' : countTotal}
				<span class="ml-1 text-sm font-bold text-slate-400">개 인스턴스</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-blue-600">
				<span class="rounded-lg bg-blue-50 px-2 py-0.5 font-mono">가동률 100%</span>
				<span class="font-normal text-slate-400">전체 클러스터</span>
			</div>
		</button>

		<!-- 카드 2: 표준 리스트형 -->
		<button
			onclick={() => {
				activeTab = 'list';
				filterLayout = 'list';
			}}
			class="group relative w-full overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 text-left shadow-sm transition {filterLayout ===
			'list'
				? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20'
				: 'border-slate-100 hover:border-emerald-300'}"
		>
			<div class="mb-3 flex w-full items-center justify-between gap-2">
				<span
					class="min-w-0 truncate text-xs font-black tracking-widest text-slate-400 uppercase group-hover:text-emerald-600"
					>List Layout</span
				>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform group-hover:scale-110"
				>
					<Icon icon="ph:list-bullets-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black tracking-tight text-slate-900">
				{loading ? '...' : countList}
				<span class="ml-1 text-sm font-bold text-slate-400">개 목록형</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">공지·사내게시</span>
				<span class="font-normal text-slate-400">표준 목록</span>
			</div>
		</button>

		<!-- 카드 3: 갤러리/사진형 -->
		<button
			onclick={() => {
				activeTab = 'list';
				filterLayout = 'gallery';
			}}
			class="group relative w-full overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 text-left shadow-sm transition {filterLayout ===
			'gallery'
				? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/20'
				: 'border-slate-100 hover:border-amber-300'}"
		>
			<div class="mb-3 flex w-full items-center justify-between gap-2">
				<span
					class="min-w-0 truncate text-xs font-black tracking-widest text-slate-400 uppercase group-hover:text-amber-600"
					>Gallery Layout</span
				>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 transition-transform group-hover:scale-110"
				>
					<Icon icon="ph:image-square-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black tracking-tight text-slate-900">
				{loading ? '...' : countGallery}
				<span class="ml-1 text-sm font-bold text-slate-400">개 갤러리</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">현장 사진·미디어</span>
				<span class="font-normal text-slate-400">카드 뷰</span>
			</div>
		</button>

		<!-- 카드 4: 블로그/피드형 -->
		<button
			onclick={() => {
				activeTab = 'list';
				filterLayout = 'blog';
			}}
			class="group relative w-full overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 text-left shadow-sm transition {filterLayout ===
			'blog'
				? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20'
				: 'border-slate-100 hover:border-purple-300'}"
		>
			<div class="mb-3 flex w-full items-center justify-between gap-2">
				<span
					class="min-w-0 truncate text-xs font-black tracking-widest text-slate-400 uppercase group-hover:text-purple-600"
					>Blog Layout</span
				>
				<div
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 transition-transform group-hover:scale-110"
				>
					<Icon icon="ph:article-medium-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black tracking-tight text-slate-900">
				{loading ? '...' : countBlog}
				<span class="ml-1 text-sm font-bold text-slate-400">개 피드형</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-purple-600">
				<span class="rounded-lg bg-purple-50 px-2 py-0.5 font-mono">주간 보고서</span>
				<span class="font-normal text-slate-400">본문 요약</span>
			</div>
		</button>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 (최소 1개, 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<nav class="no-scrollbar flex gap-2 overflow-x-auto border-b-2 border-slate-200">
		<button
			onclick={() => (activeTab = 'list')}
			class="px-6 py-3.5 text-xs font-black tracking-widest whitespace-nowrap uppercase transition-all {activeTab ===
			'list'
				? 'rounded-t-2xl border-b-4 border-blue-600 bg-blue-50/60 text-blue-700'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			게시판 인스턴스 명부 ({filteredBoards.length})
		</button>
		<button
			onclick={startCreate}
			class="px-6 py-3.5 text-xs font-black tracking-widest whitespace-nowrap uppercase transition-all {activeTab ===
			'create'
				? 'rounded-t-2xl border-b-4 border-blue-600 bg-blue-50/60 text-blue-700'
				: 'text-slate-400 hover:text-slate-700'}"
		>
			{editingBoard.id ? `설정 수정: ${editingBoard.name}` : '새 게시판 인스턴스 등록'}
		</button>
	</nav>

	<!-- ===================================================================== -->
	<!-- 4. 본문 컨텐츠 (반응형 카드 형식 위주) -->
	<!-- ===================================================================== -->
	{#if loading}
		<div class="flex justify-center py-20">
			<div class="flex flex-col items-center gap-3">
				<div
					class="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
				></div>
				<p class="font-mono text-xs font-bold text-slate-400">게시판 인스턴스 스캔 중...</p>
			</div>
		</div>
	{:else if activeTab === 'list'}
		<!-- 탭 1: 게시판 카드 목록 뷰 -->
		<div class="space-y-4">
			{#if filteredBoards.length === 0}
				<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
					<Icon icon="ph:clipboard-text-light" class="mx-auto mb-3 text-4xl text-slate-300" />
					<p class="text-sm font-bold text-slate-500">선택된 조건의 게시판 인스턴스가 없습니다.</p>
					<button
						onclick={startCreate}
						class="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700"
					>
						첫 게시판 등록하기
					</button>
				</div>
			{:else}
				<!-- 반응형 카드 그리드: 모바일 세로 1열, 태블릿 2열, 데스크탑 3열 -->
				<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
					{#each filteredBoards as b}
						{@const badge = getLayoutBadge(b.layout_type)}
						<div
							class="flex flex-col justify-between rounded-2xl border-2 bg-white p-6 shadow-sm transition-all hover:border-blue-400 {editingBoard.id ===
							b.id
								? 'border-blue-600 ring-2 ring-blue-600/20'
								: 'border-slate-200'}"
						>
							<div>
								<div class="mb-2 flex items-center justify-between">
									<span
										class="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-black text-slate-700 uppercase"
									>
										/{b.slug}
									</span>
									<span class="rounded-md border px-2.5 py-0.5 text-[10px] font-bold {badge.class}">
										{badge.label}
									</span>
								</div>
								<h3 class="mt-1 text-xl font-black tracking-tight text-slate-900">{b.name}</h3>
								<p class="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-500">
									{b.description || '별도의 설명이 설정되지 않았습니다.'}
								</p>
							</div>

							<div
								class="mt-6 flex items-center justify-between gap-2 border-t border-slate-100 pt-4"
							>
								<div class="flex items-center gap-2 font-mono text-xs font-bold text-slate-400">
									<span>{b.items_per_page || 10}건</span>
									<span
										class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-600"
									>
										R{b.min_read_rank ?? 0} / W{b.min_write_rank ?? 2}
									</span>
								</div>
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => startEdit(b)}
										class="rounded-xl px-3 py-1.5 text-xs font-black text-blue-600 transition hover:bg-blue-50"
									>
										설정 수정
									</button>
									<a
										href="/v1/app/board/{b.slug}"
										class="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-600"
										title="사용자 화면으로 이동"
									>
										<span>열기</span>
										<Icon icon="ph:arrow-right-bold" class="text-xs" />
									</a>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- 탭 2: 생성/수정 폼 카드 -->
		<div class="max-w-4xl rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-10">
			<div
				class="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-slate-100 pb-4"
			>
				<div>
					<h3 class="text-2xl font-black tracking-tight text-slate-900">
						{editingBoard.id
							? `게시판 인스턴스 수정: ${editingBoard.name}`
							: '새 게시판 인스턴스 설계 및 등록'}
					</h3>
					<p class="mt-1 text-xs font-bold text-slate-400">
						경로(Slug)와 명칭, 레이아웃 규격을 지정하여 새 게시판 서비스를 즉시 활성화합니다.
					</p>
				</div>
				{#if editingBoard.id && editingBoard.slug}
					<a
						href="/v1/app/board/{editingBoard.slug}"
						class="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700 transition hover:bg-blue-600 hover:text-white"
					>
						<span>게시판 바로가기</span>
						<Icon icon="ph:arrow-square-out-bold" class="text-xs" />
					</a>
				{/if}
			</div>

			<div class="space-y-6">
				<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
					<div class="space-y-1.5">
						<label
							for="board-slug-input"
							class="block text-xs font-black tracking-wide text-slate-700"
						>
							게시판 주소 (Slug / ID) <span class="text-rose-500">*</span>
						</label>
						<input
							id="board-slug-input"
							type="text"
							bind:value={editingBoard.slug}
							class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 font-mono text-xs font-bold text-blue-600 transition focus:border-blue-600 focus:bg-white focus:outline-none"
							placeholder="예: notice, free, gallery, qna"
						/>
						<p class="text-[11px] text-slate-400">URL 경로(/v1/app/board/[slug])로 사용됩니다.</p>
					</div>

					<div class="space-y-1.5">
						<label
							for="board-name-input"
							class="block text-xs font-black tracking-wide text-slate-700"
						>
							게시판 공식 명칭 <span class="text-rose-500">*</span>
						</label>
						<input
							id="board-name-input"
							type="text"
							bind:value={editingBoard.name}
							class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:bg-white focus:outline-none"
							placeholder="예: 전사 공지사항"
						/>
						<p class="text-[11px] text-slate-400">화면 상단 및 메뉴에 노출되는 한글 명칭입니다.</p>
					</div>
				</div>

				<div class="space-y-1.5">
					<label
						for="board-desc-input"
						class="block text-xs font-black tracking-wide text-slate-700">게시판 상세 설명</label
					>
					<input
						id="board-desc-input"
						type="text"
						bind:value={editingBoard.description}
						class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:outline-none"
						placeholder="사용자 및 임직원에게 안내할 게시판의 역할과 이용 수칙"
					/>
				</div>

				<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
					<div class="space-y-1.5">
						<label
							for="board-layout-select"
							class="block text-xs font-black tracking-wide text-slate-700"
							>표준 레이아웃 스타일</label
						>
						<select
							id="board-layout-select"
							bind:value={editingBoard.layout_type}
							class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:outline-none"
						>
							<option value="list">리스트형 (일반 텍스트 목록 표준)</option>
							<option value="gallery">갤러리형 (현장 사진·이미지 썸네일 카드)</option>
							<option value="blog">블로그형 (피드 본문 요약 카드)</option>
						</select>
					</div>

					<div class="space-y-1.5">
						<label
							for="board-items-input"
							class="block text-xs font-black tracking-wide text-slate-700"
							>페이지당 기본 노출 건수</label
						>
						<input
							id="board-items-input"
							type="number"
							bind:value={editingBoard.items_per_page}
							class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:outline-none"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
					<div class="space-y-1.5">
						<label
							for="board-read-rank-select"
							class="block text-xs font-black tracking-wide text-slate-700"
							>읽기 최소 권한 (min_read_rank)</label
						>
						<select
							id="board-read-rank-select"
							bind:value={editingBoard.min_read_rank}
							class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:outline-none"
						>
							{#each RANK_LEVELS as r (r.val)}
								<option value={r.val}>Lv.{r.val}</option>
							{/each}
						</select>
					</div>

					<div class="space-y-1.5">
						<label
							for="board-write-rank-select"
							class="block text-xs font-black tracking-wide text-slate-700"
							>쓰기/수정 최소 권한 (min_write_rank)</label
						>
						<select
							id="board-write-rank-select"
							bind:value={editingBoard.min_write_rank}
							class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:outline-none"
						>
							{#each RANK_LEVELS as r (r.val)}
								<option value={r.val}>Lv.{r.val}</option>
							{/each}
						</select>
					</div>
				</div>

				<div
					class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
				>
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="checkbox"
							bind:checked={editingBoard.is_active}
							class="checkbox checkbox-sm checkbox-primary"
						/>
						<span class="text-xs font-bold text-slate-700">게시판 활성화 (is_active)</span>
					</label>
					<a
						href="/v1/admin/group-manage"
						class="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:underline"
					>
						<Icon icon="ph:shield-check-bold" class="text-sm" />
						<span>그룹별 허용/차단(allow/deny) 세부 관리 →</span>
					</a>
				</div>

				<!-- 🔔 웹 푸시 알림 연동 옵션 (공용 컴포넌트) -->
				<PushOptionSection
					subtitle="새 게시글이나 댓글이 등록될 때 모바일·PC 구독자에게 백그라운드 푸시 알림을 발송합니다."
					options={editingBoard.options}
					items={boardPushOptionItems}
					onToggle={setBoardOptionFlag}
				/>

				<!-- 서비스 연결 (공통 번들 연결 + 이 게시판 전용 직접 조립) -->
				<div class="space-y-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 sm:p-5">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<h4 class="text-xs font-black text-slate-800">
								게시판 서비스 연결 (댓글 · 반응 · 열람확인 · 업로드 등)
							</h4>
							<p class="text-[11px] text-slate-500">
								공통 번들을 연결하거나, 이 게시판에 필요한 서비스만 직접 체크해 순서를 지정할 수
								있습니다.
							</p>
						</div>
						{#if (editingBoard.service_app_ids || []).length > 0}
							<span
								class="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-blue-700"
							>
								직접 구성 우선 적용 중 ({editingBoard.service_app_ids.length}개)
							</span>
						{:else if editingBoard.service_instance_id}
							<span
								class="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-black text-rose-700"
							>
								공통 번들 적용 중
							</span>
						{/if}
					</div>

					<!-- 1) 공통 번들 선택 + 프리셋 불러오기 -->
					<div class="grid grid-cols-1 gap-2 sm:grid-cols-12 sm:items-end">
						<div class="space-y-1 sm:col-span-8">
							<label for="board-service-bundle" class="block text-[11px] font-bold text-slate-600">
								공통 조립 번들 (여러 게시판에 동일 세트 일괄 적용 시)
							</label>
							<select
								id="board-service-bundle"
								bind:value={editingBoard.service_instance_id}
								class="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-800 transition focus:border-blue-600 focus:outline-none"
							>
								<option value={null}>연결 안 함</option>
								{#each serviceInstances as inst}
									<option value={inst.id}>{inst.name} (ID: {inst.id})</option>
								{/each}
							</select>
						</div>
						<div class="flex gap-2 sm:col-span-4">
							<button
								type="button"
								disabled={!editingBoard.service_instance_id}
								onclick={() => applyBundlePreset(editingBoard.service_instance_id)}
								class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[11px] font-black text-slate-700 hover:bg-slate-100 disabled:opacity-40"
							>
								번들 구성을 프리셋으로 복사
							</button>
						</div>
					</div>

					<!-- 2) 이 게시판 전용 직접 조립 (선택 순서 + 카테고리별 그룹 체크) -->
					<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<span class="text-xs font-black text-slate-800"
								>이 게시판 전용 서비스 직접 선택 (선택 시 번들보다 우선 적용)</span
							>
							{#if (editingBoard.service_app_ids || []).length > 0}
								<button
									type="button"
									onclick={() => (editingBoard.service_app_ids = [])}
									class="text-[11px] font-bold text-rose-500 hover:underline"
								>
									직접 선택 비우기 (공통 번들 사용)
								</button>
							{/if}
						</div>

						{#if (editingBoard.service_app_ids || []).length > 0}
							<div
								class="flex flex-wrap gap-1.5 rounded-xl border border-blue-100 bg-blue-50/50 p-2.5"
							>
								{#each editingBoard.service_app_ids as appId, idx (appId + '-' + idx)}
									{@const appObj = serviceApps.find((a) => a.id === appId)}
									<div
										class="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1 text-xs shadow-xs"
									>
										<span class="font-black text-blue-600">{idx + 1}.</span>
										<span class="font-bold text-slate-800">{appObj?.name || `모듈 #${appId}`}</span>
										<button
											type="button"
											disabled={idx === 0}
											onclick={() => moveBoardServiceApp(idx, -1)}
											class="px-1 text-[10px] font-black text-slate-500 hover:text-slate-900 disabled:opacity-30"
											title="앞으로"
										>
											◀
										</button>
										<button
											type="button"
											disabled={idx === editingBoard.service_app_ids.length - 1}
											onclick={() => moveBoardServiceApp(idx, 1)}
											class="px-1 text-[10px] font-black text-slate-500 hover:text-slate-900 disabled:opacity-30"
											title="뒤로"
										>
											▶
										</button>
										<button
											type="button"
											onclick={() => toggleBoardServiceApp(appId)}
											class="px-1 text-[10px] font-black text-rose-500 hover:text-rose-700"
											title="제거"
										>
											✕
										</button>
									</div>
								{/each}
							</div>
						{/if}

						<input
							type="text"
							bind:value={serviceSearchQuery}
							placeholder="서비스 모듈 검색 (예: 댓글, 좋아요, 열람...)"
							class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						/>

						{#if serviceApps.length === 0}
							<p class="py-3 text-center text-xs text-slate-400">
								등록된 3단계 서비스 인스턴스가 없습니다. (`/v1/admin/services`에서 먼저 생성하세요.)
							</p>
						{:else}
							<div class="max-h-64 space-y-3 overflow-y-auto pr-1">
								{#each getGroupedServiceApps() as group (group.registryId)}
									<div class="space-y-1.5">
										<div class="flex items-center gap-2 text-[11px] font-black text-slate-500">
											<span class="rounded bg-slate-100 px-2 py-0.5 text-slate-700"
												>{group.registryName}</span
											>
											<span class="font-mono text-[10px] text-slate-400">({group.registryId})</span>
										</div>
										<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
											{#each group.apps as app (app.id)}
												{@const checked = (editingBoard.service_app_ids || []).includes(app.id)}
												<label
													class="flex cursor-pointer items-center gap-2.5 rounded-xl border p-2.5 text-xs transition {checked
														? 'border-blue-300 bg-blue-50/60'
														: 'border-slate-200 bg-white hover:border-slate-300'}"
												>
													<input
														type="checkbox"
														{checked}
														onchange={() => toggleBoardServiceApp(app.id)}
														class="h-4 w-4 rounded border-slate-300 text-blue-600"
													/>
													<div class="min-w-0 flex-1">
														<div class="truncate font-black text-slate-800">{app.name}</div>
														<div class="truncate font-mono text-[10px] text-slate-400">
															{app.engine_id}
														</div>
													</div>
												</label>
											{/each}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>

				<!-- 인스턴스별 서비스앱 권한 예외 설정 (options.service_permissions) -->
				{#if serviceRegistries.length > 0}
					<div class="space-y-3 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 sm:p-5">
						<div>
							<h4 class="text-xs font-black text-slate-800">
								인스턴스별 서비스앱 권한 예외 (options.service_permissions)
							</h4>
							<p class="text-[11px] text-slate-500">
								공용 번들을 공유하더라도 이 게시판에서만 특정 서비스의 조회·쓰기 정책을 다르게
								덮어쓸 수 있습니다.
							</p>
						</div>
						<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
							{#each serviceRegistries as reg (reg.id)}
								{@const curPerm = editingBoard.options?.service_permissions?.[reg.id] || {}}
								<div class="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
									<div class="flex items-center justify-between gap-2">
										<span class="text-xs font-black text-slate-800">{reg.name}</span>
										<span
											class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
											>{reg.id}</span
										>
									</div>
									<div class="grid grid-cols-2 gap-2">
										<select
											aria-label="{reg.name} 조회 정책"
											value={curPerm.read_policy || 'inherit'}
											onchange={(e) =>
												setBoardServicePermission(reg.id, 'read_policy', e.currentTarget.value)}
											class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700"
										>
											{#each SERVICE_READ_POLICY_OPTIONS as opt (opt.value)}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
										<select
											aria-label="{reg.name} 쓰기 정책"
											value={curPerm.write_policy || 'inherit_read'}
											onchange={(e) =>
												setBoardServicePermission(reg.id, 'write_policy', e.currentTarget.value)}
											class="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700"
										>
											{#each SERVICE_WRITE_POLICY_OPTIONS as opt (opt.value)}
												<option value={opt.value}>{opt.label}</option>
											{/each}
										</select>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 동적 커스텀 폼 필드 정의 (fields_def) -->
				<div class="space-y-3 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 sm:p-5">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<h4 class="text-xs font-black text-slate-800">동적 커스텀 필드 (fields_def)</h4>
							<p class="text-[11px] text-slate-500">
								글 작성 폼에 추가 입력 필드(텍스트·숫자·날짜·선택)를 동적으로 구성합니다.
							</p>
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={toggleFieldsJsonMode}
								class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:bg-slate-100"
							>
								{fieldsJsonMode ? '시각적 편집기로 보기' : 'JSON 직접 편집'}
							</button>
							{#if !fieldsJsonMode}
								<button
									type="button"
									onclick={addCustomField}
									class="rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-blue-600"
								>
									+ 필드 추가
								</button>
							{/if}
						</div>
					</div>

					{#if fieldsJsonMode}
						<textarea
							bind:value={fieldsJsonText}
							rows="6"
							class="w-full rounded-xl border-2 border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
							placeholder={`[{"key": "department", "label": "부서", "type": "text", "placeholder": "예: 운수팀"}]`}
						></textarea>
					{:else if !editingBoard.fields_def || editingBoard.fields_def.length === 0}
						<p
							class="rounded-xl border border-dashed border-slate-300 bg-white/80 py-4 text-center text-xs font-medium text-slate-400"
						>
							추가된 커스텀 필드가 없습니다. (+ 필드 추가 또는 JSON 직접 편집)
						</p>
					{:else}
						<div class="space-y-2.5">
							{#each editingBoard.fields_def as field, idx}
								<div
									class="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-12 sm:items-center"
								>
									<input
										type="text"
										bind:value={field.key}
										placeholder="키 (영문)"
										class="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs font-bold sm:col-span-2"
									/>
									<input
										type="text"
										bind:value={field.label}
										placeholder="라벨명"
										class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold sm:col-span-3"
									/>
									<select
										bind:value={field.type}
										class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold sm:col-span-2"
									>
										<option value="text">텍스트</option>
										<option value="number">숫자</option>
										<option value="date">날짜</option>
										<option value="select">선택(Select)</option>
									</select>
									{#if field.type === 'select'}
										<input
											type="text"
											bind:value={field.options_text}
											placeholder="옵션 (쉼표 구분)"
											class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs sm:col-span-4"
										/>
									{:else}
										<input
											type="text"
											bind:value={field.placeholder}
											placeholder="안내 문구(placeholder)"
											class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs sm:col-span-4"
										/>
									{/if}
									<button
										type="button"
										onclick={() => removeCustomField(idx)}
										class="rounded-lg px-2 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 sm:col-span-1"
										title="필드 삭제"
									>
										삭제
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- 게시판 리스트 전역 옵션 (options JSON) -->
				<div class="space-y-3 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 sm:p-5">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<div>
							<h4 class="text-xs font-black text-slate-800">
								게시판 리스트 전역 옵션 (options JSON)
							</h4>
							<p class="text-[11px] text-slate-500">
								목록·상세 전역 동작과 우측 다이나믹 폼 표시 여부(<code class="font-mono"
									>dynamic_form</code
								>)를 설정합니다.
							</p>
						</div>
						<div class="flex items-center gap-2">
							<button
								type="button"
								onclick={toggleOptionsJsonMode}
								class="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-100"
							>
								{optionsJsonMode ? '폼 빌더로 보기' : 'JSON 직접 편집'}
							</button>
							{#if !optionsJsonMode}
								<button
									type="button"
									onclick={addOptionEntry}
									class="rounded-xl bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700"
								>
									+ 옵션 추가
								</button>
							{/if}
						</div>
					</div>

					{#if optionsJsonMode}
						<textarea
							bind:value={optionsJsonText}
							rows="5"
							class="w-full rounded-xl border-2 border-slate-200 bg-white p-3 font-mono text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
						></textarea>
					{:else}
						{@const optionEntries = getOptionEntries()}
						{#if optionEntries.length === 0}
							<p
								class="rounded-xl border border-dashed border-slate-300 bg-white py-4 text-center text-xs text-slate-400"
							>
								정의된 세부 옵션이 없습니다. `+ 옵션 추가`로 항목을 추가하세요.
							</p>
						{:else}
							<div class="space-y-2">
								{#each optionEntries as entry (entry.key)}
									<div
										class="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:grid-cols-12 sm:items-center"
									>
										<input
											type="text"
											value={entry.key}
											onchange={(e) => updateOptionEntry(entry.key, e.currentTarget.value, entry)}
											placeholder="키 (예: use_comment)"
											class="rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs sm:col-span-3"
										/>
										<input
											type="text"
											value={entry.label}
											onchange={(e) =>
												updateOptionEntry(entry.key, entry.key, {
													...entry,
													label: e.currentTarget.value
												})}
											placeholder="한글 라벨 (예: 댓글 허용)"
											class="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs sm:col-span-3"
										/>
										<select
											value={entry.type}
											onchange={(e) => {
												const nextType = e.currentTarget.value;
												const nextVal =
													nextType === 'toggle'
														? Boolean(entry.value)
														: nextType === 'slider'
															? Number(entry.value || 0)
															: String(entry.value ?? '');
												updateOptionEntry(entry.key, entry.key, {
													...entry,
													type: nextType,
													value: nextVal
												});
											}}
											class="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-bold sm:col-span-2"
										>
											<option value="toggle">토글</option>
											<option value="slider">슬라이더</option>
											<option value="text">텍스트</option>
										</select>
										<div class="flex items-center sm:col-span-2">
											{#if entry.type === 'toggle'}
												<label
													class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-700"
												>
													<input
														type="checkbox"
														checked={Boolean(entry.value)}
														onchange={(e) =>
															updateOptionEntry(entry.key, entry.key, {
																...entry,
																value: e.currentTarget.checked
															})}
														class="h-4 w-4 rounded border-slate-300 text-blue-600"
													/>
													<span>{entry.value ? '활성' : '비활성'}</span>
												</label>
											{:else if entry.type === 'slider'}
												<input
													type="number"
													value={Number(entry.value || 0)}
													onchange={(e) =>
														updateOptionEntry(entry.key, entry.key, {
															...entry,
															value: Number(e.currentTarget.value)
														})}
													class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
												/>
											{:else}
												<input
													type="text"
													value={String(entry.value ?? '')}
													onchange={(e) =>
														updateOptionEntry(entry.key, entry.key, {
															...entry,
															value: e.currentTarget.value
														})}
													placeholder="기본값"
													class="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
												/>
											{/if}
										</div>
										<label
											class="inline-flex cursor-pointer items-center justify-center gap-1 text-[11px] font-bold text-slate-600 sm:col-span-1"
											title="우측 다이나믹 폼에 표시"
										>
											<input
												type="checkbox"
												checked={entry.dynamic_form}
												onchange={(e) =>
													updateOptionEntry(entry.key, entry.key, {
														...entry,
														dynamic_form: e.currentTarget.checked
													})}
												class="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600"
											/>
											<span class="sm:hidden">동적폼</span>
										</label>
										<button
											type="button"
											onclick={() => removeOptionEntry(entry.key)}
											class="rounded-lg px-2 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 sm:col-span-1"
											title="옵션 삭제"
										>
											삭제
										</button>
									</div>
								{/each}
							</div>
						{/if}
					{/if}

					<!-- 게시판 카테고리 목록 설정 -->
					<div class="rounded-xl border border-slate-200 bg-white p-3.5">
						<label for="board-categories" class="mb-1 block text-xs font-black text-slate-800">
							게시판 카테고리 목록 (<code class="font-mono">categories</code>)
						</label>
						<p class="mb-2 text-[11px] text-slate-500">
							목록 필터 탭과 글 작성·상세 Dynamic Form의 카테고리 선택지에 표시할 항목입니다.
							(쉼표로 구분, 비우면 기본 6종 적용)
						</p>
						<input
							id="board-categories"
							type="text"
							value={Array.isArray(editingBoard.options?.categories)
								? editingBoard.options.categories.join(', ')
								: editingBoard.options?.categories || DEFAULT_POST_CATEGORIES.join(', ')}
							onchange={(e) => {
								const list = e.currentTarget.value
									.split(',')
									.map((s) => s.trim())
									.filter(Boolean);
								const opts = { ...(editingBoard.options || {}), categories: list };
								editingBoard.options = opts;
								optionsJsonText = JSON.stringify(opts, null, 2);
							}}
							placeholder="예: 공지, 긴급, 필독, 안전, 정비, 일반"
							class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
						/>
					</div>

					<!-- 게시판 전용 관리자 그룹 (주그룹/부그룹 위임) -->
					<div class="rounded-xl border border-slate-200 bg-white p-3.5">
						<label for="board-admin-groups" class="mb-1 block text-xs font-black text-slate-800">
							게시판 전용 관리자 그룹 (<code class="font-mono">admin_groups</code>)
						</label>
						<p class="mb-2 text-[11px] text-slate-500">
							기본 게시판 관리자 랭크는 상위 앱(<code class="font-mono">board</code>)의
							<strong>쓰기 최소 랭크(<code class="font-mono">min_write_rank</code>)</strong> 설정과 같으며,
							추가로 여기에 입력한 주그룹/부그룹 소속 사원에게도 이 게시판의 상단고정·메타편집·비밀글
							열람·게시물 관리 권한을 위임할 수 있습니다. (쉼표로 구분)
						</p>
						<input
							id="board-admin-groups"
							type="text"
							value={Array.isArray(editingBoard.options?.admin_groups)
								? editingBoard.options.admin_groups.join(', ')
								: editingBoard.options?.admin_groups || ''}
							onchange={(e) => {
								const list = e.currentTarget.value
									.split(',')
									.map((s) => s.trim())
									.filter(Boolean);
								const opts = { ...(editingBoard.options || {}), admin_groups: list };
								editingBoard.options = opts;
								optionsJsonText = JSON.stringify(opts, null, 2);
							}}
							placeholder="예: NOTICE_MANAGER, 안전관리팀"
							class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 focus:border-blue-600 focus:bg-white focus:outline-none"
						/>
					</div>

					<!-- 게시물 메타 Dynamic Form 노출 체크박스 매트릭스 -->
					<div class="mt-4 rounded-xl border border-slate-200 bg-white p-3.5">
						<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
							<div>
								<h5 class="text-xs font-black text-slate-800">
									게시물 메타 Dynamic Form 노출 설정
								</h5>
								<p class="text-[11px] text-slate-500">
									체크박스를 클릭하면 위 options JSON의 <code class="font-mono"
										>write_meta_keys</code
									>
									/ <code class="font-mono">view_meta_keys</code>에 자동 반영됩니다.
								</p>
							</div>
							<div class="flex flex-wrap items-center gap-1.5 text-[11px]">
								<button
									type="button"
									onclick={() => setAllMetaKeys('write_meta_keys', true)}
									class="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-700 hover:bg-slate-200"
									>작성 전체</button
								>
								<button
									type="button"
									onclick={() => setAllMetaKeys('write_meta_keys', false)}
									class="rounded-lg bg-slate-100 px-2 py-1 font-bold text-slate-500 hover:bg-slate-200"
									>작성 해제</button
								>
								<button
									type="button"
									onclick={() => setAllMetaKeys('view_meta_keys', true)}
									class="rounded-lg bg-blue-50 px-2 py-1 font-bold text-blue-700 hover:bg-blue-100"
									>상세 전체</button
								>
								<button
									type="button"
									onclick={() => setAllMetaKeys('view_meta_keys', false)}
									class="rounded-lg bg-blue-50 px-2 py-1 font-bold text-blue-500 hover:bg-blue-100"
									>상세 해제</button
								>
							</div>
						</div>

						<div class="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
							{#each POST_META_CATALOG as item (item.key)}
								<div
									class="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2.5 py-1.5 text-xs"
								>
									<div class="min-w-0">
										<div class="truncate font-bold text-slate-800">{item.label}</div>
										<div class="truncate font-mono text-[10px] text-slate-400">
											{item.key}{item.adminOnly ? ' · 관리자' : ''}
										</div>
									</div>
									<div class="flex shrink-0 items-center gap-2">
										<label
											class="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-slate-600"
										>
											<input
												type="checkbox"
												checked={isMetaKeyEnabled('write_meta_keys', item.key)}
												onchange={() => toggleMetaKey('write_meta_keys', item.key)}
												class="checkbox checkbox-xs"
											/>
											<span>작성</span>
										</label>
										<label
											class="inline-flex cursor-pointer items-center gap-1 text-[11px] font-bold text-blue-700"
										>
											<input
												type="checkbox"
												checked={isMetaKeyEnabled('view_meta_keys', item.key)}
												onchange={() => toggleMetaKey('view_meta_keys', item.key)}
												class="checkbox checkbox-xs checkbox-primary"
											/>
											<span>상세</span>
										</label>
									</div>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<div class="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-6">
					<button
						onclick={handleSave}
						class="rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black tracking-wider text-white uppercase shadow-md transition hover:bg-blue-700"
					>
						{editingBoard.id ? '게시판 설정 저장하기' : '새 게시판 인스턴스 활성화'}
					</button>

					<button
						onclick={() => {
							resetForm();
							activeTab = 'list';
						}}
						class="rounded-2xl border-2 border-slate-200 px-5 py-3 text-xs font-black text-slate-600 uppercase transition hover:bg-slate-50"
					>
						목록으로 돌아가기
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
