<script>
	/**
	 * 🚐 [v5.0.0] 노선 마스터 및 로번별 근무시간표 통합 관리 페이지 (Svelte 5)
	 * - 사용자의 피드백을 수렴하여 설계를 직관적으로 개편하였습니다:
	 *   1. 1단계에서 지정한 '할당 배차 로번 수(vehicle_count)'와 2단계의 '시간표 행 수'가 실시간으로 동기화됩니다.
	 *   2. 2단계는 각 로번이 하루 동안 운행하는 전체 요약 근무 일정(운행 시작 시각 ~ 종료 시각)을 로번 수만큼 보여줍니다.
	 *   3. Svelte 5 $effect를 활용하여 로번 수를 조절하면 시간표 입력 필드가 실시간으로 늘어나거나 줄어듭니다.
	 *   4. 🕒 배차표 시간 표기는 전적으로 "24시간 표기법(24H)"을 원칙으로 삼아 직관적으로 기입하도록 가이드를 보강했습니다.
	 *   5. 💡 브라우저 기본 time 타입의 한글 '오전/오후' 강제 표기를 우회하고 신속한 실무 입력을 돕기 위해,
	 *      시간 입력을 스마트 텍스트 입력창(자동 콜론 포맷팅 및 숫자 제약)으로 리팩토링했습니다!
	 */
	import { onMount } from 'svelte';
	import { 
		adminGetRouteMasters, 
		adminCreateRouteMaster, 
		adminUpdateRouteMaster, 
		adminDeleteRouteMaster 
	} from '$lib/api/admin';
	import Icon from '@iconify/svelte';

	// ==========================================
	// 🎨 상태 정의 (State Definitions via Runes)
	// ==========================================

	let routeMasters = $state([]);
	let isLoading = $state(true);
	let error = $state(null);

	// 검색 및 필터 상태
	let searchQuery = $state('');
	let filterType = $state('ALL'); // 'ALL' | 'REGULAR' | 'TEMPORARY'

	// 현재 선택된 노선 마스터 ID 및 상세 정보
	let selectedId = $state(null);
	let selectedRoute = $derived(
		routeMasters.find(m => m.id === selectedId) || null
	);

	// 화면 모드 상태: 'VIEW' (상세조회) | 'CREATE' (등록) | 'EDIT' (수정)
	let pageMode = $state('VIEW'); 

	// 등록 및 수정 폼 상태
	let formRouteName = $state('');
	let formRouteType = $state('REGULAR'); // REGULAR | TEMPORARY
	let formStartDate = $state('');
	let formEndDate = $state('');
	let formVehicleCount = $state(2); // 기본 로번 수 2개
	let formVersion = $state('v1');
	
	// 로번별 일간 근무 요약 일정 배열 (RouteTimetable 모델의 각 행과 1:1 매핑)
	// seq = 로번 순번 (1로번, 2로번...)
	let formTimetables = $state([]);

	// ==========================================
	// ⚡ Svelte 5 $effect를 이용한 실시간 로번 수 - 시간표 동기화
	// ==========================================
	$effect(() => {
		const targetCount = Math.max(0, Number(formVehicleCount) || 0);
		const targetRowsCount = targetCount;
		
		if (formTimetables.length < targetRowsCount) {
			const lastRow = formTimetables[formTimetables.length - 1];
			const defaultStartLoc = lastRow ? lastRow.start_location : '제주터미널';
			const defaultEndLoc = lastRow ? lastRow.end_location : '서귀포터미널';
			const defaultStartGarage = lastRow ? lastRow.start_garage : '';
			const defaultEndGarage = lastRow ? lastRow.end_garage : '';
			const defaultIsRegularDuty = lastRow ? (lastRow.is_regular_duty !== undefined ? lastRow.is_regular_duty : false) : false;
			
			while (formTimetables.length < targetRowsCount) {
				const nextSeq = formTimetables.length + 1;
				formTimetables.push({
					seq: nextSeq,
					start_time: '06:00', // 기본 일과 시작
					end_time: '22:00',   // 기본 일과 종료
					start_location: defaultStartLoc,
					end_location: defaultEndLoc,
					start_garage: defaultStartGarage,
					end_garage: defaultEndGarage,
					is_regular_duty: defaultIsRegularDuty
				});
			}
		} else if (formTimetables.length > targetRowsCount) {
			formTimetables.splice(targetRowsCount);
		}
	});

	// ==========================================
	// 🛠️ 비즈니스 로직 및 API 연동 함수 (Business Logic)
	// ==========================================

	/**
	 * 백엔드로부터 최신 노선 마스터 데이터를 조회하여 상태를 업데이트합니다.
	 */
	async function loadRouteMasters() {
		isLoading = true;
		error = null;
		try {
			const data = await adminGetRouteMasters();
			routeMasters = data;
			
			// 기존 선택 유지 혹은 첫번째 노선 자동 선택
			if (routeMasters.length > 0) {
				if (!selectedId || !routeMasters.some(m => m.id === selectedId)) {
					selectedId = routeMasters[0].id;
				}
			} else {
				selectedId = null;
			}
		} catch (err) {
			console.error('❌ 노선 마스터 로딩 실패:', err);
			error = err.message || '노선 목록을 불러오는 과정에서 오류가 발생했습니다.';
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		loadRouteMasters();
	});

	/**
	 * 검색 조건 및 타입 필터가 적용된 정렬 목록을 계산합니다.
	 */
	let filteredMasters = $derived(
		routeMasters.filter(m => {
			const matchesSearch = m.route_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				m.version.toLowerCase().includes(searchQuery.toLowerCase());
			const matchesType = filterType === 'ALL' || m.route_type === filterType;
			return matchesSearch && matchesType;
		})
	);

	/**
	 * 신규 노선 등록 모드로 전환하며 폼 상태를 초기화합니다.
	 */
	function enterCreateMode() {
		pageMode = 'CREATE';
		formRouteName = '';
		formRouteType = 'REGULAR';
		const today = new Date().toISOString().split('T')[0];
		formStartDate = today;
		formEndDate = '';
		formVehicleCount = 2; // 기본 로번 2개 세팅 -> $effect에 의해 시간표 2줄 자동 생성
		formVersion = 'v1';
		formTimetables = [
			{ seq: 1, start_time: '06:00', end_time: '22:00', start_location: '제주터미널', end_location: '서귀포터미널', start_garage: '', end_garage: '', is_regular_duty: false },
			{ seq: 2, start_time: '06:00', end_time: '22:00', start_location: '제주터미널', end_location: '서귀포터미널', start_garage: '', end_garage: '', is_regular_duty: false }
		];
	}

	/**
	 * 기존 노선 수정 모드로 전환하며 현재 선택된 데이터를 폼 상태에 로드합니다.
	 */
	function enterEditMode() {
		if (!selectedRoute) return;
		pageMode = 'EDIT';
		formRouteName = selectedRoute.route_name;
		formRouteType = selectedRoute.route_type;
		formStartDate = selectedRoute.start_date;
		formEndDate = selectedRoute.end_date || '';
		formVehicleCount = selectedRoute.vehicle_count;
		formVersion = selectedRoute.version;
		
		// 깊은 복사로 격리하여 폼 편집 유연성 확보
		formTimetables = selectedRoute.timetables.map(t => ({
			seq: t.seq,
			start_time: t.start_time,
			end_time: t.end_time,
			start_location: t.start_location,
			end_location: t.end_location,
			start_garage: t.start_garage || '',
			end_garage: t.end_garage || '',
			is_regular_duty: t.is_regular_duty !== undefined ? t.is_regular_duty : false
		}));
	}

	/**
	 * 상세조회 패널에서 특정 로번 시간표의 당연 근무 상태를 즉시 토글 업데이트합니다.
	 */
	async function toggleTimetableRegularDuty(timetable, currentVal) {
		if (!selectedRoute) return;
		
		// 깊은 복사로 기존 시간표 목록 가져오기
		const updatedTimetables = selectedRoute.timetables.map(t => {
			const isTarget = t.id === timetable.id;
			return {
				seq: t.seq,
				start_time: t.start_time,
				end_time: t.end_time,
				start_location: t.start_location,
				end_location: t.end_location,
				start_garage: t.start_garage || '',
				end_garage: t.end_garage || '',
				is_regular_duty: isTarget ? !currentVal : (t.is_regular_duty !== undefined ? t.is_regular_duty : false)
			};
		});

		const payload = {
			route_name: selectedRoute.route_name,
			route_type: selectedRoute.route_type,
			start_date: selectedRoute.start_date,
			end_date: selectedRoute.end_date || null,
			vehicle_count: selectedRoute.vehicle_count,
			version: selectedRoute.version,
			timetables: updatedTimetables
		};

		try {
			await adminUpdateRouteMaster(selectedRoute.id, payload);
			// 목록 및 상세 정보 다시 로드
			await loadRouteMasters();
		} catch (err) {
			console.error('❌ 당연 근무 토글 중 오류 발생:', err);
			alert(`당연 근무 상태 변경에 실패했습니다:\n${err.message}`);
		}
	}

	function cancelForm() {
		pageMode = 'VIEW';
	}

	/**
	 * 시간 문자열(HH:MM) 포맷 스마트 포매터 함수
	 * - 숫자만 추출한 뒤 자동 콜론(:) 위치 보정 수행
	 */
	function handleTimeInput(e, timetable, field) {
		let val = e.target.value.replace(/[^0-9]/g, ''); // 숫자 제외 문자 모두 소거
		
		if (val.length > 4) {
			val = val.slice(0, 4);
		}
		
		// 4자리가 들어오면 HH:MM 형식으로 조합
		if (val.length > 2) {
			val = val.slice(0, 2) + ':' + val.slice(2);
		}
		
		timetable[field] = val;
	}

	/**
	 * 노선 및 로번 근무 일정 폼의 유효성 검사를 수행합니다.
	 */
	function validateForm() {
		if (!formRouteName.trim()) {
			alert('노선명을 입력해 주세요.');
			return false;
		}
		if (!formVersion.trim()) {
			alert('버전을 입력해 주세요. (예: v1, v2)');
			return false;
		}
		if (!formStartDate) {
			alert('적용 시작일을 선택해 주세요.');
			return false;
		}
		if (formEndDate && formStartDate > formEndDate) {
			alert('종료일은 시작일보다 이전일 수 없습니다.');
			return false;
		}
		if (Number(formVehicleCount) <= 0) {
			alert('최소 1개 이상의 로번 수가 할당되어야 합니다.');
			return false;
		}
		
		// 로번별 근무시간 및 노선 요약 정보 확인 (24시간 표기법 유효성 체크 포함)
		const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
		for (let i = 0; i < formTimetables.length; i++) {
			const t = formTimetables[i];
			const vNum = t.seq;
			if (!t.start_time || !t.end_time) {
				alert(`${vNum}로번의 근무 시각을 올바르게 입력해 주세요.`);
				return false;
			}
			
			// 24시 포맷 강제 검증 규칙 적용
			if (!timeRegex.test(t.start_time) || !timeRegex.test(t.end_time)) {
				alert(`${vNum}로번에 유효하지 않은 시간 형식이 포함되어 있습니다.\n반드시 24시간 형식(00:00 ~ 23:59, 예: 18:30)으로 기입해 주세요.`);
				return false;
			}
			
			if (!t.start_location.trim() || !t.end_location.trim()) {
				alert(`${vNum}로번의 주요 기점(출발지)과 종점(도착지)을 입력해 주세요.`);
				return false;
			}
		}
		return true;
	}

	/**
	 * 신규 등록 또는 수정 사항을 백엔드 DB에 보관합니다.
	 */
	async function saveRoute() {
		if (!validateForm()) return;

		const payload = {
			route_name: formRouteName.trim(),
			route_type: formRouteType,
			start_date: formStartDate,
			end_date: formEndDate ? formEndDate : null,
			vehicle_count: Number(formVehicleCount),
			version: formVersion.trim(),
			timetables: formTimetables
		};

		try {
			if (pageMode === 'CREATE') {
				const response = await adminCreateRouteMaster(payload);
				alert('🎉 새로운 노선 마스터 및 로번 근무스케줄이 성공적으로 등록되었습니다!');
				selectedId = response.id;
			} else if (pageMode === 'EDIT') {
				await adminUpdateRouteMaster(selectedId, payload);
				alert('💾 로번 수 변경 및 운행 일정 마스터가 성공적으로 업데이트되었습니다.');
			}
			pageMode = 'VIEW';
			await loadRouteMasters();
		} catch (err) {
			console.error('❌ 저장 중 오류 발생:', err);
			alert(`저장에 실패했습니다:\n${err.message}`);
		}
	}

	/**
	 * 선택된 노선 마스터를 CASCADE 영구 삭제합니다.
	 */
	async function deleteRoute() {
		if (!selectedRoute) return;
		
		const confirmMsg = `⚠️ 정말로 [${selectedRoute.route_name} (${selectedRoute.version})] 노선을 삭제하시겠습니까?\n` +
			`이 노선에 배정된 로번 ${selectedRoute.vehicle_count}개의 하루 근무 시간표 정보가 모두 함께 영구 삭제됩니다!`;
			
		if (confirm(confirmMsg)) {
			try {
				await adminDeleteRouteMaster(selectedRoute.id);
				alert('🗑️ 노선 마스터 및 하위 로번 스케줄 일괄 삭제 완료.');
				selectedId = null;
				pageMode = 'VIEW';
				await loadRouteMasters();
			} catch (err) {
				console.error('❌ 삭제 오류:', err);
				alert(`삭제에 실패했습니다:\n${err.message}`);
			}
		}
	}
</script>

<svelte:head>
	<title>노선 마스터 및 로번 스케줄 제어기 (Admin)</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl px-4 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-6 md:pb-36 lg:px-8">
	
	<!-- 🏷️ 1. 페이지 프리미엄 헤더 -->
	<div class="flex flex-col items-start justify-between gap-6 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:border-b-4 md:pb-8">
		<div>
			<span class="mb-1 block text-[10px] font-black tracking-[0.3em] text-blue-500 uppercase md:mb-2 md:tracking-[0.4em]">
				Fleet Schedule Database Administration
			</span>
			<h1 class="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				노선 및 <span class="NOT-ITALIC text-indigo-600">로번 시간표 <Icon icon="mdi:bus-clock" class="ml-1 inline-block align-text-bottom text-indigo-600" /></span>
			</h1>
			<p class="mt-2 text-xs font-bold text-slate-500 md:mt-3 md:text-sm">
				정규/임시 노선의 로번 수만큼 로번별 운행 시작과 종료 시각(근무시간) 및 주요 운행 요약 정보를 동기화하여 통제합니다. (🕒 **시간은 24시간제로 관리됩니다**)
			</p>
		</div>
		
		<div class="flex flex-wrap gap-2 md:gap-3">
			<a href="/v1/admin" class="btn rounded-xl border-none bg-slate-200 px-4 font-black text-slate-700 shadow-md transition-all hover:bg-slate-300 btn-md md:rounded-2xl md:px-6 md:shadow-lg">
				<Icon icon="mdi:arrow-left" class="h-5 w-5" />
				관리자 홈
			</a>
			<button onclick={enterCreateMode} disabled={pageMode !== 'VIEW'} class="btn rounded-xl border-none bg-indigo-600 px-5 font-black text-white shadow-md transition-all hover:bg-indigo-700 btn-md disabled:bg-slate-300 disabled:text-slate-400 md:rounded-2xl md:px-8 md:shadow-lg">
				<Icon icon="mdi:plus-circle" class="h-5 w-5" />
				새 노선 등록
			</button>
		</div>
	</div>

	<!-- 🚦 2. 마스터-디테일 원패널 슬라이드 레이아웃 -->
	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12 md:gap-8">
		
		<!-- ========================================== -->
		<!-- 📝 LEFT: 노선 마스터 목록 검색 및 사이드바 (4 cols) -->
		<!-- ========================================== -->
		<div class="flex flex-col gap-4 lg:col-span-4">
			
			<div class="rounded-3xl border-2 border-slate-900 bg-white p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
				<div class="relative w-full">
					<span class="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
						<Icon icon="mdi:magnify" class="h-5 w-5" />
					</span>
					<input 
						type="text" 
						placeholder="노선명 또는 버전 검색..." 
						bind:value={searchQuery}
						class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-bold text-black transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none"
					/>
				</div>
				
				<div class="mt-3 flex gap-1 rounded-2xl border-2 border-slate-200 bg-slate-50 p-1">
					<button onclick={() => filterType = 'ALL'} class="flex-1 rounded-xl py-1.5 text-xs font-black transition-all {filterType === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}">
						전체 노선
					</button>
					<button onclick={() => filterType = 'REGULAR'} class="flex-1 rounded-xl py-1.5 text-xs font-black transition-all {filterType === 'REGULAR' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-blue-600 hover:bg-slate-100'}">
						정규노선
					</button>
					<button onclick={() => filterType = 'TEMPORARY'} class="flex-1 rounded-xl py-1.5 text-xs font-black transition-all {filterType === 'TEMPORARY' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-500 hover:text-amber-600 hover:bg-slate-100'}">
						임시노선
					</button>
				</div>
			</div>

			<div class="flex flex-col gap-3 overflow-y-auto max-h-[620px] pr-1">
				{#if isLoading}
					<div class="flex flex-col items-center justify-center py-20 text-slate-400">
						<span class="loading loading-spinner loading-lg text-indigo-600"></span>
						<p class="mt-4 text-xs font-bold text-slate-500">배차 데이터를 조회하는 중...</p>
					</div>
				{:else if error}
					<div class="rounded-3xl border-2 border-red-500 bg-red-50 p-6 text-center text-red-700">
						<Icon icon="mdi:alert-octagon-outline" class="mx-auto h-12 w-12 text-red-500" />
						<p class="mt-3 text-sm font-black">{error}</p>
						<button onclick={loadRouteMasters} class="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-black text-white">재시도</button>
					</div>
				{:else if filteredMasters.length === 0}
					<div class="rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 py-16 text-center text-slate-400">
						<Icon icon="mdi:bus-alert" class="mx-auto h-12 w-12 text-slate-300" />
						<p class="mt-3 text-xs font-bold">조건에 부합하는 노선 정보가 없습니다.</p>
					</div>
				{:else}
					{#each filteredMasters as master (master.id)}
						<button 
							onclick={() => {
								if (pageMode === 'VIEW') {
									selectedId = master.id;
								} else {
									if (confirm('⚠️ 다른 노선 선택 시 작성 중인 스케줄 폼의 내용이 유실됩니다. 계속하시겠습니까?')) {
										selectedId = master.id;
										pageMode = 'VIEW';
									}
								}
							}}
							class="w-full text-left transition-all duration-300 hover:-translate-y-0.5 active:scale-98"
						>
							<div class="relative overflow-hidden rounded-3xl border-2 p-5 shadow-sm transition-all duration-300 {selectedId === master.id ? 'border-indigo-600 bg-indigo-50/55 shadow-md ring-2 ring-indigo-400/30' : 'border-slate-200 bg-white hover:border-slate-400'}">
								<div class="flex items-center justify-between mb-3">
									{#if master.route_type === 'REGULAR'}
										<span class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black tracking-tight text-blue-800">
											<span class="h-2 w-2 rounded-full bg-blue-500 animate-pulse"></span>
											정규노선
										</span>
									{:else}
										<span class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black tracking-tight text-amber-800">
											<span class="h-2 w-2 rounded-full bg-amber-500"></span>
											임시노선
										</span>
									{/if}
									
									<span class="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white tracking-widest uppercase">
										{master.version}
									</span>
								</div>

								<h3 class="text-xl font-black tracking-tight text-slate-900">
									{master.route_name}
								</h3>

								<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
									<div class="flex items-center gap-1 text-slate-500 font-bold">
										<Icon icon="mdi:calendar-range" class="h-4 w-4 text-slate-400" />
										<span>{master.start_date.slice(5)}</span>
										<span>~</span>
										<span>{master.end_date ? master.end_date.slice(5) : '진행중'}</span>
									</div>
									
									<div class="flex items-center gap-2">
										<span class="font-extrabold text-indigo-600 bg-indigo-100/50 px-2 py-0.5 rounded-lg text-[11px]">
											로번 {master.vehicle_count}개
										</span>
									</div>
								</div>
							</div>
						</button>
					{/each}
				{/if}
			</div>
		</div>

		<!-- ========================================== -->
		<!-- 🖥️ RIGHT: 디테일뷰 및 동적 로번 스케줄 동기화 폼 (8 cols) -->
		<!-- ========================================== -->
		<div class="lg:col-span-8">
			
			<!-- ========================================== -->
			<!-- [A] VIEW MODE: 노선 정보 및 로번별 근무시간 타임라인 -->
			<!-- ========================================== -->
			{#if pageMode === 'VIEW'}
				{#if selectedRoute}
					<div class="flex flex-col gap-6 rounded-3xl border-3 border-slate-900 bg-white p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] md:p-8">
						
						<div class="flex flex-col justify-between gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center">
							<div class="space-y-1">
								<div class="flex items-center gap-3">
									<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Selected Master Route</span>
									{#if selectedRoute.route_type === 'REGULAR'}
										<span class="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-800 uppercase">REGULAR</span>
									{:else}
										<span class="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800 uppercase">TEMPORARY</span>
									{/if}
								</div>
								
								<h2 class="text-3xl font-black tracking-tight text-slate-900">
									{selectedRoute.route_name} <span class="text-indigo-600 font-extrabold text-2xl">{selectedRoute.version}</span>
								</h2>
							</div>

							<div class="flex gap-2">
								<button onclick={enterEditMode} class="btn rounded-xl border-none bg-indigo-50 px-4 font-black text-indigo-700 shadow-sm transition-all hover:bg-indigo-100 btn-md md:px-5">
									<Icon icon="mdi:pencil-outline" class="h-4.5 w-4.5" />
									로번 수/근무시간 수정
								</button>
								<button onclick={deleteRoute} class="btn rounded-xl border-none bg-red-50 px-4 font-black text-red-600 shadow-sm transition-all hover:bg-red-100 btn-md md:px-5">
									<Icon icon="mdi:trash-can-outline" class="h-4.5 w-4.5" />
									삭제
								</button>
							</div>
						</div>

						<div class="grid grid-cols-2 gap-4 rounded-2xl bg-slate-50 p-5 md:grid-cols-4 md:gap-6">
							<div class="space-y-1">
								<span class="text-[10px] font-black text-slate-400 uppercase">노선 형태</span>
								<p class="text-base font-extrabold text-slate-800">
									{selectedRoute.route_type === 'REGULAR' ? '정규 고정 배차' : '임시 특별 편성'}
								</p>
							</div>
							<div class="space-y-1">
								<span class="text-[10px] font-black text-slate-400 uppercase">버전 식별</span>
								<p class="text-base font-extrabold text-indigo-600">{selectedRoute.version}</p>
							</div>
							<div class="space-y-1">
								<span class="text-[10px] font-black text-slate-400 uppercase">배정 로번 수</span>
								<p class="text-base font-extrabold text-indigo-600 font-black">{selectedRoute.vehicle_count} 개</p>
							</div>
							<div class="space-y-1">
								<span class="text-[10px] font-black text-slate-400 uppercase">유효 가동구간</span>
								<p class="text-xs font-black text-slate-700 leading-tight">
									{selectedRoute.start_date}<br/>
									<span class="text-slate-400">~ {selectedRoute.end_date || '종료기한 없음'}</span>
								</p>
							</div>
						</div>

						<!-- 로번별 일일 가동 시간표 목록 -->
						<div class="space-y-5">
							<div class="flex flex-col gap-1">
								<h3 class="text-lg font-black tracking-tight text-slate-900">
									📋 로번별 일일 운행 시간표 <span class="text-indigo-600 font-black">({selectedRoute.timetables.length}개 가동)</span>
								</h3>
								<p class="text-xs font-bold text-slate-400">배정된 로번 수({selectedRoute.vehicle_count}개)만큼 각 로번별 24H 기준 근무시간 및 요약 기종점 정보가 나타납니다.</p>
							</div>

							{#if selectedRoute.timetables.length === 0}
								<div class="rounded-2xl border-2 border-dashed border-slate-200 py-12 text-center text-slate-400">
									<Icon icon="mdi:clock-alert-outline" class="mx-auto h-10 w-12 text-slate-300" />
									<p class="mt-2 text-xs font-bold">등록된 로번별 운행 일정 및 기종점이 비어있습니다.</p>
								</div>
							{:else}
								<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
									{#each selectedRoute.timetables as tt (tt.id)}
										<div class="group relative overflow-hidden rounded-3xl border-2 border-slate-100 bg-white p-5 shadow-sm transition-all duration-300 hover:border-indigo-400 hover:shadow-md">
											<div class="absolute right-0 top-0 h-16 w-16 bg-slate-50 text-slate-200 transition-all group-hover:bg-indigo-50/50 group-hover:text-indigo-200 flex items-center justify-center rounded-bl-3xl">
												<Icon icon="mdi:bus" class="h-7 w-7" />
											</div>

											<div class="flex items-center gap-2">
												<span class="text-[10px] font-black tracking-widest text-indigo-600 uppercase">VEHICLE SCHEDULE (24H)</span>
											</div>
											<h4 class="mt-1 text-lg font-black text-slate-900">
												{tt.seq}로번
											</h4>

											<!-- 근무 시간 정보 (24시간제로 깔끔하게 렌더링) -->
											<div class="mt-4 flex items-center gap-2">
												<span class="rounded-md bg-indigo-600 px-2 py-0.5 text-[9px] font-bold text-white tracking-wider uppercase">24H 운행</span>
												<p class="text-base font-black text-slate-800">
													{tt.start_time} ~ {tt.end_time}
												</p>
											</div>

											<!-- 기종점 및 요약 정보 + 당연 근무 스위치 통합 배치 (종점 바로 우측 밀착 배치) -->
											<div class="mt-3 flex items-center justify-between gap-3">
												<div class="flex flex-1 items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-600">
													<div class="flex items-center gap-1 font-black text-slate-800">
														<Icon icon="mdi:map-marker-outline" class="h-4 w-4 text-indigo-500" />
														<span>{tt.start_location}</span>
													</div>
													<Icon icon="mdi:arrow-right-thin" class="h-4 w-4 text-slate-400" />
													<div class="flex items-center gap-1 font-black text-slate-800">
														<Icon icon="mdi:map-marker-check" class="h-4 w-4 text-emerald-500" />
														<span>{tt.end_location}</span>
													</div>
												</div>
												
												<!-- 당연 근무 스위치 (도착 종점 위치 바로 오른쪽에 밀착 배치) -->
												<div class="flex flex-col items-center justify-center shrink-0">
													<button 
														type="button" 
														onclick={() => toggleTimetableRegularDuty(tt, tt.is_regular_duty)}
														class="relative inline-flex h-6.5 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {tt.is_regular_duty ? 'bg-indigo-600' : 'bg-slate-300'}"
														title="당연 근무 여부 토글"
													>
														<span 
															class="pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {tt.is_regular_duty ? 'translate-x-4.5' : 'translate-x-0'}"
														></span>
													</button>
													<span class="text-[8px] font-black mt-0.5 {tt.is_regular_duty ? 'text-indigo-600' : 'text-slate-400'}">당연근무</span>
												</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				{:else}
					<div class="flex flex-col items-center justify-center rounded-3xl border-3 border-slate-900 bg-white py-36 px-6 text-center shadow-[6px_6px_0px_0px_rgba(15,23,42,1)]">
						<div class="relative mb-6">
							<div class="absolute inset-0 rounded-full bg-indigo-100 animate-ping opacity-75"></div>
							<div class="relative flex h-20 w-20 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
								<Icon icon="mdi:bus-marker" class="h-10 w-10 animate-bounce" />
							</div>
						</div>
						
						<h3 class="text-2xl font-black tracking-tight text-slate-900">
							선택된 노선이 존재하지 않습니다.
						</h3>
						<p class="mt-2.5 max-w-sm text-xs font-bold leading-relaxed text-slate-400">
							왼쪽의 노선 목록에서 버전을 조회할 대상을 클릭해 주시거나, 상단의 '새 노선 등록' 단추를 활용해 시스템을 세팅해 주세요.
						</p>
					</div>
				{/if}
			
			<!-- ========================================== -->
			<!-- [B] CREATE/EDIT MODE: 실시간 로번 수 연동 폼 빌더 -->
			<!-- ========================================== -->
			{:else}
				<div class="flex flex-col gap-6 rounded-3xl border-3 border-slate-900 bg-white p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] md:p-8">
					
					<div class="flex items-center justify-between border-b border-slate-200 pb-5">
						<div>
							<span class="text-xs font-black tracking-wider text-indigo-600 uppercase">
								{pageMode === 'CREATE' ? 'New Fleet Scheduler' : 'Update Fleet Scheduler'}
							</span>
							<h2 class="text-2xl font-black tracking-tight text-slate-900">
								{pageMode === 'CREATE' ? '새 노선 및 로번 스케줄 등록' : `[${formRouteName}] 로번 운행 관리`}
							</h2>
						</div>
						
						<div class="flex gap-1">
							<button onclick={cancelForm} class="btn rounded-xl border-none bg-slate-100 px-4 font-black text-slate-500 transition-all hover:bg-slate-200 btn-sm md:btn-md">
								취소
							</button>
							<button onclick={saveRoute} class="btn rounded-xl border-none bg-indigo-600 px-4 font-black text-white shadow-sm transition-all hover:bg-indigo-700 btn-sm md:btn-md md:px-6">
								<Icon icon="mdi:content-save" class="h-4.5 w-4.5" />
								{pageMode === 'CREATE' ? '신규 등록' : '저장'}
							</button>
						</div>
					</div>

					<!-- 섹션 1: 마스터 메타데이터 설정 (로번 수 제어 포함) -->
					<div class="space-y-4">
						<div class="flex items-center gap-1.5 text-base font-black text-slate-900">
							<span class="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-slate-900 text-xs text-white">1</span>
							<span>노선 기준 메타데이터 설정</span>
						</div>
						
						<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
							<div class="form-control w-full">
								<label class="label py-1" for="routeNameInput">
									<span class="label-text font-black text-slate-700 text-xs">노선명</span>
								</label>
								<input 
									type="text" 
									id="routeNameInput"
									placeholder="예: 100번, 201번 등" 
									bind:value={formRouteName}
									class="input-bordered input w-full rounded-xl bg-slate-50 text-sm font-bold text-black border-2 border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none"
								/>
							</div>

							<div class="form-control w-full">
								<label class="label py-1" for="routeVersionInput">
									<span class="label-text font-black text-slate-700 text-xs">노선 버전식별값</span>
								</label>
								<input 
									type="text" 
									id="routeVersionInput"
									placeholder="예: v1, v2" 
									bind:value={formVersion}
									class="input-bordered input w-full rounded-xl bg-slate-50 text-sm font-bold text-black border-2 border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none"
								/>
							</div>

							<!-- 중요: 로번 수가 변경되면 하단 2단계 로번 시간표 행이 실시간 자동 증감됩니다. -->
							<div class="form-control w-full">
								<label class="label py-1" for="vehicleCountInput">
									<span class="label-text font-black text-indigo-600 text-xs">⚠️ 할당 배차 로번 수 (입력 시 스케줄 행 자동 연동)</span>
								</label>
								<input 
									type="number" 
									id="vehicleCountInput"
									min="1"
									bind:value={formVehicleCount}
									class="input-bordered input w-full rounded-xl bg-slate-50 text-sm font-black text-indigo-600 border-2 border-indigo-500/40 focus:border-indigo-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
								/>
							</div>

							<div class="form-control w-full">
								<label class="label py-1" for="routeTypeSelect">
									<span class="label-text font-black text-slate-700 text-xs">노선 가동 종류</span>
								</label>
								<select 
									id="routeTypeSelect"
									bind:value={formRouteType}
									class="select-bordered select w-full rounded-xl bg-slate-50 text-sm font-bold text-black border-2 border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none"
								>
									<option value="REGULAR">REGULAR (정규노선)</option>
									<option value="TEMPORARY">TEMPORARY (임시노선)</option>
								</select>
							</div>

							<div class="form-control w-full">
								<label class="label py-1" for="startDateInput">
									<span class="label-text font-black text-slate-700 text-xs">시작 적용일자</span>
								</label>
								<input 
									type="date" 
									id="startDateInput"
									bind:value={formStartDate}
									class="input-bordered input w-full rounded-xl bg-slate-50 text-sm font-bold text-black border-2 border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none"
								/>
							</div>

							<div class="form-control w-full">
								<label class="label py-1" for="endDateInput">
									<span class="label-text font-black text-slate-700 text-xs">종료 예정일자 (선택)</span>
								</label>
								<input 
									type="date" 
									id="endDateInput"
									bind:value={formEndDate}
									class="input-bordered input w-full rounded-xl bg-slate-50 text-sm font-bold text-black border-2 border-slate-200 focus:border-indigo-500 focus:bg-white focus:outline-none"
								/>
							</div>
						</div>
					</div>

					<!-- 섹션 2: 배정된 로번 수만큼 동적 동기화 출력되는 시간표 -->
					<div class="mt-4 space-y-4">
						<div class="flex items-center gap-1.5 border-t border-slate-100 pt-5 text-base font-black text-slate-900">
							<span class="flex h-5.5 w-5.5 items-center justify-center rounded-full bg-slate-900 text-xs text-white">2</span>
							<span>로번 수별 일일 근무 요약 시간표 설정 ({formVehicleCount}개 등록 중)</span>
						</div>

						<p class="text-xs font-bold text-slate-400">
							* 위의 로번 수를 수정하면 아래의 시간표 줄 수가 동적으로 변경됩니다. 각 로번의 실질적인 하루 전체 가동 근무시간(시작/종료) 및 기종점 요약 정보를 입력해 주세요. (🕒 **시간은 24시간제(00:00~23:59)로 입력됩니다**)
						</p>

						<!-- 동기화 리스트 출력 영역 -->
						<div class="space-y-3">
							{#each formTimetables as timetable, index (index)}
								<div class="flex flex-col gap-3 rounded-2xl border-2 border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-slate-300 md:flex-row md:items-center">
									
									<div class="flex items-center gap-3 shrink-0 md:flex-col md:gap-1.5 md:w-24 text-center">
										<div class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white mx-auto">
											{timetable.seq}
										</div>
										<span class="text-[11px] font-black text-slate-500 uppercase">로번</span>
									</div>

									<div class="grid grid-cols-2 gap-3.5 flex-1 md:grid-cols-5">
										
										<!-- 운행 시작 시간 (24H 한정 가이드) -->
										<div class="form-control">
											<label class="label py-0.5" for="startTimeInput-{index}">
												<span class="label-text text-[10px] font-black text-indigo-600">출발 (24H 표기)</span>
											</label>
											<input 
												type="text" 
												id="startTimeInput-{index}"
												value={timetable.start_time}
												oninput={(e) => handleTimeInput(e, timetable, 'start_time')}
												class="input-bordered input input-sm w-full rounded-lg bg-white text-xs font-bold text-black border-2 border-indigo-500/20 focus:outline-none focus:border-indigo-500"
												placeholder="예: 08:30"
												maxlength="5"
											/>
										</div>

										<!-- 운행 종료 시간 (24H 한정 가이드) -->
										<div class="form-control">
											<label class="label py-0.5" for="endTimeInput-{index}">
												<span class="label-text text-[10px] font-black text-indigo-600">종료 (24H 표기)</span>
											</label>
											<input 
												type="text" 
												id="endTimeInput-{index}"
												value={timetable.end_time}
												oninput={(e) => handleTimeInput(e, timetable, 'end_time')}
												class="input-bordered input input-sm w-full rounded-lg bg-white text-xs font-bold text-black border-2 border-indigo-500/20 focus:outline-none focus:border-indigo-500"
												placeholder="예: 20:00"
												maxlength="5"
											/>
										</div>

										<!-- 출발 기점 위치 -->
										<div class="form-control">
											<label class="label py-0.5" for="startLocInput-{index}">
												<span class="label-text text-[10px] font-black text-slate-400">출발 기점 위치</span>
											</label>
											<input 
												type="text" 
												id="startLocInput-{index}"
												placeholder="예: 제주공항"
												bind:value={timetable.start_location}
												class="input-bordered input input-sm w-full rounded-lg bg-white text-xs font-bold text-black border border-slate-200 focus:outline-none focus:border-indigo-500"
											/>
										</div>

										<!-- 도착 종점 위치 -->
										<div class="form-control">
											<label class="label py-0.5" for="endLocInput-{index}">
												<span class="label-text text-[10px] font-black text-slate-400">도착 종점 위치</span>
											</label>
											<input 
												type="text" 
												id="endLocInput-{index}"
												placeholder="예: 성산포"
												bind:value={timetable.end_location}
												class="input-bordered input input-sm w-full rounded-lg bg-white text-xs font-bold text-black border border-slate-200 focus:outline-none focus:border-indigo-500"
											/>
										</div>

										<!-- 당연 근무 토글 (도착 종점 위치 바로 오른쪽에 밀착 배치) -->
										<div class="form-control flex flex-col items-center justify-center">
											<label class="label py-0.5" for="isRegularDutyToggle-form-{index}">
												<span class="label-text text-[10px] font-black text-indigo-600">당연 근무</span>
											</label>
											<button 
												type="button" 
												id="isRegularDutyToggle-form-{index}"
												onclick={() => timetable.is_regular_duty = !timetable.is_regular_duty}
												class="relative inline-flex h-7.5 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {timetable.is_regular_duty ? 'bg-indigo-600' : 'bg-slate-300'}"
											>
												<span 
													class="pointer-events-none inline-block h-5.5 w-5.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {timetable.is_regular_duty ? 'translate-x-5.5' : 'translate-x-0'}"
												></span>
											</button>
										</div>

									</div>
								</div>
							{/each}
						</div>
					</div>

					<!-- 최종 하단 제어부 -->
					<div class="flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
						<button onclick={cancelForm} type="button" class="btn rounded-xl border-none bg-slate-100 px-6 font-black text-slate-600 transition-all hover:bg-slate-200">
							수정 취소
						</button>
						<button onclick={saveRoute} type="button" class="btn rounded-xl border-none bg-indigo-600 px-8 font-black text-white shadow-md transition-all hover:bg-indigo-700">
							<Icon icon="mdi:check-circle" class="h-5 w-5" />
							스케줄 최종 저장
						</button>
					</div>

				</div>
			{/if}

		</div>

	</div>

</div>
