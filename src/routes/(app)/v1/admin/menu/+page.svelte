<script>
	// @ts-nocheck
	/**
	 * @file (app)/v1/admin/menu/+page.svelte
	 * @description 시스템 메뉴 아키텍처 실시간 편집기 (v2.2 최종 통합 버전)
	 */
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import * as api from '$lib/api/admin.js';
	import { adminGetPages } from '$lib/api/page.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { browser } from '$app/environment';

	let menus = $state([]);
	let apps = $state([]);
	let boards = $state([]);
	let pages = $state([]);
	let loading = $state(true);

	let editingMenu = $state({
		id: '',
		parent_id: '',
		title: '',
		icon_name: '🚀',
		link_type: 'APP',
		external_url: '',
		app_id: '',
		app_instance_id: '',
		page_mode: 'user', // UI 전용: user | admin
		order: 0,
		is_visible: true,
		min_rank: 0
	});

	// 🔗 [계단식 프리뷰] 백엔드 resolve_menu_url 규칙과 동기화
	function getRecursiveUrl(menu) {
		if (!menu) return '';
		if (menu.link_type === 'FOLDER' || menu.link_type === 'DIVIDER') return '#';

		let currentPath = '';
		// [v2.2] URL만 수동 입력 주소 사용
		if (menu.link_type === 'URL') {
			currentPath = menu.external_url || '';
		} else if ((menu.link_type === 'APP' || menu.link_type === 'CUSTOM') && menu.app_id) {
			// 관리자 여부 판별
			const is_admin = menu.app_instance_id == -1 || menu.page_mode === 'admin';
			const prefix = is_admin ? 'admin' : menu.link_type === 'CUSTOM' ? 'custom' : 'app';
			
			let instancePath = '';
			if (menu.app_instance_id && menu.app_instance_id != -1) {
				if (menu.app_id === 'board') {
					const target = boards.find(b => b.id == menu.app_instance_id);
					instancePath = target ? `/${target.slug}` : `/${menu.app_instance_id}`;
				} else if (menu.app_id === 'page') {
					const target = pages.find(p => p.id == menu.app_instance_id);
					instancePath = target ? `/${target.slug}` : `/${menu.app_instance_id}`;
				} else {
					instancePath = `/${menu.app_instance_id}`;
				}
			}
			currentPath = `/v1/${prefix}/${menu.app_id}${instancePath}`;
		}

		if (menu.parent_id) {
			const findParent = (list, pid) => {
				for (let m of list) {
					if (m.id === pid) return m;
					if (m.sub_menus) {
						const found = findParent(m.sub_menus, pid);
						if (found) return found;
					}
				}
				return null;
			};
			const parent = findParent(menus, menu.parent_id);
			if (parent) {
				const parentUrl = getRecursiveUrl(parent);
				const pBase = parentUrl.endsWith('/') ? parentUrl.slice(0, -1) : parentUrl;
				const cBase = currentPath.startsWith('/') ? currentPath : '/' + currentPath;
				return pBase + cBase;
			}
		}
		return currentPath;
	}

	let predictedUrl = $derived(getRecursiveUrl(editingMenu) || '(입력 대기...)');

	async function loadData() {
		loading = true;
		try {
			const [m, a, b, p] = await Promise.all([
				api.adminGetMenus(),
				api.adminGetApps(),
				api.adminGetBoards(),
				adminGetPages()
			]);
			menus = m;
			apps = a;
			boards = b;
			pages = p;
		} catch (e) {
			alertState.send(e.message || '데이터 로드 실패', { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (browser) loadData();
	});

	function startEdit(m) {
		editingMenu = {
			...m,
			parent_id: m.parent_id || '',
			app_id: m.app_id || '',
			app_instance_id: m.app_instance_id ?? '',
			page_mode: m.app_instance_id == -1 || m.external_url?.includes('/admin/') ? 'admin' : 'user'
		};
		document.getElementById('form-anchor')?.scrollIntoView({ behavior: 'smooth' });
	}

	function resetForm(event) {
		if (event?.preventDefault) event.preventDefault();
		editingMenu = {
			id: '',
			parent_id: '',
			title: '',
			icon_name: '🚀',
			link_type: 'APP',
			external_url: '',
			app_id: '',
			app_instance_id: '',
			page_mode: 'user',
			order: 0,
			is_visible: true,
			min_rank: 0
		};
	}

	async function handleSave() {
		try {
			const data = { ...editingMenu };

			// 🧹 [v2.2] 관리자 모드이면서 인스턴스 미지정 시 -1로 강제 (백엔드 규격)
			if (
				data.page_mode === 'admin' &&
				(data.app_instance_id === '' || data.app_instance_id === null)
			) {
				data.app_instance_id = -1;
			}

			// 빈 값 처리
			for (const key in data) {
				if (data[key] === '') data[key] = null;
			}

			if (!data.id) {
				await api.adminCreateMenu(data);
				alertState.send('등록 완료', { level: 1, style: 'success' });
			} else {
				await api.adminUpdateMenu(data.id, data);
				alertState.send('수정 완료', { level: 1, style: 'success' });
			}
			resetForm();
			await loadData();
		} catch (e) {
			alertState.send(e.message || '저장 실패', { level: 3, style: 'error' });
		}
	}

	async function handleDelete(menuId) {
		if (!confirm('삭제하시겠습니까?')) return;
		try {
			await api.adminDeleteMenu(menuId);
			alertState.send('삭제 완료', { level: 1, style: 'success' });
			await loadData();
		} catch (e) {
			alertState.send('삭제 실패', { level: 3, style: 'error' });
		}
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-10 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] text-black"
>
	<!-- 📄 상단 헤더 -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] uppercase opacity-30"
				>Navigation Architecture</span
			>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				메뉴 <span class="NOT-ITALIC text-blue-600">마스터</span>
			</h1>
			<p
				class="mt-3 text-xs font-bold italic underline decoration-blue-200 underline-offset-4 opacity-40"
			>
				Standard Layer: {predictedUrl.includes('admin') ? 'ADMIN' : 'APP'}
			</p>
		</div>
		<div class="flex gap-2">
			<a
				href="/v1/admin"
				class="btn flex h-14 items-center gap-2 rounded-none border-black px-8 font-black btn-outline"
				><span>←</span> 대시보드</a
			>
			<button
				class="btn-black btn h-14 rounded-none border border-black px-10 font-black transition-all hover:bg-white hover:text-black"
				onclick={loadData}>갱신</button
			>
		</div>
	</div>

	<div class="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
		<!-- 🌳 [Left] 메뉴 트리 -->
		<div class="space-y-4 lg:col-span-5">
			<div class="mb-6 flex items-center justify-between border-b-2 border-black pb-2">
				<h3 class="text-xl font-black italic">현재 메뉴 구성</h3>
				<button
					class="text-[10px] font-black tracking-widest underline opacity-40 hover:opacity-100"
					onclick={resetForm}>+ 최상위 메뉴 추가</button
				>
			</div>
			{#if loading}
				<div
					class="flex h-80 items-center justify-center border border-dashed border-black font-black uppercase italic opacity-10 grayscale"
				>
					데이터 동기화 중...
				</div>
			{:else}
				<div class="space-y-4">
					{#each menus as m (m.id)}
						<div
							class="group border-2 border-black bg-white p-4 transition-all {editingMenu.id ===
							m.id
								? 'border-blue-600 bg-blue-50'
								: ''}"
						>
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-4">
									<span class="text-2xl">{m.icon_name || '🔹'}</span>
									<div>
										<div class="text-lg leading-none font-black tracking-tight">{m.title}</div>
										<div
											class="mt-1 text-[9px] font-bold tracking-widest uppercase italic opacity-30"
										>
											{m.external_url || '#'}
										</div>
									</div>
								</div>
								<div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
									<button
										class="btn rounded-none border border-black/10 text-[9px] font-black btn-ghost btn-xs"
										onclick={() => startEdit(m)}>수정</button
									>
									<button
										class="btn rounded-none border border-black/10 text-[9px] font-black btn-ghost btn-xs hover:bg-red-600 hover:text-white"
										onclick={() => handleDelete(m.id)}>삭제</button
									>
								</div>
							</div>
							{#if m.sub_menus && m.sub_menus.length > 0}
								<div class="mt-4 ml-8 space-y-2 border-t border-black/5 pt-4">
									{#each m.sub_menus as sub (sub.id)}
										<div
											class="flex items-center justify-between border border-black/10 bg-slate-50/50 p-2 transition-colors hover:border-black/50"
										>
											<div class="flex items-center gap-3">
												<span class="text-xs opacity-50">└</span>
												<span class="text-sm font-bold tracking-tight">{sub.title}</span>
											</div>
											<div class="flex gap-3">
												<button
													class="text-[9px] font-black underline"
													onclick={() => startEdit(sub)}>수정</button
												>
												<button
													class="text-[9px] font-black text-red-400 underline"
													onclick={() => handleDelete(sub.id)}>삭제</button
												>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 📝 [Right] 설정 폼 -->
		<div class="lg:col-span-7" id="form-anchor">
			<div
				class="sticky top-24 border-2 border-black bg-white p-10 shadow-[15px_15px_0_rgba(0,0,0,0.05)]"
			>
				<div class="mb-12 flex items-baseline justify-between border-b-2 border-black pb-4">
					<h3 class="text-3xl font-black italic">
						{editingMenu.id ? '메뉴 정보 수정' : '메뉴 신규 등록'}
					</h3>
					<span class="text-[9px] font-black tracking-[0.2em] uppercase italic opacity-40"
						>System Logic v2.2</span
					>
				</div>

				<div class="space-y-8">
					<div class="space-y-2">
						<label for="menu-parent" class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>상위 메뉴 (소속 그룹)</label
						>
						<select
							id="menu-parent"
							bind:value={editingMenu.parent_id}
							class="h-14 w-full border border-black bg-white px-4 text-sm font-black transition-all focus:bg-slate-50"
						>
							<option value="">-- 최상위 메뉴 (그룹 없음) --</option>
							{#each menus as m}
								{#if m.id !== editingMenu.id}
									<option value={m.id}>📂 {m.title} (ID: {m.id})</option>
								{/if}
							{/each}
						</select>
					</div>

					<div class="space-y-2">
						<label for="menu-title" class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>표시될 메뉴 이름</label
						>
						<input
							id="menu-title"
							type="text"
							bind:value={editingMenu.title}
							class="h-14 w-full border border-black bg-slate-50 px-5 text-xl font-black transition-all focus:bg-white focus:outline-none"
							placeholder="이름 입력"
						/>
					</div>

					<div class="grid grid-cols-2 gap-8">
						<div class="space-y-2">
							<label for="menu-type" class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>연결 방식 (타입)</label
							>
							<select
								id="menu-type"
								bind:value={editingMenu.link_type}
								class="h-14 w-full border border-black bg-slate-50 px-4 text-sm font-black transition-all focus:bg-white focus:outline-none"
							>
								<option value="APP">⚙️ 시스템 엔진/앱 (표준)</option>
								<option value="CUSTOM">🛠️ 커스텀 앱 (CUSTOM)</option>
								<option value="URL">🔗 고정 주소 (외부/정적)</option>
								<option value="FOLDER">📁 메뉴 그룹 (폴더)</option>
								<option value="DIVIDER">➖ 구분선</option>
							</select>
						</div>
						<div class="space-y-2">
							<label for="menu-rank" class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>필요 등급</label
							>
							<select
								id="menu-rank"
								bind:value={editingMenu.min_rank}
								class="h-14 w-full border border-black bg-slate-50 px-4 text-sm font-black"
							>
								<option value={0}>전체 (R0)</option>
								<option value={1}>직원 (R1)</option>
								<option value={2}>관리자 (R2)</option>
								<option value={4}>마스터 (R4)</option>
							</select>
						</div>
					</div>

					<!-- ⚙️ 엔진 설정 통합 섹션 (APP & CUSTOM 공유) -->
					{#if editingMenu.link_type === 'APP' || editingMenu.link_type === 'CUSTOM'}
						<div class="space-y-6 border-2 border-black bg-blue-50/50 p-8" in:fade>
							<!-- 1. 서비스 엔진 선택 -->
							<div class="space-y-2">
								<label for="menu-app-id" class="text-[9px] font-black tracking-widest text-blue-600 uppercase"
									>1. 서비스 엔진 선택</label
								>
								<select
									id="menu-app-id"
									bind:value={editingMenu.app_id}
									class="h-12 w-full border border-black px-4 text-sm font-black transition-all focus:bg-white"
								>
									<option value="">-- 연결할 앱 엔진 선택 --</option>
									{#each apps as app}
										<option value={app.app_id}>{app.title || app.name} ({app.app_id})</option>
									{/each}
								</select>
							</div>

							<!-- 2. 상세 인스턴스 / 관리자 (단일 셀렉트) -->
							<div class="space-y-2">
								<label for="menu-instance" class="text-[9px] font-black tracking-widest text-blue-600 uppercase"
									>2. 상세 인스턴스 / 관리자</label
								>
								<select
									id="menu-instance"
									bind:value={editingMenu.app_instance_id}
									class="h-12 w-full border border-black bg-white px-4 text-sm font-black transition-all focus:bg-slate-50"
								>
									<option value="-1">🛠️ 관리자 (Admin Dashboard)</option>
									<option disabled>────────────────────</option>
									<option value="">👤 사용자 (General Main)</option>
									{#if editingMenu.app_id === 'board'}
										{#each boards as b}
											<option value={b.id}>📑 게시판: {b.name} ({b.id})</option>
										{/each}
									{/if}
									{#if editingMenu.app_id === 'page'}
										{#each pages as p}
											<option value={p.id}>📄 페이지: {p.title} ({p.id})</option>
										{/each}
									{/if}
								</select>
							</div>
						</div>
					{:else if editingMenu.link_type === 'URL'}
						<!-- 🔗 순수 고정 주소 -->
						<div class="space-y-4 border-2 border-black bg-slate-50 p-8" in:fade>
							<div class="space-y-2">
								<label for="menu-url" class="text-[10px] font-black tracking-widest text-black uppercase"
									>고정 경로/URL 직접 입력</label
								>
								<input
									id="menu-url"
									type="text"
									bind:value={editingMenu.external_url}
									class="h-14 w-full border border-black bg-white px-5 text-sm font-bold focus:outline-none"
									placeholder="/my-custom-path"
								/>
							</div>
						</div>
					{/if}

					<div class="space-y-2">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>실시간 경로 프리뷰 (시스템 예측)</label
						>
						<div
							class="flex h-12 w-full items-center truncate overflow-hidden bg-slate-900 px-4 font-mono text-[10px] font-black text-yellow-400 italic"
						>
							{predictedUrl}
						</div>
					</div>

					<div class="grid grid-cols-2 gap-8">
						<div class="space-y-2">
							<label for="menu-order" class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>정렬 순서</label
							>
							<input
								id="menu-order"
								type="number"
								bind:value={editingMenu.order}
								class="h-14 w-full border border-black px-4 font-black"
							/>
						</div>
						<div class="space-y-2">
							<label for="menu-visible" class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>가시성</label
							>
							<div class="flex h-14 w-full items-center border border-black px-4">
								<input
									id="menu-visible"
									type="checkbox"
									bind:checked={editingMenu.is_visible}
									class="checkbox mr-4"
								/>
								<span class="text-lg font-black tracking-widest uppercase"
									>{editingMenu.is_visible ? 'Visible' : 'Hidden'}</span
								>
							</div>
						</div>
					</div>

					<div class="flex gap-4 pt-10">
						<button
							class="h-20 flex-1 border-2 border-black bg-black text-xl font-black text-white transition-all hover:bg-white hover:text-black"
							onclick={handleSave}>레이어 저장</button
						>
						<button
							class="h-20 w-24 border-2 border-black text-[10px] font-black uppercase"
							onclick={resetForm}>초기화</button
						>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.checkbox) {
		border-radius: 0;
		border: 2px solid black;
	}
	:global(.btn) {
		border-radius: 0;
	}
	input:focus,
	select:focus {
		outline: none;
		box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
	}
</style>
