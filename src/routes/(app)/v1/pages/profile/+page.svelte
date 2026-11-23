<script lang="ts">
	/**
	 * @file v1/pages/profile/+page.svelte
	 * @description [v4.1] 통합 사용자 센터 - 표준 대시보드 디자인 & 전면 한글화
	 */
	import { onMount } from 'svelte';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';
	import FileManager from '$lib/components/FileManager.svelte';
	import BiometricPasskeyPanel from '$lib/components/biometric/BiometricPasskeyPanel.svelte';

	const auth = getAuthContext();

	type MainKey = 'OVERVIEW' | 'EDIT' | 'SECURITY' | 'ACTIVITY';

	interface SubTab {
		id: string;
		label: string;
		icon: string;
	}

	interface MainSection {
		label: string;
		desc: string;
		icon: string;
		tabs: SubTab[];
	}

	// 1. 전체 메뉴 및 중첩 탭 구성 데이터
	const navigationMap: Record<MainKey, MainSection> = {
		OVERVIEW: {
			label: '개요',
			desc: '내 계정 정보, 개인 파일함 및 부여된 권한 등급을 확인합니다.',
			icon: 'ph:identification-card-bold',
			tabs: [
				{ id: 'SUMMARY', label: '프로필 요약', icon: 'ph:user-focus-bold' },
				{ id: 'EXPLORER', label: '내 파일함', icon: 'ph:folder-open-bold' },
				{ id: 'RANK', label: '권한 및 등급', icon: 'ph:shield-star-bold' }
			]
		},
		EDIT: {
			label: '정보 수정',
			desc: '실명, 연락처 및 프로필 이미지를 관리합니다.',
			icon: 'ph:user-circle-gear-bold',
			tabs: [
				{ id: 'BASIC', label: '기본 정보', icon: 'ph:identification-badge-bold' },
				{ id: 'CONTACT', label: '연락처 설정', icon: 'ph:phone-bold' },
				{ id: 'AVATAR', label: '프로필 이미지', icon: 'ph:image-square-bold' }
			]
		},
		SECURITY: {
			label: '보안 설정',
			desc: '비밀번호 변경, 지문 인식(Passkey) 및 로그인된 기기·보안 이력을 관리합니다.',
			icon: 'ph:password-bold',
			tabs: [
				{ id: 'PWD', label: '비밀번호 변경', icon: 'ph:key-bold' },
				{ id: 'BIOMETRIC', label: '지문 인식', icon: 'ph:fingerprint-bold' },
				{ id: 'SESSIONS', label: '접속 기기 관리', icon: 'ph:devices-bold' },
				{ id: 'LOGS', label: '보안 로그', icon: 'ph:list-magnifying-glass-bold' }
			]
		},
		ACTIVITY: {
			label: '활동 내역',
			desc: '작성한 게시글, 댓글 및 추천 기록을 모아 봅니다.',
			icon: 'ph:article-bold',
			tabs: [
				{ id: 'POSTS', label: '작성한 글', icon: 'ph:note-pencil-bold' },
				{ id: 'COMMENTS', label: '작성한 댓글', icon: 'ph:chat-centered-text-bold' },
				{ id: 'LIKES', label: '좋아요 / 추천', icon: 'ph:heart-bold' }
			]
		}
	};

	const mainEntries = Object.entries(navigationMap) as [MainKey, MainSection][];

	// 2. 상태 관리
	let activeMainId = $state<MainKey>('OVERVIEW');
	let activeSubId = $state<string>('SUMMARY');

	// 파생 상태 (현재 선택된 메인/서브 정보)
	const currentMain = $derived(navigationMap[activeMainId]);
	const currentSub = $derived(
		currentMain.tabs.find((t) => t.id === activeSubId) || currentMain.tabs[0]
	);

	// 메인 메뉴 변경 함수
	function selectMain(id: MainKey) {
		activeMainId = id;
		activeSubId = navigationMap[id].tabs[0].id;
	}

	// 서브 탭 변경 함수
	function selectSub(id: string) {
		activeSubId = id;
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const tab = params.get('tab')?.toUpperCase() as MainKey | null;
		const sub = params.get('sub')?.toUpperCase();
		if (tab && navigationMap[tab]) {
			activeMainId = tab;
			const matchedSub = sub ? navigationMap[tab].tabs.find((t) => t.id === sub) : null;
			activeSubId = matchedSub ? matchedSub.id : navigationMap[tab].tabs[0].id;
		}
	});

	const getRankInfo = (rank: number) => {
		if (rank >= 9)
			return { label: '최고관리자', badge: 'bg-slate-900 text-emerald-400', icon: 'ph:crown-fill' };
		if (rank >= 4)
			return { label: '운영관리자', badge: 'bg-blue-600 text-white', icon: 'ph:crown-fill' };
		if (rank >= 2)
			return {
				label: '사무·관제 직원',
				badge: 'bg-sky-50 text-sky-700 border border-sky-200',
				icon: 'ph:shield-check-fill'
			};
		return {
			label: '일반 임직원',
			badge: 'bg-slate-100 text-slate-700 border border-slate-200',
			icon: 'ph:user-fill'
		};
	};
	const rankLevel = $derived(Number(auth.user?.rank_level ?? 0));
	const rankInfo = $derived(getRankInfo(rankLevel));
</script>

<svelte:head>
	<title>{getSiteTitle('내 프로필')}</title>
</svelte:head>

<div
	class="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-28 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 md:pb-12 lg:px-8"
>
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 (표준 대시보드 스타일) -->
	<!-- ===================================================================== -->
	<header
		class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:border-b-4 md:pb-8"
	>
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400"
				>
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					내 계정 · 프로필 센터
				</span>
				<span
					class="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-black {rankInfo.badge}"
				>
					<Icon icon={rankInfo.icon} class="h-3.5 w-3.5" />
					<span>{rankInfo.label} (Lv.{rankLevel})</span>
				</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
				내 프로필 <span class="text-blue-600">{currentMain.label}</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				{currentMain.desc}
			</p>
		</div>
	</header>

	<!-- ===================================================================== -->
	<!-- 2. 상단 메인 카테고리 탭 바 + 하단 서브 탭 필 -->
	<!-- ===================================================================== -->
	<div class="space-y-3">
		<div class="no-scrollbar flex items-center overflow-x-auto border-b-2 border-slate-200">
			{#each mainEntries as [id, menu] (id)}
				<button
					type="button"
					onclick={() => selectMain(id)}
					class="flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {activeMainId ===
					id
						? 'border-blue-600 bg-blue-50/50 text-blue-600'
						: 'border-transparent text-slate-500 hover:text-slate-900'}"
				>
					<Icon icon={menu.icon} class="text-base" />
					<span>{menu.label}</span>
				</button>
			{/each}
		</div>

		<nav class="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1" aria-label="세부 메뉴">
			{#each currentMain.tabs as tab (tab.id)}
				<button
					type="button"
					onclick={() => selectSub(tab.id)}
					class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-black transition {activeSubId ===
					tab.id
						? 'border-slate-900 bg-slate-900 text-white shadow-xs'
						: 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'}"
				>
					<Icon icon={tab.icon} class="h-4 w-4" />
					<span>{tab.label}</span>
				</button>
			{/each}
		</nav>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 메인 컨텐츠 영역 -->
	<!-- ===================================================================== -->
	<main class="min-h-[420px]">
		{#if activeSubId === 'EXPLORER'}
			<div class="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
				<FileManager app_id="profile" access_level="PRIVATE" sub_path="USERS/{auth.user?.id}" />
			</div>
		{:else if activeSubId === 'SUMMARY'}
			<!-- 개요 - 프로필 요약 -->
			<div class="grid grid-cols-1 gap-6 md:grid-cols-12">
				<div
					class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8 md:col-span-8"
				>
					<div class="flex flex-col gap-6 sm:flex-row sm:items-center">
						<div
							class="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl bg-slate-900 text-4xl font-black text-white shadow-md"
						>
							{(auth.user?.real_name || auth.user?.username || '?')[0].toUpperCase()}
						</div>
						<div class="min-w-0 flex-1 space-y-4">
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<h2 class="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
										{auth.user?.real_name || auth.user?.username || '사용자'}
									</h2>
									<span
										class="rounded-lg bg-slate-100 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-500"
									>
										@{auth.user?.username || '-'}
									</span>
								</div>
								{#if auth.user?.primary_group}
									<p class="mt-1 text-xs font-bold text-blue-600">
										소속: {auth.user.primary_group}
									</p>
								{/if}
							</div>

							<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
									<span class="block text-[11px] font-black text-slate-400">성명</span>
									<p class="mt-0.5 text-sm font-black text-slate-800">
										{auth.user?.real_name || '미등록'}
									</p>
								</div>
								<div class="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
									<span class="block text-[11px] font-black text-slate-400">이메일</span>
									<p class="mt-0.5 truncate text-sm font-bold text-slate-800">
										{auth.user?.email || '미등록'}
									</p>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div
					class="flex flex-col justify-between rounded-3xl border-2 border-blue-600 bg-blue-600 p-6 text-white shadow-lg sm:p-8 md:col-span-4"
				>
					<div>
						<span
							class="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-black"
						>
							<span class="h-2 w-2 rounded-full bg-emerald-300"></span>
							계정 상태 요약
						</span>
						<div class="mt-4 text-3xl font-black">정상 연결됨</div>
						<p class="mt-2 text-xs leading-relaxed font-medium text-blue-100">
							현재 시스템 인증 세션이 안전하게 유지되고 있으며 모든 사내 서비스를 정상적으로
							이용하실 수 있습니다.
						</p>
					</div>
					<div
						class="mt-6 flex items-center justify-between border-t border-white/15 pt-4 text-xs font-bold text-blue-100"
					>
						<span>권한 등급</span>
						<span class="font-black text-white">{rankInfo.label} (Lv.{rankLevel})</span>
					</div>
				</div>
			</div>
		{:else if activeSubId === 'BASIC'}
			<!-- 정보 수정 - 기본 정보 -->
			<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8">
				<div class="max-w-xl space-y-6">
					<div>
						<h2 class="text-xl font-black tracking-tight text-slate-900">기본 정보 수정</h2>
						<p class="mt-1 text-xs font-medium text-slate-400">
							표시되는 성명 등 기본 계정 정보를 관리합니다.
						</p>
					</div>
					<div class="space-y-4">
						<div class="space-y-1.5">
							<label for="profile-real-name" class="block text-xs font-black text-slate-500"
								>성명 변경</label
							>
							<input
								id="profile-real-name"
								type="text"
								value={auth.user?.real_name || ''}
								placeholder="성명을 입력하세요"
								class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
							/>
						</div>
						<button
							type="button"
							class="btn rounded-xl border-none bg-slate-900 px-8 font-black text-white hover:bg-blue-600"
						>
							변경사항 저장
						</button>
					</div>
				</div>
			</div>
		{:else if activeSubId === 'PWD'}
			<!-- 보안 - 비밀번호 변경 -->
			<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8">
				<div class="max-w-md space-y-6">
					<div>
						<h2 class="text-xl font-black tracking-tight text-slate-900">비밀번호 변경</h2>
						<p class="mt-1 text-xs font-medium text-slate-400">
							계정 보안을 위해 주기적으로 비밀번호를 변경해 주세요.
						</p>
					</div>
					<div class="space-y-4">
						<div class="space-y-1.5">
							<label for="current-pwd" class="block text-xs font-black text-slate-500"
								>현재 비밀번호</label
							>
							<input
								id="current-pwd"
								type="password"
								placeholder="현재 비밀번호 입력"
								class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
							/>
						</div>
						<div class="space-y-1.5">
							<label for="new-pwd" class="block text-xs font-black text-slate-500"
								>새 비밀번호</label
							>
							<input
								id="new-pwd"
								type="password"
								placeholder="새 비밀번호 입력"
								class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 transition focus:border-blue-500 focus:bg-white focus:outline-none"
							/>
						</div>
						<button
							type="button"
							class="btn w-full rounded-xl border-none bg-slate-900 font-black text-white hover:bg-blue-600"
						>
							비밀번호 변경 적용
						</button>
					</div>
				</div>
			</div>
		{:else if activeSubId === 'BIOMETRIC'}
			<!-- 보안 - 지문 인식(Passkey) 등록 · 삭제 · 테스트 -->
			<BiometricPasskeyPanel />
		{:else}
			<!-- 준비 중 플레이스홀더 -->
			<div
				class="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white px-6 py-24 text-center"
			>
				<Icon icon={currentSub.icon} class="mb-4 h-14 w-14 text-slate-200" />
				<h2 class="text-lg font-black text-slate-700">{currentSub.label}</h2>
				<p class="mt-1 text-xs font-bold text-slate-400">
					해당 기능은 순차적으로 연동될 예정입니다.
				</p>
			</div>
		{/if}
	</main>
</div>

<style>
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
