<script>
	/**
	 * @file BoardEngine.svelte
	 * @description Svelte 5 기반의 범용 게시판 엔진 (목록, 상세, 쓰기, 수정 통합)
	 * @prop {string} slug  - URL 슬러그 (예: "notice", "notice/42", "notice/42/edit")
	 * @prop {string} appId - 앱 인스턴스 ID
	 */
	import { untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import * as api from '$lib/api/board';
	import { adminGetAppData } from '$lib/api/admin';
	import * as engines from '$lib/index';
	import { goto } from '$app/navigation';
	import TiptapEditor from '$lib/components/TiptapEditor.svelte';

	/** @type {{ slug: string, appId: string, initialData?: any }} */
	let { slug, appId, initialData = null } = $props();

	// --- [라우팅 및 모드 분석] ---
	let mode = $state('list'); // list, view, write, edit
	let boardSlug = $state('');
	let postId = $state(null);
	let currentPage = $state(1);
	let pageSize = $state(10);
	let keyword = $state('');

	// --- [데이터 상태] ---
	// ✅ SSR initialData 구조에 따라 목록/상세 모드 분기 초기화
	// · 목록 모드:  initialData = { posts, board, total }
	// · 상세 모드:  initialData = { post, board, bindings }
	let posts = $state(initialData?.posts || []);
	let board = $state(initialData?.board || null);
	let post = $state(initialData?.post || null);
	let bindings = $state(initialData?.bindings || []);
	let total = $state(initialData?.total || 0);
	let isLoading = $state(false); // initialData 유무와 무관하게 false 로 시작 (loadData 내부에서 제어)
	let errorMessage = $state('');

	// --- [폼 상태] ---
	// ⚠️ $state 초기화 시 다른 $state(post)를 直접 참조하면 state_referenced_locally 에러 발생
	//    → 리터럴 기본값으로 선언 후 loadData/parsePath 에서 채움
	let editForm = $state({
		title: '',
		content: '',
		content_json: null,
		extra_data: {},
		status: 'published'
	});

	/** 경로 파싱 함수 */
	function parsePath() {
		const parts = slug.split('/').filter((p) => p !== '');
		boardSlug = parts[0] || '';

		if (parts.length === 1) {
			mode = 'list';
		} else if (parts[1] === 'write') {
			mode = 'write';
		} else if (parts.length >= 2) {
			postId = parts[1];
			if (parts[2] === 'edit') {
				mode = 'edit';
			} else {
				mode = 'view';
			}
		}
	}

	// 초기 파싱
	parsePath();

	// 🔄 슬러그 변경 감지 (Svelte 5 클라이언트 라우팅 대응)
	let currentSlug = $state(slug);
	$effect(() => {
		if (slug !== currentSlug) {
			untrack(() => {
				currentSlug = slug;
				parsePath();

				// [하이드레이션] 클라이언트 네비게이션 시 새로운 initialData가 프로퍼티로 내려오면
				// 기존에 할당된 $state 들을 갱신해 주어야 합니다.
				if (initialData) {
					posts = initialData.posts || [];
					post = initialData.post || null;
					board = initialData.board || null;
					bindings = initialData.bindings || [];
					total = initialData.total || 0;
				}

				loadData();
			});
		}
	});

	// 컴포넌트 초기화 시 데이터 로드
	loadData();

	// --- [데이터 로드] ---
	async function loadData() {
		// [방어 코드] 이미 로딩 중이면 중복 실행 방지
		if (isLoading) return;

		if (!boardSlug) {
			errorMessage = '잘못된 접근입니다. 게시판 주소(Slug)를 입력해 주세요.';
			return;
		}

		// ✅ [핵심] SSR 데이터가 이미 있으면 API 재호출 없이 종료
		//    목록 모드: posts 배열 존재 여부로 판단
		//    상세 모드: post 객체 존재 여부로 판단
		const hasSSRData =
			initialData && (mode === 'list' ? posts.length > 0 : post !== null);

		if (hasSSRData) {
			console.log('🚀 [BoardEngine] SSR data hydrated — skipping API fetch');
			// SSR edit 모드: editForm은 빈 기본값으로 선언되었으므로 여기서 채움
			if (mode === 'edit' && post) {
				editForm = {
					title: post.title || '',
					content: post.content || '',
					content_json: post.content_json ?? null,
					extra_data: post.extra_data || {},
					status: post.status || 'published'
				};
			}
			return;
		}

		isLoading = true;
		errorMessage = '';
		try {
			// ✅ [Hardcoding Zero] 게시판 전용 API 대신 범용 데이터 API 호출
			const data = await adminGetAppData(appId, slug, { 
				page: currentPage - 1, 
				size: pageSize, 
				keyword: keyword 
			});

			if (mode === 'list') {
				const instance = data.instance || {};
				posts = instance.posts || [];
				board = data.parent_config || null;
				total = instance.total || 0;
				bindings = data.bindings || [];
			} else if (mode === 'view' || mode === 'edit') {
				post = data.instance || null;
				board = data.parent_config || null;
				bindings = data.bindings || [];

				if (mode === 'edit' && post) {
					editForm = {
						title: post.title,
						content: post.content,
						content_json: post.content_json,
						extra_data: post.extra_data || {},
						status: post.status || 'published'
					};
				}
			}
		} catch (e) {
			console.error('[BoardEngine] 데이터 로딩 실패:', e);
			// fastApi는 에러 시 객체({ detail: '...' })를 reject하므로 문자열로 추출
			const msg = e?.detail || e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
			errorMessage = `데이터를 불러오지 못했습니다: ${msg}`;
		} finally {
			isLoading = false;
		}
	}

	// --- [액션 핸들러] ---
	async function handleSave() {
		// --- [프론트엔드 유효성 검증] ---
		if (!editForm.title || !editForm.title.trim()) {
			alert('제목을 입력해주세요.');
			return;
		}
		
		// Tiptap 빈 태그(<p></p>)나 공백 문자 필터링
		const tempDiv = document.createElement('div');
		tempDiv.innerHTML = editForm.content;
		const textContent = tempDiv.textContent || tempDiv.innerText || '';
		
		if (!textContent.trim() && !editForm.content.includes('<img')) {
			alert('내용을 입력해주세요.');
			return;
		}
		// -----------------------------

		try {
			isLoading = true;
			if (mode === 'write') {
				await api.createPost(boardSlug, editForm);
			} else if (mode === 'edit') {
				await api.updatePost(postId, editForm);
			}
			goto(`/v1/app/${appId}/${boardSlug}`, { invalidateAll: true });
		} catch (e) {
			const msg = e?.detail || e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
			alert('저장 실패: ' + msg);
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete() {
		if (!confirm('정말 삭제하시겠습니까?')) return;
		try {
			isLoading = true;
			await api.deletePost(postId);
			window.alert('게시물이 삭제되었습니다.');
			goto(`/v1/app/${appId}/${boardSlug}`, { invalidateAll: true });
		} catch (e) {
			const msg = e?.detail || e?.message || (typeof e === 'string' ? e : JSON.stringify(e));
			alert('삭제 실패: ' + msg);
		} finally {
			isLoading = false;
		}
	}

	function goToEdit() {
		goto(`/v1/app/${appId}/${boardSlug}/${postId}/edit`);
	}

	function handlePageChange(p) {
		currentPage = p;
		loadData();
	}

	function handleSearch() {
		currentPage = 1;
		loadData();
	}

	/** 날짜 포맷팅 */
	function formatDate(dateStr) {
		if (!dateStr) return '-';
		const d = new Date(dateStr);
		return d.toLocaleDateString();
	}
</script>

<!-- 🎨 메인 디자인 컨테이너 -->
<div
	class="board-engine-container min-h-screen w-full bg-[#fafafa] p-4 font-['Outfit'] text-black md:p-8"
>
	{#if isLoading}
		<div
			class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white/80 backdrop-blur-sm"
		>
			<div
				class="h-16 w-16 animate-spin rounded-full border-8 border-black border-t-blue-600"
			></div>
			<p class="text-sm font-black tracking-widest uppercase italic opacity-40">
				Synchronizing Data...
			</p>
		</div>
	{/if}

	{#if errorMessage}
		<div
			class="animate-shake mx-auto mb-10 flex max-w-4xl items-center gap-6 border-4 border-black bg-red-50 p-10"
		>
			<Icon icon="ph:warning-circle-bold" class="h-14 w-14 flex-shrink-0 text-red-600" />
			<div>
				<h3 class="text-2xl font-black uppercase italic">System Fault</h3>
				<p class="font-bold opacity-60">{errorMessage}</p>
			</div>
		</div>
	{/if}

	<div class="mx-auto max-w-6xl space-y-12">
		{#if !boardSlug}
			<div
				class="flex h-[60vh] flex-col items-center justify-center gap-8 border-8 border-black bg-white p-20 text-center shadow-[30px_30px_0_rgba(239,68,68,0.1)]"
			>
				<Icon icon="ph:map-pin-line-bold" class="h-24 w-24 animate-bounce text-red-600" />
				<div class="space-y-4">
					<h2 class="text-6xl font-black tracking-tighter uppercase italic">
						Address <span class="NOT-ITALIC text-red-600">Fault</span>
					</h2>
					<p class="max-w-md text-lg leading-relaxed font-bold italic opacity-40">
						요청하신 경로가 불완전합니다. <br />서비스를 이용하려면 유효한 게시판 주소로 접속해
						주십시오.
					</p>
				</div>
				<a
					href="/v1/admin/boards"
					class="flex h-16 items-center justify-center bg-black px-10 font-black text-white uppercase italic transition-all hover:bg-blue-600"
				>
					Open Cluster Registry
				</a>
			</div>
		{:else}
			<!-- 📑 HEADER AREA -->
			<header
				class="flex flex-col items-start justify-between gap-8 border-b-8 border-black pb-10 md:flex-row md:items-end"
			>
				<div class="space-y-4">
					<div class="flex items-center gap-4">
						<span
							class="bg-black px-4 py-1 text-[10px] font-black tracking-widest text-white uppercase italic"
							>{mode} MODE</span
						>
						<span class="text-[10px] font-bold tracking-[0.3em] uppercase opacity-30"
							>Board Engine v2.0 / {boardSlug}</span
						>
					</div>
					<h1 class="mb-2 text-6xl leading-[0.8] font-black tracking-tighter uppercase italic">
						{board?.name || boardSlug || 'Loading...'}
					</h1>
					<p class="max-w-lg text-xs leading-relaxed font-bold italic opacity-40">
						{board?.description || '게시판 데이터를 동기화하는 중입니다.'}
					</p>
				</div>

				<div class="flex items-center gap-4">
					{#if mode === 'list'}
						<div
							class="group flex h-16 border-4 border-black transition-all focus-within:ring-4 focus-within:ring-blue-100"
						>
							<input
								type="text"
								bind:value={keyword}
								placeholder="SEARCH POSTS..."
								class="w-48 border-none bg-white px-6 text-sm font-black uppercase focus:outline-none md:w-64"
								onkeydown={(e) => e.key === 'Enter' && handleSearch()}
							/>
							<button
								class="flex items-center justify-center bg-black px-6 text-white transition-all hover:bg-blue-600"
								onclick={handleSearch}
							>
								<Icon icon="ph:magnifying-glass-bold" class="h-6 w-6" />
							</button>
						</div>
					{/if}

					<div class="flex gap-4">
						{#if mode === 'list'}
							<a
								href="/v1/app/{appId}/{boardSlug}/write"
								class="flex h-16 items-center justify-center border-4 border-black bg-blue-600 px-10 text-lg font-black text-white uppercase italic shadow-[8px_8px_0_rgba(0,0,0,1)] transition-all hover:translate-x-1 hover:translate-y-1 hover:bg-black hover:shadow-none"
							>
								New Post
							</a>
						{:else}
							<a
								href="/v1/app/{appId}/{boardSlug}"
								class="flex h-16 items-center justify-center border-4 border-black bg-white px-10 text-lg font-black text-black uppercase italic transition-all hover:bg-slate-100"
							>
								← List
							</a>
						{/if}
					</div>
				</div>
			</header>

			<!-- 📄 MAIN CONTENT AREA -->
			<main class="animate-fade-in">
				{#if mode === 'list'}
					<div class="flex flex-col gap-6">
						{#if posts.length === 0 && !isLoading}
							<div
								class="flex h-80 flex-col items-center justify-center gap-4 border-4 border-dashed border-black opacity-20 grayscale"
							>
								<Icon icon="ph:article-bold" class="h-20 w-20" />
								<p class="font-black tracking-widest uppercase italic">No Posts Found in Cluster</p>
							</div>
						{:else}
							<div class="grid grid-cols-1 gap-6">
								{#each posts as p}
									<a
										href="/v1/app/{appId}/{boardSlug}/{p.id}"
										class="group relative block overflow-hidden border-4 border-black bg-white p-8 transition-all hover:-translate-x-1 hover:-translate-y-1 hover:bg-slate-50 hover:shadow-[12px_12px_0_rgba(37,99,235,1)]"
									>
										<div class="mb-6 flex items-start justify-between">
											<div class="flex items-center gap-3">
												<span
													class="rounded bg-slate-100 px-2 py-1 font-mono text-[10px] font-black"
													>NO.{p.id}</span
												>
												<span class="text-[10px] font-black tracking-widest uppercase opacity-30"
													>{formatDate(p.created_at)}</span
												>
											</div>
											<span
												class="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase opacity-0 transition-opacity group-hover:opacity-100"
											>
												Read Article <Icon icon="ph:arrow-right-bold" />
											</span>
										</div>
										<h3
											class="mb-3 line-clamp-1 text-3xl font-black tracking-tight uppercase transition-colors group-hover:text-blue-600"
										>
											{p.title}
										</h3>
										<p
											class="line-clamp-2 max-w-3xl text-xs leading-relaxed font-bold italic opacity-40"
										>
											{p.content.replace(/<[^>]*>/g, '') || '본문 내용이 없습니다.'}
										</p>
									</a>
								{/each}
							</div>

							<!-- 🔢 PAGINATION -->
							{#if total > pageSize}
								<div class="flex items-center justify-center gap-2 pt-12">
									{#each Array(Math.ceil(total / pageSize)) as _, i}
										<button
											class="h-14 w-14 border-4 border-black text-lg font-black transition-all {currentPage ===
											i + 1
												? 'bg-black text-white'
												: 'bg-white hover:bg-slate-100'}"
											onclick={() => handlePageChange(i + 1)}
										>
											{i + 1}
										</button>
									{/each}
								</div>
							{/if}
						{/if}
					</div>
				{:else if mode === 'view'}
					{#if !post && !isLoading}
						<!-- 게시물 없음 상태 -->
						<div
							class="flex h-80 flex-col items-center justify-center gap-6 border-4 border-dashed border-black opacity-30"
						>
							<Icon icon="ph:file-dashed-bold" class="h-20 w-20" />
							<p class="font-black tracking-widest uppercase italic">Post Not Found</p>
							<a
								href="/v1/app/{appId}/{boardSlug}"
								class="border-2 border-black px-6 py-2 text-xs font-black uppercase hover:bg-black hover:text-white"
							>
								← Back to List
							</a>
						</div>
					{:else if post}
						<article class="mx-auto max-w-4xl" in:fade={{ duration: 300 }}>
							<!-- 🔙 상단 브레드크럼 네비게이션 -->
							<nav class="mb-10 flex items-center gap-3 text-[10px] font-black tracking-widest uppercase">
								<a
									href="/v1/app/{appId}/{boardSlug}"
									class="flex items-center gap-1 text-blue-600 opacity-70 transition-opacity hover:opacity-100"
								>
									<Icon icon="ph:caret-left-bold" class="h-3 w-3" />
									{board?.name || boardSlug}
								</a>
								<span class="opacity-20">/</span>
								<span class="opacity-40">NO.{post.id}</span>
							</nav>

							<!-- 📋 게시물 헤더 블록 -->
							<header class="mb-10 space-y-6 border-b-4 border-black pb-10">
								<!-- 상태 뱃지 -->
								{#if post.status && post.status !== 'published'}
									<span
										class="inline-block bg-yellow-400 px-3 py-1 text-[9px] font-black tracking-widest uppercase"
									>
										{post.status}
									</span>
								{/if}

								<!-- 제목 -->
								<h1
									class="border-l-8 border-black pl-8 text-5xl leading-tight font-black tracking-tighter md:text-6xl"
								>
									{post.title}
								</h1>

								<!-- 메타 정보 행 -->
								<div class="flex flex-wrap items-center gap-x-8 gap-y-3 text-xs font-bold">
									<div class="flex items-center gap-2 opacity-50">
										<Icon icon="ph:user-circle-bold" class="h-4 w-4" />
										<span class="bg-black px-2 py-0.5 text-[9px] text-white uppercase">AUTHOR</span>
										<span>{post.author_name || 'ANONYMOUS'}</span>
									</div>
									<div class="flex items-center gap-2 opacity-40">
										<Icon icon="ph:calendar-blank-bold" class="h-4 w-4" />
										<span>{formatDate(post.created_at)}</span>
									</div>
									{#if post.updated_at && post.updated_at !== post.created_at}
										<div class="flex items-center gap-2 opacity-30">
											<Icon icon="ph:pencil-line-bold" class="h-4 w-4" />
											<span>수정됨 {formatDate(post.updated_at)}</span>
										</div>
									{/if}
									<div class="ml-auto flex items-center gap-2 opacity-40">
										<Icon icon="ph:eye-bold" class="h-4 w-4" />
										<span>{post.view_count || 0} VIEWS</span>
									</div>
								</div>
							</header>

							<!-- 📄 본문 콘텐츠 -->
							<section
								class="mb-12 border-4 border-black bg-white p-8 shadow-[16px_16px_0_rgba(0,0,0,0.04)] md:p-14"
							>
								<div
									class="prose prose-lg max-w-none font-['Noto_Sans_KR'] leading-relaxed"
								>
									{@html post.content}
								</div>
							</section>

							<!-- 🗂 extra_data 필드 표시 (있는 경우) -->
							{#if post.extra_data && Object.keys(post.extra_data).length > 0}
								<section class="mb-10 border-4 border-black bg-slate-50 p-8">
									<h3
										class="mb-6 border-b-2 border-black pb-3 text-xs font-black tracking-[0.3em] uppercase"
									>
										<Icon icon="ph:list-dashes-bold" class="inline h-4 w-4" /> Additional
										Fields
									</h3>
									<dl class="grid grid-cols-1 gap-4 md:grid-cols-2">
										{#each Object.entries(post.extra_data) as [key, val]}
											<div class="border-2 border-black bg-white p-4">
												<dt
													class="mb-1 text-[9px] font-black tracking-widest uppercase opacity-40"
												>
													{key}
												</dt>
												<dd class="text-sm font-bold">{val}</dd>
											</div>
										{/each}
									</dl>
								</section>
							{/if}

							<!-- 🔧 액션 푸터 -->
							<footer
								class="flex flex-wrap items-center justify-between gap-4 border-4 border-black bg-slate-100 p-6 md:p-8"
							>
								<div class="flex flex-wrap gap-3">
									<button
										class="flex h-12 items-center gap-2 border-2 border-black bg-white px-6 text-xs font-black uppercase transition-all hover:bg-black hover:text-white"
										onclick={goToEdit}
									>
										<Icon icon="ph:pencil-simple-bold" class="h-4 w-4" /> Modify
									</button>
									<button
										class="flex h-12 items-center gap-2 border-2 border-red-500 bg-white px-6 text-xs font-black text-red-600 uppercase transition-all hover:bg-red-600 hover:text-white"
										onclick={handleDelete}
									>
										<Icon icon="ph:trash-bold" class="h-4 w-4" /> Delete
									</button>
								</div>
								<a
									href="/v1/app/{appId}/{boardSlug}"
									class="flex h-12 items-center gap-2 bg-black px-8 text-xs font-black text-white uppercase transition-all hover:bg-slate-800"
								>
									<Icon icon="ph:list-bold" class="h-4 w-4" /> Return to List
								</a>
							</footer>

							<!-- 💬 Dynamic Service Bindings (댓글 등) -->
							{#if bindings && bindings.length > 0}
								<div class="mt-16 space-y-10 pb-24">
									{#each bindings as binding (binding.service_component)}
										{#if engines[binding.service_component]}
											{@const DynComp = engines[binding.service_component]}
											<div
												class="border-t-4 border-black pt-10"
												in:fly={{ y: 20, duration: 400 }}
											>
												<p
													class="mb-6 text-[9px] font-black tracking-[0.4em] uppercase opacity-30"
												>
													{binding.service_component}
												</p>
												<DynComp
													{post}
													{appId}
													instanceId={postId}
													config={binding.config}
												/>
											</div>
										{/if}
									{/each}
								</div>
							{/if}
						</article>
					{/if}
				{:else if mode === 'write' || mode === 'edit'}
					<div class="mx-auto max-w-5xl">
						<div class="border-8 border-black bg-white p-10 md:p-16">
							<div class="mb-12 flex items-baseline justify-between border-b-4 border-black pb-6">
								<h2 class="text-4xl font-black tracking-tighter uppercase italic">
									Cluster Entry / <span class="text-blue-600">{mode}</span>
								</h2>
								<span class="text-[10px] font-black tracking-[0.3em] uppercase opacity-30"
									>Protocol_v2.0</span
								>
							</div>

							<div class="space-y-10">
								<div class="space-y-3">
									<label
										class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30"
									>
										<Icon icon="ph:text-t-bold" class="h-4 w-4" /> Entry Title
									</label>
									<input
										type="text"
										bind:value={editForm.title}
										class="h-20 w-full border-4 border-black bg-[#fafafa] px-8 text-3xl font-black uppercase transition-all placeholder:opacity-20 focus:bg-white focus:ring-8 focus:ring-blue-100 focus:outline-none"
										placeholder="TYPE YOUR TITLE..."
									/>
								</div>

								<!-- --- [동적 커스텀 필드 영역] --- -->
								{#if board?.fields_def && board.fields_def.length > 0}
									<div class="grid grid-cols-1 gap-8 border-y-2 border-black/5 py-10 md:grid-cols-2">
										{#each board.fields_def as field}
											<div class="space-y-3">
												<label class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30">
													<Icon icon="ph:tag-bold" class="h-4 w-4" /> {field.label}
												</label>
												{#if field.type === 'number'}
													<input type="number" bind:value={editForm.extra_data[field.key]} class="h-14 w-full border-2 border-black bg-white px-5 font-bold focus:outline-none focus:ring-4 focus:ring-blue-50" />
												{:else if field.type === 'date'}
													<input type="date" bind:value={editForm.extra_data[field.key]} class="h-14 w-full border-2 border-black bg-white px-5 font-bold focus:outline-none focus:ring-4 focus:ring-blue-50" />
												{:else if field.type === 'select'}
													<select bind:value={editForm.extra_data[field.key]} class="h-14 w-full border-2 border-black bg-white px-5 font-black focus:outline-none focus:ring-4 focus:ring-blue-50">
														<option value="">-- 선택하세요 --</option>
														{#each (field.options_text || '').split(',').map(s => s.trim()) as opt}
															{#if opt}
																<option value={opt}>{opt}</option>
															{/if}
														{/each}
													</select>
												{:else}
													<input type="text" bind:value={editForm.extra_data[field.key]} placeholder={field.placeholder || ''} class="h-14 w-full border-2 border-black bg-white px-5 font-bold focus:outline-none focus:ring-4 focus:ring-blue-50" />
												{/if}
											</div>
										{/each}
									</div>
								{/if}

								<div class="space-y-3">
									<label
										class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30"
									>
										<Icon icon="ph:article-bold" class="h-4 w-4" /> Entry Content
									</label>
									<div class="min-h-[500px] border-4 border-black">
										<TiptapEditor bind:content={editForm.content} bind:content_json={editForm.content_json} />
									</div>
								</div>

								<div class="flex flex-col gap-6 pt-10 md:flex-row">
									<button
										class="group flex h-24 flex-1 items-center justify-center gap-4 border-4 border-black bg-blue-600 text-2xl font-black tracking-[0.2em] text-white uppercase transition-all hover:bg-black disabled:opacity-50"
										onclick={handleSave}
										disabled={isLoading}
									>
										{#if isLoading}
											<span class="loading loading-spinner"></span> SYNCING...
										{:else}
											<Icon
												icon="ph:paper-plane-tilt-bold"
												class="h-8 w-8 transition-transform group-hover:rotate-12"
											/>
											{mode === 'write' ? 'Authorize Entry' : 'Update Record'}
										{/if}
									</button>
									<a
										href="/v1/app/{appId}/{boardSlug}"
										class="flex h-24 items-center justify-center border-4 border-black px-10 text-xs font-black tracking-[0.3em] uppercase transition-all hover:bg-slate-100"
									>
										Abort Process
									</a>
								</div>
							</div>
						</div>
					</div>
				{/if}
			</main>
		{/if}
	</div>
</div>

<style>
	:global(.prose) {
		max-width: none;
	}
	:global(.prose img) {
		border: 4px solid black;
		box-shadow: 15px 15px 0 rgba(0, 0, 0, 0.05);
	}
</style>
