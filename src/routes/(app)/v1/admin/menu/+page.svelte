<script>
	// @ts-nocheck

	console.log('Menu page script initiated!'); // 추가된 로그
	/**
	 * @file (app)/v1/admin/menu/+page.svelte
	 * @description 시스템 메뉴 아키텍처 실시간 편집기 (한글화 세션)
	 */
	import { onMount, untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { browser } from '$app/environment'; // browser import 추가
	let menus = $state([]);
	let apps = $state([]);
	let boards = $state([]);
	let loading = $state(true);
	let editingMenu = $state({
		id: '',
		parent_id: '',
		title: '',
		icon_name: '🚀',
		link_type: 'URL',
		external_url: '',
		app_id: '',
		app_instance_id: '',
		order: 0,
		is_visible: true,
		min_rank: 0
	});
	// 🔗 [계단식 프리뷰] 부모의 경로를 추적하여 최종 합산 주소 계산
	function getRecursiveUrl(menu) {
		if (!menu) return '';
		if (menu.link_type === 'FOLDER') return '#'; // 그룹(폴더)은 링크가 없음
		let currentPath = '';
		if (menu.link_type === 'URL') currentPath = menu.external_url || '';
		else if (menu.link_type === 'APP' && menu.app_id) {
			const app = apps.find((a) => a.app_id === menu.app_id);
			if (app) {
				currentPath = app.frontend_route || '';
				if (menu.app_id === 'board' && menu.app_instance_id) {
					const board = boards.find((b) => b.id === Number(menu.app_instance_id));
					if (board) currentPath = currentPath.replace('[slug]', board.slug);
				}
				currentPath = currentPath.replace(/\/\(.*?\)/, ''); // [appId] 경로가 아닌 [...slug] 처럼 동적 세그먼트 제거
			}
		} else if (menu.link_type === 'CUSTOM' && menu.app_id) {
			// CUSTOM 앱 처리 추가
			const app = apps.find((a) => a.app_id === menu.app_id);
			if (app && app.app_type === 'STATIC') {
				// STATIC 타입 앱만 CUSTOM으로 연결
				currentPath = `/v1/custom/${app.app_id}`;
			}
		}
		// 부모가 있다면 부모의 주소를 먼저 가져와서 합칩니다.
		if (menu.parent_id) {
			// 전체 메뉴 목록에서 부모를 찾음 (중첩 트리 구조 고려)
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
				// 주소 합치기 (슬래시 중복 방지)
				return (
					(parentUrl.endsWith('/') ? parentUrl.slice(0, -1) : parentUrl) +
					(currentPath.startsWith('/') ? currentPath : '/' + currentPath)
				);
			}
		}
		return currentPath;
	}
	let predictedUrl = $derived(getRecursiveUrl(editingMenu) || '(타입 선택 필요)');
	async function loadData() {
		console.log('loadData called, attempting API calls...');
		loading = true;
		try {
			const [m, a, b] = await Promise.all([
				api.adminGetMenus(),
				api.adminGetApps(),
				api.adminGetBoards()
			]);
			menus = m;
			apps = a;
			boards = b;
		} catch (e) {
			let errorMessage = '알 수 없는 오류가 발생했습니다.';
			if (typeof e === 'object' && e !== null) {
				if (
					Array.isArray(e.detail) &&
					e.detail.every((item) => typeof item === 'object' && item.msg)
				) {
					errorMessage = '유효성 검사 오류: ' + e.detail.map((item) => item.msg).join('; ');
				} else if (typeof e.detail === 'string') {
					errorMessage = e.detail;
				} else if (e.message) {
					// Standard Error object
					errorMessage = e.message;
				}
			} else {
				// Fallback for non-object errors
				errorMessage = String(e);
			}
			alertState.send(errorMessage, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (browser) {
			// 브라우저 환경에서만 실행되도록 보호 (하이드레이션 문제 방지)
			console.log('Menu page onMount is running!');
			loadData();
		}
	});

	function startEdit(m) {
		editingMenu = {
			...m,
			parent_id: m.parent_id || '',
			app_id: m.app_id || '',
			app_instance_id: m.app_instance_id || ''
		};
		// CUSTOM 앱 선택 시 external_url 자동 설정 (편의성)
		if (editingMenu.link_type === 'CUSTOM' && editingMenu.app_id) {
			editingMenu.external_url = `/v1/custom/${editingMenu.app_id}`;
		}

		document.getElementById('form-anchor')?.scrollIntoView({ behavior: 'smooth' });
	}

	function addSub(parentId) {
		resetForm();
		editingMenu.parent_id = parentId;
		document.getElementById('form-anchor')?.scrollIntoView({ behavior: 'smooth' });
	}

	function resetForm(event) {
		event.preventDefault();
		editingMenu = {
			id: '',
			parent_id: '',
			title: '',
			icon_name: '🚀',
			link_type: 'URL',
			external_url: '',
			app_id: '',
			app_instance_id: '',
			order: 0,
			is_visible: true,
			min_rank: 0
		};
	}

	async function handleSave() {
		console.log('handleSave called!');
		try {
			const data = { ...editingMenu };
			for (const key in data) {
				if (data[key] === '') {
					data[key] = null;
				}
			}
			// CUSTOM 앱인 경우 external_url 자동 설정
			if (data.link_type === 'CUSTOM' && data.app_id) {
				data.external_url = `/v1/custom/${data.app_id}`;
			}
			if (!data.id) {
				await api.adminCreateMenu(data);

				alertState.send('새 메뉴가 등록되었습니다.', { level: 1, style: 'success' });
			} else {
				await api.adminUpdateMenu(data.id, data);
				alertState.send('메뉴 정보가 업데이트되었습니다.', { level: 1, style: 'success' });
			}
			resetForm();
			console.log('handleSave - Form reset, calling loadData...'); // Log 6
			await loadData();
			console.log('handleSave - loadData completed!'); // Log 7
		} catch (e) {
			console.error('handleSave - Error caught:', e); // Log 8
			let errorMessage = '알 수 없는 오류가 발생했습니다.';
			if (typeof e === 'object' && e !== null) {
				if (
					Array.isArray(e.detail) &&
					e.detail.every((item) => typeof item === 'object' && item.msg)
				) {
					errorMessage = '유효성 검사 오류: ' + e.detail.map((item) => item.msg).join('; ');
				} else if (typeof e.detail === 'string') {
					errorMessage = e.detail;
				} else if (e.message) {
					// Standard Error object
					errorMessage = e.message;
				}
			} else {
				// Fallback for non-object errors
				errorMessage = String(e);
			}
			alertState.send(errorMessage, { level: 3, style: 'error' });
		}
	}
	async function handleDelete(menuId) {
		if (!confirm('정말로 이 메뉴를 삭제하시겠습니까? 관련 하위 메뉴도 모두 삭제됩니다.')) {
			return;
		}
		try {
			await api.adminDeleteMenu(menuId);
			alertState.send('메뉴가 성공적으로 삭제되었습니다.', { level: 1, style: 'success' });
			await loadData(); // 메뉴 목록 새로고침
		} catch (e) {
			console.error('handleDelete - Error caught:', e);
			let errorMessage = '메뉴 삭제 중 오류가 발생했습니다.';
			if (typeof e === 'object' && e !== null && e.detail) {
				if (
					Array.isArray(e.detail) &&
					e.detail.every((item) => typeof item === 'object' && item.msg)
				) {
					errorMessage = '유효성 검사 오류: ' + e.detail.map((item) => item.msg).join('; ');
				} else if (typeof e.detail === 'string') {
					errorMessage = e.detail;
				} else if (e.message) {
					// Standard Error object
					errorMessage = e.message;
				}
			} else {
				// Fallback for non-object errors
				errorMessage = String(e);
			}
			alertState.send(errorMessage, { level: 3, style: 'error' });
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
			<p class="mt-3 text-xs font-bold opacity-40">
				사용자 사이드바 메뉴와 연결된 서비스 엔진을 실시간으로 관리합니다.
			</p>
		</div>
		<div class="flex gap-2">
			<a
				href="/v1/admin"
				class="btn flex h-14 items-center gap-2 rounded-none border-black px-8 font-black btn-outline"
			>
				<span>←</span> 대시보드
			</a>
			<button
				class="btn-black btn h-14 rounded-none border border-black px-10 font-black transition-all hover:bg-white hover:text-black"
				onclick={loadData}
			>
				데이터 갱신
			</button>
		</div>
	</div>
	<div class="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
		<!-- 🌳 [Left] 메뉴 트리 레이아웃 -->
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
					아키텍처 분석 중...
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
										<div class="mt-1 text-[9px] font-bold tracking-widest uppercase opacity-30">
											{m.link_type} | 등급 {m.min_rank} 이상
										</div>
									</div>
								</div>
								<div class="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
									<button
										class="btn rounded-none border border-black/10 text-[9px] font-black btn-ghost btn-xs"
										onclick={() => addSub(m.id)}>하위 추가</button
									>
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
							<!-- Recursive Sub Menus -->
							{#if m.sub_menus && m.sub_menus.length > 0}
								<div class="mt-4 ml-8 space-y-2 border-t border-black/5 pt-4">
									{#each m.sub_menus as sub (sub.id)}
										<div
											class="flex items-center justify-between border border-black/10 p-2 transition-colors hover:border-black/50"
										>
											<div class="flex items-center gap-3">
												<span class="text-xs opacity-50">└</span>
												<span class="text-sm font-bold">{sub.title}</span>
												<span class="text-[8px] font-black tracking-widest uppercase opacity-20">
													{sub.link_type}</span
												>
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
					<span class="text-[9px] font-black tracking-[0.2em] uppercase italic opacity-40">
						Meta Engine v5.1</span
					>
				</div>
				{#if editingMenu.parent_id}
					<div
						class="mb-8 flex animate-pulse items-center justify-between bg-slate-900 p-4 text-xs font-black text-white"
					>
						<span>상위 메뉴에 연결됨 (부모 ID: {editingMenu.parent_id})</span>
						<button class="text-[10px] underline" onclick={() => (editingMenu.parent_id = '')}
							>연결 해제</button
						>
					</div>
				{/if}
				<div class="space-y-8">
					<!-- Parent Selection (Grouping) -->
					<div class="space-y-2">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>상위 메뉴 (소속 그룹)</label
						>
						<select
							bind:value={editingMenu.parent_id}
							class="h-14 w-full border border-black bg-white px-4 text-sm font-black"
						>
							<option value="">-- 최상위 메뉴 (그룹 없음) --</option>
							{#each menus as m}
								{#if m.id !== editingMenu.id}
									<option value={m.id}>📂 {m.title} (ID: {m.id})</option>
									<!-- 2단계 메뉴까지만 후보로 노출 (너무 깊은 depth 방지) -->
									{#if m.sub_menus}
										{#each m.sub_menus as sub}
											{#if sub.id !== editingMenu.id}
												<option value={sub.id}>&nbsp;&nbsp;&nbsp;└ 📄 {sub.title}</option>
											{/if}
										{/each}
									{/if}
								{/if}
							{/each}
						</select>
						<p class="text-[9px] font-bold text-blue-600 italic opacity-60">
							* 다른 메뉴의 하위로 들어가 그룹화하려면 상위 메뉴를 선택하세요.
						</p>
					</div>
					<!-- Title -->
					<div class="space-y-2">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>표시될 메뉴 이름</label
						>
						<input
							type="text"
							bind:value={editingMenu.title}
							class="h-14 w-full border border-black bg-slate-50 px-5 text-xl font-black transition-all focus:bg-white focus:outline-none"
							placeholder="예: 공지사항, 인사관리 등"
						/>
					</div>
					<div class="grid grid-cols-2 gap-8">
						<div class="space-y-2">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>연결 방식 (타입)</label
							>
							<select
								bind:value={editingMenu.link_type}
								class="h-14 w-full border border-black bg-slate-50 px-4 text-sm font-black"
							>
								<option value="FOLDER">📁 메뉴 그룹 (아코디언/폴더)</option>
								<option value="APP">⚙️ 시스템 엔진 (앱 인스턴스)</option>
								<option value="CUSTOM">🚀 CUSTOM 앱 (100% 커스텀)</option>
								<option value="URL">🔗 고정 주소 (외부/정적)</option>
								<option value="DIVIDER">➖ 구분선</option>
							</select>
							<p class="mt-2 text-[9px] font-bold text-slate-400 italic">
								* 'CUSTOM 앱'은 /v1/custom 경로를 사용하는 단독 앱 전용입니다.
							</p>
						</div>
						<div class="space-y-2">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>필요한 열람 등급</label
							>
							<select
								bind:value={editingMenu.min_rank}
								class="h-14 w-full border border-black bg-slate-50 px-4 text-sm font-black"
							>
								<option value={0}>일반 방문자 (R0)</option>
								<option value={1}>직원 레벨 (R1)</option>
								<option value={2}>관리자 프로토콜 (R2)</option>
								<option value={4}>최고 권한 (R4)</option>
							</select>
						</div>
					</div>
					<!-- 연결 타입별 설정 그룹 -->
					{#if editingMenu.link_type === 'APP'}
						<div class="space-y-6 border-2 border-black bg-blue-50/50 p-8" in:fade>
							<div class="space-y-2">
								<label class="text-[9px] font-black tracking-widest text-blue-600 uppercase"
									>사용할 시스템 엔진</label
								>
								<select
									bind:value={editingMenu.app_id}
									class="h-12 w-full border border-black px-4 text-sm font-black"
								>
									<option value="">-- 엔진 선택 --</option>
									{#each apps as app}
										{#if app.app_type === 'INSTANCE'}
											<option value={app.app_id}>{app.title || app.name} ({app.app_id})</option>
										{/if}
									{/each}
								</select>
							</div>
							<div class="space-y-2">
								<label class="text-[9px] font-black tracking-widest text-blue-600 uppercase"
									>세부 인스턴스 선택 (ID/Slug)</label
								>
								<select
									bind:value={editingMenu.app_instance_id}
									class="h-12 w-full border border-black bg-white px-4 text-sm font-black"
								>
									<option value="">-- 기본 진입 (0) --</option>
									<option value={-1}>🛠️ 관리자 전용 모드 (-1)</option>
									<option disabled>──────────</option>
									{#if editingMenu.app_id === 'board'}
										{#each boards as b}
											<option value={b.id}>📑 게시판: {b.name} ({b.slug})</option>
										{/each}
									{/if}
								</select>
							</div>
						</div>
					{:else if editingMenu.link_type === 'CUSTOM'}
						<div class="space-y-6 rounded-xl border-2 border-rose-500 bg-rose-50/50 p-8" in:fade>
							<div class="space-y-2">
								<label class="text-[9px] font-black tracking-widest text-rose-600 uppercase"
									>연결할 CUSTOM 앱</label
								>
								<select
									bind:value={editingMenu.app_id}
									class="h-12 w-full border border-rose-500 px-4 text-sm font-black"
								>
									<option value="">-- CUSTOM 앱 선택 --</option>
									{#each apps as app}
										{#if app.app_type === 'STATIC'}
											<option value={app.app_id}>{app.title || app.name} ({app.app_id})</option>
										{/if}
									{/each}
								</select>
							</div>
							<p class="mt-2 text-[10px] leading-relaxed font-bold text-rose-500 opacity-80">
								선택된 CUSTOM 앱의 `app_id`를 기반으로 자동 경로가 설정됩니다. <br />
								(예: `/v1/custom/{app_id}`)
							</p>
						</div>
					{:else if editingMenu.link_type === 'URL'}
						<div class="space-y-2 pt-6" in:fade>
							<label class="text-[10px] font-black tracking-widest text-black uppercase"
								>경로 (Endpoint)</label
							>
							<input
								type="text"
								bind:value={editingMenu.external_url}
								class="h-14 w-full border border-black bg-slate-50 px-5 text-xs font-bold transition-all focus:bg-white focus:outline-none"
								placeholder={editingMenu.link_type === 'CUSTOM'
									? `/v1/custom/${editingMenu.app_id || '앱이름'}`
									: '/v1/my-page 또는 https://example.com'}
							/>
							<p
								class="text-[9px] font-bold tracking-tighter text-blue-600 uppercase italic underline decoration-blue-100 underline-offset-4"
							>
								💡 CUSTOM 앱은 `/v1/custom/` 경로를, URL은 외부 주소나 다른 정적 내부 경로를
								입력하세요.
							</p>
						</div>
					{/if}

					<div class="space-y-2">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>아이콘 (FontAwesome/Iconify)</label
						>
						<input
							type="text"
							bind:value={editingMenu.icon_name}
							class="h-14 w-full border border-black bg-slate-50 px-5 text-lg font-bold transition-all focus:bg-white focus:outline-none"
							placeholder="예: 🚀, ph:circles-three-bold"
						/>
					</div>
					<div class="grid grid-cols-2 gap-8">
						<div class="space-y-2">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>정렬 순서</label
							>
							<input
								type="number"
								bind:value={editingMenu.order}
								class="h-14 w-full border border-black bg-white px-4 font-black text-black"
							/>
						</div>
						<div class="space-y-2">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>가시성</label
							>
							<div class="flex h-14 w-full items-center border border-black bg-slate-50 px-4">
								<input
									type="checkbox"
									bind:checked={editingMenu.is_visible}
									class="checkbox mr-4 rounded-none checkbox-lg"
								/>
								<span class="text-lg font-black">
									{editingMenu.is_visible ? 'Visible' : 'Hidden'}</span
								>
							</div>
						</div>
					</div>
					<div class="flex gap-4 pt-10">
						<button
							class="h-20 flex-1 border-2 border-black bg-black text-xl font-black tracking-widest text-white uppercase transition-all hover:bg-white hover:text-black"
							onclick={handleSave}
						>
							{editingMenu.id ? '설정 변경 저장' : '새 메뉴 등록'}
						</button>
						<button
							class="h-20 w-24 border-2 border-black text-[10px] font-black uppercase transition-all hover:bg-red-50 hover:text-red-500"
							onclick={resetForm}
						>
							초기화
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
