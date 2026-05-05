<script>
	/**
	 * @file v1/pages/profile/+page.svelte
	 * @description [v4.0] 통합 사용자 센터 - 중첩 탭(Nested Tabs) 확장형 아키텍처
	 */
	import { auth } from '$lib/runes/auth.svelte.js';
	import Icon from '@iconify/svelte';

	// 1. 전체 메뉴 및 중첩 탭 구성 데이터 (여기만 수정하면 무한 확장 가능)
	const navigationMap = {
		OVERVIEW: {
			label: '개요',
			icon: 'ph:identification-card-bold',
			tabs: [
				{ id: 'SUMMARY', label: '프로필 요약', icon: 'ph:user-focus-bold' },
				{ id: 'RANK', label: '권한 및 등급', icon: 'ph:shield-star-bold' }
			]
		},
		EDIT: {
			label: '정보 수정',
			icon: 'ph:user-circle-gear-bold',
			tabs: [
				{ id: 'BASIC', label: '기본 정보', icon: 'ph:identification-badge-bold' },
				{ id: 'CONTACT', label: '연락처 설정', icon: 'ph:phone-bold' },
				{ id: 'AVATAR', label: '아바타/이미지', icon: 'ph:image-square-bold' }
			]
		},
		SECURITY: {
			label: '보안 설정',
			icon: 'ph:password-bold',
			tabs: [
				{ id: 'PWD', label: '비밀번호 변경', icon: 'ph:key-bold' },
				{ id: 'SESSIONS', label: '접속 기기 관리', icon: 'ph:devices-bold' },
				{ id: 'LOGS', label: '보안 로그', icon: 'ph:list-magnifying-glass-bold' }
			]
		},
		ACTIVITY: {
			label: '활동 내역',
			icon: 'ph:article-bold',
			tabs: [
				{ id: 'POSTS', label: '작성한 글', icon: 'ph:note-pencil-bold' },
				{ id: 'COMMENTS', label: '작성한 댓글', icon: 'ph:chat-centered-text-bold' },
				{ id: 'LIKES', label: '좋아요/추천', icon: 'ph:heart-bold' }
			]
		}
	};

	// 2. 상태 관리
	let activeMainId = $state('OVERVIEW'); // 하단 패드 선택값
	let activeSubId = $state('SUMMARY');  // 상단 탭 선택값

	// 파생 상태 (현재 선택된 메인/서브 정보)
	const currentMain = $derived(navigationMap[activeMainId]);
	const currentSub = $derived(currentMain.tabs.find(t => t.id === activeSubId) || currentMain.tabs[0]);

	// 메인 메뉴 변경 함수
	function selectMain(id) {
		activeMainId = id;
		activeSubId = navigationMap[id].tabs[0].id; // 메인 변경 시 첫 번째 서브탭으로 초기화
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// 서브 탭 변경 함수
	function selectSub(id) {
		activeSubId = id;
	}

	const getRankInfo = (rank) => {
		if (rank >= 4) return { label: 'Administrator', icon: 'ph:crown-fill' };
		if (rank >= 2) return { label: 'Staff Member', icon: 'ph:shield-check-fill' };
		return { label: 'General User', icon: 'ph:user-fill' };
	};
	const rankInfo = $derived(getRankInfo(auth.user?.rank_level || 0));
</script>

<div class="animate-fade-in space-y-8 font-['Outfit'] text-black pb-40">
	<!-- 📄 Header: Dashboard Identity -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">
				Command Center / {currentMain.label}
			</span>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				{activeMainId} <span class="NOT-ITALIC text-blue-600">Console</span>
			</h1>
		</div>
		<div class="text-right flex flex-col items-end gap-1">
			<div class="flex items-center gap-2 border-2 border-black bg-yellow-400 px-3 py-1">
				<Icon icon={rankInfo.icon} class="h-4 w-4" />
				<span class="text-[10px] font-black uppercase">{rankInfo.label}</span>
			</div>
			<p class="text-[9px] font-bold opacity-30 uppercase tracking-widest italic">Core Access Verified</p>
		</div>
	</header>

	<!-- 📑 Nested Sub-Tabs: 모바일 대응 가로 스크롤 및 디자인 보정 -->
	<nav class="sticky top-0 z-20 -mx-6 mb-4 flex gap-2 border-b-2 border-slate-100 bg-slate-50/80 px-6 backdrop-blur-md overflow-x-auto no-scrollbar md:mx-0 md:px-0">
		{#each currentMain.tabs as tab}
			<button 
				onclick={() => selectSub(tab.id)} 
				class="flex items-center gap-2 whitespace-nowrap px-4 py-5 text-[11px] font-black uppercase tracking-widest transition-all md:gap-3 md:px-8 md:py-6 md:text-sm 
				{activeSubId === tab.id ? 'border-b-4 border-blue-600 text-blue-600' : 'text-slate-400 opacity-30 hover:opacity-100'}">
				<Icon icon={tab.icon} class="h-4 w-4 md:h-5 md:w-5" />
				{tab.label}
			</button>
		{/each}
	</nav>

	<!-- 🔄 Section 1: Dynamic Workspace (가운데 동적 공간) -->
	<main class="min-h-[500px] py-6">
		{#if activeSubId === 'EXPLORER'}
			<div class="animate-slide-up">
				<FileManager 
					app_id="profile" 
					access_level="PRIVATE" 
					sub_path="USERS/{auth.user?.id}" 
				/>
			</div>

		{:else if activeSubId === 'SUMMARY'}
			<!-- 개요 - 요약 -->
			<div class="grid grid-cols-1 gap-8 md:grid-cols-12 animate-slide-up">
				<div class="col-span-1 border-2 border-black bg-white p-10 md:col-span-8 shadow-[12px_12px_0_0_#000]">
					<div class="flex flex-col gap-12 md:flex-row md:items-center">
						<div class="relative flex h-32 w-32 flex-none items-center justify-center border-4 border-black bg-slate-50 text-5xl">
							{auth.user?.username[0].toUpperCase()}
						</div>
						<div class="space-y-6">
							<h2 class="text-5xl font-black tracking-tighter uppercase">@{auth.user?.username}</h2>
							<div class="flex flex-wrap gap-4">
								<div class="bg-slate-100 px-4 py-2 border border-black/10"><span class="text-[10px] block opacity-40 font-black uppercase">Name</span><p class="font-bold">{auth.user?.real_name || '미등록'}</p></div>
								<div class="bg-slate-100 px-4 py-2 border border-black/10"><span class="text-[10px] block opacity-40 font-black uppercase">Email</span><p class="font-bold">{auth.user?.email}</p></div>
							</div>
						</div>
					</div>
				</div>
				<div class="col-span-1 border-2 border-black bg-blue-600 p-10 text-white md:col-span-4">
					<span class="text-[10px] font-black tracking-widest uppercase opacity-60">System Summary</span>
					<div class="mt-4 space-y-4">
						<div class="text-4xl font-black italic">ACTIVE</div>
						<p class="text-xs font-bold leading-relaxed">현재 시스템과의 연결이 안정적이며 모든 프로토콜이 정상 작동 중입니다.</p>
					</div>
				</div>
			</div>

		{:else if activeSubId === 'BASIC'}
			<!-- 정보 수정 - 기본 정보 -->
			<div class="border-2 border-black bg-white p-12 animate-slide-up shadow-[12px_12px_0_0_#f1f5f9]">
				<div class="max-w-xl space-y-8">
					<h2 class="text-3xl font-black tracking-tighter uppercase italic">Basic Identity</h2>
					<div class="space-y-6">
						<div class="space-y-2">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-40">Change Real Name</label>
							<input type="text" value={auth.user?.real_name || ''} class="w-full border-b-2 border-black p-4 font-bold text-xl" />
						</div>
						<button class="btn btn-neutral rounded-none px-12 py-4 font-black uppercase tracking-widest">Execute Save</button>
					</div>
				</div>
			</div>

		{:else if activeSubId === 'PWD'}
			<!-- 보안 - 비번 변경 -->
			<div class="border-2 border-black bg-white p-12 animate-slide-up">
				<div class="max-w-md space-y-8">
					<h2 class="text-3xl font-black tracking-tighter uppercase italic">Cryptographic Update</h2>
					<div class="space-y-6">
						<input type="password" placeholder="Current Password" class="w-full border-b-2 border-black p-4 font-bold" />
						<input type="password" placeholder="New Secure Password" class="w-full border-b-2 border-black p-4 font-bold" />
						<button class="btn btn-neutral w-full rounded-none font-black uppercase py-4">Re-Encrypt Account</button>
					</div>
				</div>
			</div>

		{:else}
			<!-- 공통 플레이스홀더 -->
			<div class="border-4 border-dashed border-slate-200 p-32 animate-slide-up text-center">
				<Icon icon={currentSub.icon} class="h-20 w-20 mx-auto opacity-10 mb-6" />
				<h2 class="text-2xl font-black tracking-tighter uppercase italic opacity-20">{currentSub.label} Module</h2>
				<p class="text-xs font-bold text-slate-300 mt-2 uppercase tracking-[0.3em]">Module logic pending initialization...</p>
			</div>
		{/if}
	</main>

	<!-- 🛠️ Section 2: Fixed Navigation Pad (하단 고정 메뉴) -->
	<section class="space-y-10 border-t-4 border-black pt-16">
		<div class="flex items-center justify-between">
			<h3 class="flex items-center gap-3 text-2xl font-black tracking-tighter uppercase italic">
				<Icon icon="ph:grid-four-fill" class="h-7 w-7 text-blue-600" /> Control Pad
			</h3>
			<span class="text-[10px] font-black uppercase opacity-30 italic">Select Main Navigation Category</span>
		</div>
		<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each Object.entries(navigationMap) as [id, menu]}
				<button 
					onclick={() => selectMain(id)}
					class="flex flex-col items-start gap-6 border-2 border-black p-8 bg-white transition-all hover:bg-black hover:text-white group {activeMainId === id ? 'bg-black text-white shadow-[12px_12px_0_0_#3b82f6]' : 'shadow-[8px_8px_0_0_#000]'}">
					<Icon icon={menu.icon} class="h-10 w-10 {activeMainId === id ? 'text-blue-400' : 'opacity-20 group-hover:opacity-100'}" />
					<div class="text-left">
						<p class="text-[10px] font-black uppercase opacity-40 tracking-widest group-hover:opacity-70">Category</p>
						<p class="font-black uppercase tracking-tighter text-2xl">{menu.label}</p>
					</div>
				</button>
			{/each}
		</div>
	</section>
</div>

<style>
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

	.animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
	.animate-slide-up { animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
	@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes slideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
</style>
