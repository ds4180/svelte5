<script>
	/**
	 * @file src/routes/(app)/v1/admin/dispatch/+page.svelte
	 * @description [Phase 1] 관리 레이아웃 + 쌩 엑셀 표(2열) 통합 버전 (API 연동, 기사 목록 리소스 보드 완비)
	 */
	import { untrack } from 'svelte';
	import Icon from '@iconify/svelte';
	import { fade } from 'svelte/transition';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDate } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import {
		adminGetActiveRouteMasters,
		adminGetDailyDispatch,
		adminSaveDailyDispatch
	} from '$lib/api/admin';
	import fleetData from '$lib/data/vehicles.json';
	import driverData from '$lib/data/drivers.json';

	let routes = $state([]);
	let selectedRoute = $state(null);
	let dispatchRows = $state([]);
	let isAutoFilled = $state(false);
	let originalDispatchRows = $state([]);
	let isHideRecommendations = $state(false);

	let isLocked = $state(false);
	let lockedBy = $state('');

	// --- 날짜 관리 로직 ---
	const getToday = () => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	};

	let today = getToday();
	let selectedDate = $state(getToday());

	const formatDateISO = (date) => formatDate(date);

	const formatDateDisplay = (date) => {
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${m}.${d}`;
	};

	const formatFullDate = (date) => {
		const days = ['일', '월', '화', '수', '목', '금', '토'];
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		const day = days[date.getDay()];
		return `${y}-${m}-${d} (${day})`;
	};

	let selectedDateKey = $derived(formatDateISO(selectedDate));
	let selectedFullDate = $derived(formatFullDate(selectedDate));
	let activeRoutesForRender = $derived(
		selectedRoute?.id === 'ALL' ? routes : selectedRoute ? [selectedRoute] : []
	);
	let assignedDriversCount = $derived(dispatchRows.filter((r) => r.driver_name).length);
	let assignRate = $derived(
		dispatchRows.length > 0 ? Math.round((assignedDriversCount / dispatchRows.length) * 100) : 0
	);

	function setDate(date) {
		selectedDate = new Date(date);
		selectedDate.setHours(0, 0, 0, 0);
		selectedDriver = null; // 날짜 변경 시 선택 초기화
	}

	function moveDate(offset) {
		const newDate = new Date(selectedDate);
		newDate.setDate(selectedDate.getDate() + offset);
		setDate(newDate);
	}

	// 상대적 날짜 레이블 생성 (오늘 기준)
	function getRelativeLabel(targetDate) {
		const diff = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
		if (diff === 0) return '오늘';
		if (diff === 1) return '내일';
		if (diff === 2) return '모레';
		if (diff === -1) return '어제';
		if (diff === -2) return '그저께';
		return diff > 0 ? `${diff}일 뒤` : `${Math.abs(diff)}일 전`;
	}

	let prevDate = $derived.by(() => {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() - 1);
		return d;
	});

	let nextDate = $derived.by(() => {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() + 1);
		return d;
	});

	// --- API 연동 로직 ---
	let fetchToken = 0;
	let lastLoadedRoutesDate = '';

	async function syncData(dateKey, forceRouteId = null) {
		const token = ++fetchToken;
		try {
			// 1. 만약 날짜가 변경되었다면 노선 목록을 새로 로드합니다.
			if (dateKey !== lastLoadedRoutesDate) {
				const activeRoutes = await adminGetActiveRouteMasters(dateKey);
				if (token !== fetchToken) return; // Stale request, ignore!

				routes = activeRoutes;
				lastLoadedRoutesDate = dateKey;

				if (activeRoutes.length > 0) {
					// forceRouteId가 제공되었다면 해당 노선, 아니라면 이전 선택과 이름/ID가 맞는 노선, 없으면 'ALL' 전체 선택
					const targetId = forceRouteId || selectedRoute?.id;
					if (targetId === 'ALL') {
						selectedRoute = { id: 'ALL', route_name: '전체 노선' };
					} else {
						const found = activeRoutes.find(
							(r) => r.id === targetId || r.route_name === selectedRoute?.route_name
						);
						if (found) {
							selectedRoute = found;
						} else {
							selectedRoute = { id: 'ALL', route_name: '전체 노선' }; // Default to 'ALL' for premium experience
						}
					}
				} else {
					selectedRoute = null;
				}
			} else if (forceRouteId !== null) {
				// 날짜는 같고 노선만 사용자가 직접 바꾼 경우
				if (forceRouteId === 'ALL') {
					selectedRoute = { id: 'ALL', route_name: '전체 노선' };
				} else {
					const found = routes.find((r) => r.id === forceRouteId);
					if (found) {
						selectedRoute = found;
					}
				}
			}

			// 2. 선택된 노선이 존재한다면 해당 노선에 맞게 배차 데이터를 불러옵니다.
			if (selectedRoute) {
				if (selectedRoute.id === 'ALL') {
					// 🌟 [전체 노선] 모든 활성 노선의 배차 데이터를 병렬 비동기 수집
					const fetchPromises = routes.map(async (r) => {
						try {
							const data = await adminGetDailyDispatch(dateKey, r.id);

							// 전담 차량 목록을 노선명 기준으로 직접 가져옵니다.
							const routeName = r.route_name || '';
							let targetFleet = [];
							if (routeName.includes('121') || routeName.includes('122')) {
								targetFleet = fleetData.vehicles['121/122'] || [];
							} else if (
								routeName.includes('291') ||
								routeName.includes('292') ||
								routeName.includes('293')
							) {
								targetFleet = fleetData.vehicles['291/292/293'] || [];
							} else {
								targetFleet = [
									...(fleetData.vehicles['121/122'] || []),
									...(fleetData.vehicles['291/292/293'] || [])
								];
							}

							return data.map((row, index) => {
								const updatedRow = { ...row, route_id: r.id, route_name: r.route_name };
								if (!updatedRow.vehicle_no && targetFleet[index]) {
									updatedRow.vehicle_no = targetFleet[index];
								}
								return updatedRow;
							});
						} catch (e) {
							console.error(`❌ [${r.route_name}] 개별 노선 로드 실패:`, e);
							return [];
						}
					});

					const results = await Promise.all(fetchPromises);
					if (token !== fetchToken) return;

					dispatchRows = results.flat();
					originalDispatchRows = JSON.parse(JSON.stringify(dispatchRows));
					isAutoFilled = false;
				} else {
					const routeId = selectedRoute.id;
					const data = await adminGetDailyDispatch(dateKey, routeId);
					if (token !== fetchToken) return; // Stale request, ignore!

					// 전담 차량 목록을 노선명 기준으로 직접 가져옵니다.
					const routeName = selectedRoute.route_name || '';
					let targetFleet = [];

					if (routeName.includes('121') || routeName.includes('122')) {
						targetFleet = fleetData.vehicles['121/122'] || [];
					} else if (
						routeName.includes('291') ||
						routeName.includes('292') ||
						routeName.includes('293')
					) {
						targetFleet = fleetData.vehicles['291/292/293'] || [];
					} else {
						targetFleet = [
							...(fleetData.vehicles['121/122'] || []),
							...(fleetData.vehicles['291/292/293'] || [])
						];
					}

					dispatchRows = data.map((row, index) => {
						const updatedRow = { ...row, route_id: routeId, route_name: routeName };
						if (!updatedRow.vehicle_no && targetFleet[index]) {
							updatedRow.vehicle_no = targetFleet[index];
						}
						return updatedRow;
					});
					originalDispatchRows = JSON.parse(JSON.stringify(dispatchRows));
					isAutoFilled = false;
				}
			} else {
				dispatchRows = [];
			}
		} catch (err) {
			console.error('❌ Failed to sync dispatch data:', err);
			if (token === fetchToken) {
				dispatchRows = [];
			}
		}
	}

	// 날짜가 변경될 때에만 자동으로 동기화 트리거
	$effect(() => {
		const date = selectedDateKey;
		if (date) {
			untrack(() => {
				syncData(date);
			});
		}
	});

	// --- 자원 배정 로직 (기사) ---
	let selectedDriver = $state(null);

	// 현재 선택된 노선의 기배정 기사 목록
	let assignedDrivers = $derived(
		dispatchRows.map((d) => d.driver_name).filter((name) => name && name !== '')
	);

	// 투입 가능한 기사 필터링 (기선택된 기사 제외)
	let availableDrivers = $derived(
		driverData.filter((driver) => !assignedDrivers.includes(driver.name))
	);

	// 기사 선택 및 토글
	function selectDriver(driver) {
		if (selectedDriver?.name === driver.name) {
			selectedDriver = null;
		} else {
			selectedDriver = driver;
		}
	}

	// 기사 파트너 조회 (교대 복구용)
	function getAlternatePartner(driver) {
		if (!driver || !driver.vehicle_no) return null;
		if (driver.role === 'MAIN') {
			return driverData.find((d) => d.vehicle_no === driver.vehicle_no && d.role === 'SUB');
		} else if (driver.role === 'SUB') {
			return driverData.find((d) => d.vehicle_no === driver.vehicle_no && d.role === 'MAIN');
		}
		return null;
	}

	// 내일 자 예측 컬럼의 기사명을 전반적으로 재계산/동기화해줍니다 (당연근무 회전 및 동일차량 로테이션 반영)
	function updateTomorrowPredictions() {
		const N = dispatchRows.length;
		if (N === 0) return;

		dispatchRows = dispatchRows.map((row) => {
			const updatedRow = { ...row };

			// 사용자가 수동으로 내일 기사를 직접 고정한 경우(자동 추천 상태가 아님), 재계산에서 건너뜁니다.
			if (updatedRow.tomorrow_driver_name && !updatedRow.is_tomorrow_inherited) {
				return updatedRow;
			}

			// 오늘 당연근무인 경우: 오늘과 내일 연속 근무이므로 교대 로테이션 없이 오늘 기사를 내일 기사로 그대로 유지
			if (updatedRow.is_regular_duty) {
				if (updatedRow.driver_name && updatedRow.driver_name.trim()) {
					updatedRow.tomorrow_driver_name = updatedRow.driver_name.trim();
					updatedRow.is_tomorrow_inherited = true;
				} else {
					updatedRow.tomorrow_driver_name = '';
					updatedRow.is_tomorrow_inherited = false;
				}
			} else {
				// 내일 당연근무가 아닌 경우 (오늘 당연근무이거나 둘 다 아닌 경우): 오늘 기사의 파트너 기사로 정상 교대(로테이션)
				if (updatedRow.driver_name && updatedRow.driver_name.trim()) {
					const todayDriverObj = driverData.find((d) => d.name === updatedRow.driver_name.trim());
					if (todayDriverObj && (todayDriverObj.role === 'MAIN' || todayDriverObj.role === 'SUB')) {
						const partner = getAlternatePartner(todayDriverObj);
						if (partner) {
							updatedRow.tomorrow_driver_name = partner.name;
							updatedRow.is_tomorrow_inherited = true;
						} else {
							updatedRow.tomorrow_driver_name = updatedRow.driver_name;
							updatedRow.is_tomorrow_inherited = true;
						}
					} else {
						// 예비기사나 기타 기사인 경우 다음날은 예측할 수 없으므로 빈 칸
						updatedRow.tomorrow_driver_name = '';
						updatedRow.is_tomorrow_inherited = false;
					}
				} else {
					updatedRow.tomorrow_driver_name = '';
					updatedRow.is_tomorrow_inherited = false;
				}
			}
			return updatedRow;
		});
	}

	// 오늘 기사 배정 및 해제
	function assignTodayDriver(row) {
		if (selectedDriver) {
			row.driver_name = selectedDriver.name;
			// 주기사/보조기사이면서 매핑된 차량 번호가 있는 경우, 해당 행의 차량 번호도 자동 기입해 줍니다.
			if (selectedDriver.vehicle_no) {
				row.vehicle_no = selectedDriver.vehicle_no;
			}
			selectedDriver = null;
		} else {
			row.driver_name = '';
		}
		row.is_inherited = false; // 수동 조작 시 상속 플래그 해제

		// 내일 예측 컬럼을 전체적으로 즉시 재계산 및 갱신해줍니다.
		updateTomorrowPredictions();
	}

	// 다음 날 기사 배정 및 해제
	function assignTomorrowDriver(row) {
		if (selectedDriver) {
			row.tomorrow_driver_name = selectedDriver.name;
			row.is_tomorrow_inherited = false; // 사용자가 명시적으로 선택한 경우, 자동 입력 표시 제거
			selectedDriver = null;
		} else {
			row.tomorrow_driver_name = '';
			row.is_tomorrow_inherited = false;
		}
		row.is_inherited = false; // 수동 조작 시 상속 플래그 해제
	}

	// 전체 자동 채우기 기능 및 취소 복원
	function autoFillDrivers() {
		if (!dispatchRows || dispatchRows.length === 0) return;

		if (isAutoFilled) {
			// 이미 자동 채우기가 적용된 상태라면 취소하고 복원
			dispatchRows = dispatchRows.map((row, index) => {
				const orig = originalDispatchRows[index];
				const updatedRow = { ...row };

				// 원래 승계(연보라색)였던 기사 칸은 취소 시 완벽한 빈 칸("")으로 깨끗이 클리어
				if (orig.is_inherited) {
					updatedRow.driver_name = '';
					updatedRow.is_inherited = false;
				} else {
					updatedRow.driver_name = orig.driver_name;
					updatedRow.is_inherited = orig.is_inherited;
				}

				// 원래 자동(연보라색)이었던 기사 칸 또한 취소 시 완벽한 빈 칸("")으로 깨끗이 클리어
				if (orig.is_tomorrow_inherited) {
					updatedRow.tomorrow_driver_name = '';
					updatedRow.is_tomorrow_inherited = false;
				} else {
					updatedRow.tomorrow_driver_name = orig.tomorrow_driver_name;
					updatedRow.is_tomorrow_inherited = orig.is_tomorrow_inherited;
				}

				updatedRow.vehicle_no = orig.vehicle_no;
				updatedRow.start_time = orig.start_time;
				updatedRow.memo = orig.memo;

				return updatedRow;
			});
			isAutoFilled = false;
		} else {
			// 원본 백업
			originalDispatchRows = JSON.parse(JSON.stringify(dispatchRows));

			// 1단계: 오늘 기사 자동 채우기 (현재 칸이 빈 칸인 경우만 작동)
			dispatchRows = dispatchRows.map((row) => {
				const updatedRow = { ...row };
				const isTodayBlank = !updatedRow.driver_name || !updatedRow.driver_name.trim();

				if (isTodayBlank) {
					const yesterdayName = updatedRow.yesterday_driver_name || '';
					if (yesterdayName) {
						if (updatedRow.is_yesterday_regular_duty) {
							// 어제 당연근무를 수행한 경우: 교대 로테이션 없이 어제 기사가 그대로 오늘 당연근무로 투입 (연속 근무)
							updatedRow.driver_name = yesterdayName;
						} else {
							// 일반근무인 경우: 어제 동일 차량의 근무자가 정규 기사(MAIN/SUB)라면 파트너 교대
							const ydDriverObj = driverData.find((d) => d.name === yesterdayName);
							if (ydDriverObj && (ydDriverObj.role === 'MAIN' || ydDriverObj.role === 'SUB')) {
								const mainDriver = driverData.find(
									(d) => d.vehicle_no === updatedRow.vehicle_no && d.role === 'MAIN'
								);
								const subDriver = driverData.find(
									(d) => d.vehicle_no === updatedRow.vehicle_no && d.role === 'SUB'
								);

								if (ydDriverObj.role === 'MAIN') {
									updatedRow.driver_name = subDriver ? subDriver.name : '';
								} else if (ydDriverObj.role === 'SUB') {
									updatedRow.driver_name = mainDriver ? mainDriver.name : '';
								}
							} else {
								updatedRow.driver_name = '';
							}
						}
					} else {
						updatedRow.driver_name = '';
					}
				}

				// 자동 채우기 적용 시 임시/승계 상태를 해제하여 확정(녹색) 상태로 렌더링
				updatedRow.is_inherited = false;
				return updatedRow;
			});

			// 2단계: 오늘 기사 확정에 따라 내일 기사 전체 예측/동기화 실행
			updateTomorrowPredictions();

			// 자동 채우기로 예측된 내일 기사 또한 확정(녹색/자동 뱃지 없음) 상태로 저장될 수 있도록 플래그 해제
			dispatchRows = dispatchRows.map((row) => {
				const updatedRow = { ...row };
				updatedRow.is_tomorrow_inherited = false;
				return updatedRow;
			});

			isAutoFilled = true;
		}
	}

	function selectRoute(route) {
		selectedRoute = route;
		selectedDriver = null;
		syncData(selectedDateKey, route.id);
	}

	// 배차 일괄 저장 (DRAFT or CONFIRMED)
	async function saveDispatch(status) {
		if (!selectedRoute) {
			toast.warning('선택된 노선이 없습니다.');
			return;
		}
		try {
			if (selectedRoute.id === 'ALL') {
				const groupedPayloads = routes
					.map((r) => {
						const rRows = dispatchRows.filter((row) => row.route_id === r.id);
						if (rRows.length === 0) return null;
						return {
							target_date: selectedDateKey,
							route_master_id: r.id,
							status: status,
							rows: rRows.map((row) => ({
								timetable_id: row.timetable_id,
								driver_name: row.driver_name || null,
								tomorrow_driver_name: row.tomorrow_driver_name || null,
								vehicle_no: row.vehicle_no || null,
								start_time: row.start_time || null,
								memo: row.memo || null
							}))
						};
					})
					.filter((p) => p !== null);

				await Promise.all(groupedPayloads.map((payload) => adminSaveDailyDispatch(payload)));
			} else {
				const payload = {
					target_date: selectedDateKey,
					route_master_id: selectedRoute.id,
					status: status,
					rows: dispatchRows.map((row) => ({
						timetable_id: row.timetable_id,
						driver_name: row.driver_name || null,
						tomorrow_driver_name: row.tomorrow_driver_name || null,
						vehicle_no: row.vehicle_no || null,
						start_time: row.start_time || null,
						memo: row.memo || null
					}))
				};
				await adminSaveDailyDispatch(payload);
			}
			toast.success(
				status === 'CONFIRMED'
					? '배차 정보가 17시 확정 공지되었습니다.'
					: '배차 정보가 성공적으로 임시저장되었습니다.'
			);

			// 데이터 재로딩
			await syncData(selectedDateKey, selectedRoute.id);
		} catch (err) {
			toast.error('배차 저장 실패: ' + formatApiError(err, '오류'));
		}
	}

	// 내일 확정 공지 상태 (모든 행이 CONFIRMED 인지 여부 판단)
	let isTomorrowAnnounced = $derived(
		dispatchRows.length > 0 && dispatchRows.every((row) => row.status === 'CONFIRMED')
	);
</script>

<svelte:head>
	<title>{getSiteTitle('차량 배차 관리')}</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-[1800px] space-y-4 px-1 py-4 pb-20 font-['Noto_Sans_KR','Outfit'] sm:px-2 md:space-y-8 md:px-3 md:py-6 lg:px-4"
>
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 액션 바 (기본값: 새로고침 + 관리자 홈) -->
	<!-- ===================================================================== -->
	<div
		class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8"
	>
		<div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase"
				>
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					Fleet Dispatch Canvas
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/dispatch</span>
				{#if isLocked}
					<span
						class="animate-pulse rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 uppercase"
						>Lock by {lockedBy}</span
					>
				{/if}
			</div>
			<h1
				class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl"
			>
				차량 배차 <span class="text-blue-600 not-italic">관리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				노선별 운행 시간표와 로번을 바탕으로 기사 및 차량을 배정하고 17시 확정 공지를 수행합니다.
			</p>
		</div>

		<!-- 상단 버튼 그룹 (맨 우측 [관리자 홈], 그 좌측 [새로고침] 고정, 이후 버튼은 새로고침 좌측) -->
		<div class="flex flex-wrap items-center gap-3">
			{#if selectedRoute}
				<button
					class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-md transition hover:bg-blue-700 active:scale-95"
					onclick={() => saveDispatch('CONFIRMED')}
				>
					<Icon icon="solar:bell-bold" class="text-base" />
					<span>{isTomorrowAnnounced ? '17시 재공지 완료' : '17시 확정 공지'}</span>
				</button>
			{/if}

			<button
				onclick={() => syncData(selectedDateKey, selectedRoute?.id)}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:restart-bold" class="text-base" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 관제 지표 요약 카드 (Status Cards: 1~4개) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4">
		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase"
					>Target Routes</span
				>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"
				>
					<Icon icon="solar:route-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">
					{routes.length} <span class="text-xs font-normal text-slate-500">개</span>
				</div>
				<div class="mt-1 text-xs font-bold text-indigo-600">운행 대상 노선</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase"
					>Duty Slots</span
				>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
				>
					<Icon icon="solar:bus-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-blue-600">
					{dispatchRows.length} <span class="text-xs font-normal text-slate-500">개</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">운행 로번 슬롯</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase"
					>Assignment Rate</span
				>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
				>
					<Icon icon="solar:users-group-rounded-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-emerald-600">{assignRate}%</div>
				<div class="mt-1 text-xs font-bold text-slate-400">
					기사 배정 완료 ({assignedDriversCount}/{dispatchRows.length || 0})
				</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400 uppercase"
					>Broadcast Status</span
				>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl {isTomorrowAnnounced
						? 'bg-emerald-50 text-emerald-600'
						: 'bg-amber-50 text-amber-600'}"
				>
					<Icon icon="solar:soundwave-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div
					class="text-xl font-black {isTomorrowAnnounced ? 'text-emerald-600' : 'text-amber-600'}"
				>
					{isTomorrowAnnounced ? '17시 공지 완료' : '작성/미확정'}
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">기준일: {selectedDateKey}</div>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 전사 공통 탭 바 (최소 1개 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<div class="flex items-center border-b-2 border-slate-200">
		<button
			type="button"
			class="flex items-center gap-2 rounded-t-2xl border-b-4 border-blue-600 bg-blue-50/50 px-6 py-3 text-xs font-black text-blue-600 transition"
		>
			<Icon icon="solar:calendar-bold-duotone" class="text-base" />
			<span>일일 배차 캔버스 ({selectedDateKey})</span>
		</button>
	</div>

	<!-- 날짜 네비게이션 (반응형) -->
	<div
		class="mb-4 flex flex-col gap-2 rounded-xl border-2 border-slate-900 bg-white p-2 shadow-[3px_3px_0_rgba(0,0,0,1)] md:flex-row md:items-center md:justify-between"
	>
		<div class="flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
			<!-- 이전 날짜 -->
			<button
				class="flex flex-col items-center rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 sm:px-3"
				onclick={() => moveDate(-1)}
			>
				<span class="text-[9px] tracking-tighter uppercase opacity-70"
					>{getRelativeLabel(prevDate)}</span
				>
				<div class="flex items-center gap-1">
					<Icon icon="ph:caret-left-bold" />
					{formatDateDisplay(prevDate)}
				</div>
			</button>

			<!-- 선택된 날짜 -->
			<div
				class="group relative flex flex-col items-center overflow-hidden rounded-lg bg-slate-900 px-3 py-2 text-white shadow-md sm:px-5"
			>
				<div
					class="absolute inset-0 translate-y-full bg-blue-600/10 transition-transform group-hover:translate-y-0"
				></div>
				<span class="z-10 mb-0.5 text-[9px] font-black tracking-[0.2em] text-blue-400 uppercase">
					{getRelativeLabel(selectedDate)} Target
				</span>
				<div class="z-10 flex items-center gap-2">
					<Icon icon="ph:calendar-star-fill" class="text-sm text-blue-400 sm:text-base" />
					<span class="text-xs font-black tracking-tight">{selectedFullDate}</span>
				</div>
			</div>

			<!-- 다음 날짜 -->
			<button
				class="flex flex-col items-center rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-400 transition-all hover:bg-slate-100 hover:text-slate-900 sm:px-3"
				onclick={() => moveDate(1)}
			>
				<span class="text-[9px] tracking-tighter uppercase opacity-70"
					>{getRelativeLabel(nextDate)}</span
				>
				<div class="flex items-center gap-1">
					{formatDateDisplay(nextDate)}
					<Icon icon="ph:caret-right-bold" />
				</div>
			</button>

			<div class="mx-1 hidden h-8 w-[2px] bg-slate-100 sm:block"></div>

			<!-- 오늘로 복귀 -->
			<button
				class="flex items-center justify-center gap-1.5 rounded-lg border-2 border-slate-900 px-3 py-2 text-[11px] font-black tracking-tight transition-all hover:bg-slate-900 hover:text-white"
				onclick={() => setDate(today)}
			>
				<Icon icon="ph:arrow-u-up-left-bold" />
				<span>오늘로</span>
			</button>
		</div>

		<div
			class="flex items-center justify-around gap-4 border-t border-slate-100 px-2 pt-2 sm:px-4 md:justify-end md:border-t-0 md:pt-0"
		>
			<div class="flex items-center gap-2 md:flex-col md:items-end md:gap-0">
				<span class="text-[10px] font-black tracking-tight text-slate-400">배정 기사</span>
				<div class="flex items-baseline gap-1">
					<span class="text-base font-black text-emerald-600 sm:text-lg"
						>{assignedDrivers.length}</span
					>
					<span class="text-[11px] font-bold text-slate-400">/ {driverData.length}</span>
				</div>
			</div>
			<div class="h-6 w-[1px] bg-slate-200 md:h-8"></div>
			<div class="flex items-center gap-2 md:flex-col md:items-end md:gap-0">
				<span class="text-[10px] font-black tracking-tight text-slate-400">운행 노선</span>
				<span class="text-base font-black text-slate-900 sm:text-lg">{routes.length}</span>
			</div>
		</div>
	</div>

	<!-- 🚌 노선 선택 수평 칩 그룹 (전체 노선 포함) -->
	{#if routes.length > 0}
		<div class="mb-4 flex scrollbar-none items-center gap-1.5 overflow-x-auto pt-0.5 pb-3">
			<!-- 🌟 "전체 노선" 전용 버튼 탑재 -->
			<button
				class="flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-xs font-extrabold shadow-sm transition-all
                {selectedRoute?.id === 'ALL'
					? 'border-slate-900 bg-slate-900 text-white shadow-slate-200'
					: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
				onclick={() => selectRoute({ id: 'ALL', route_name: '전체 노선' })}
			>
				<Icon icon="lucide:layout-grid" class="h-4 w-4" />
				전체 노선
			</button>

			{#each routes as r}
				<button
					class="flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-4 py-2.5 text-xs font-extrabold shadow-sm transition-all
                    {selectedRoute?.id === r.id
						? 'border-slate-900 bg-slate-900 text-white shadow-slate-200'
						: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
					onclick={() => selectRoute(r)}
				>
					<span
						class="h-1.5 w-1.5 rounded-full {selectedRoute?.id === r.id
							? 'bg-white'
							: 'bg-slate-400'}"
					></span>
					{r.route_name}
				</button>
			{/each}
		</div>
	{/if}

	{#if !selectedRoute}
		<div
			class="flex min-h-[400px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 shadow-lg"
			transition:fade
		>
			<Icon icon="ph:calendar-x-bold" class="mb-4 text-6xl text-slate-300" />
			<h3 class="mb-1 text-lg font-black text-slate-700">활성화된 노선이 없습니다</h3>
			<p class="text-sm text-slate-400">
				선택하신 날짜({selectedFullDate})에 운행 중인 노선 마스터 도면이 존재하지 않습니다.
			</p>
			<p class="mt-2 text-xs text-slate-400">
				노선 마스터 관리 페이지에서 이 날짜에 해당하는 유효한 노선을 먼저 등록해주세요.
			</p>
		</div>
	{:else}
		<main class="w-full space-y-4" transition:fade>
			<div class="flex flex-col gap-2">
				<div class="flex items-center justify-between">
					<h2 class="flex items-center gap-2 text-xl font-black text-slate-900">
						<div class="h-6 w-2.5 rounded-full bg-blue-600"></div>
						{selectedRoute.route_name} 배차표 조율 캔버스
						<span
							class="ml-3 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-black tracking-tight text-white shadow-sm"
						>
							{selectedFullDate}
						</span>
					</h2>
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-2">
							<div class="h-3 w-3 rounded border border-emerald-300 bg-emerald-100"></div>
							<span class="text-[10px] font-bold text-slate-500">배정됨</span>
						</div>
						<div
							class="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold tracking-tighter text-slate-400 uppercase"
						>
							Widescreen Excel-Density Grid
						</div>
					</div>
				</div>
			</div>

			<!-- 🚐 [Density Excel Sheet + 인라인 기사 보드] 좌우 병렬 배치 -->
			<div class="mt-2 flex flex-wrap items-start gap-4">
				<div class="w-full max-w-full lg:w-[580px] lg:flex-none xl:w-[620px]">
					{#each activeRoutesForRender as route}
						{@const routeRowsCount = dispatchRows.filter((row) => row.route_id === route.id).length}
						{#if routeRowsCount > 0}
							<div class="mb-6">
								<!-- 🏷️ 노선 전용 구분 헤더 -->
								<div class="mb-2 flex items-center justify-between px-1">
									<h3 class="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
										<span class="inline-block h-4 w-2 rounded-sm bg-indigo-600"></span>
										{route.route_name} 배차표
									</h3>
									<span
										class="rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-black tracking-wider text-indigo-700 uppercase"
									>
										{routeRowsCount}개 로번
									</span>
								</div>

								<div
									class="w-full overflow-x-auto rounded-xl border-2 border-slate-900 bg-white shadow-[2px_2px_0_rgba(0,0,0,1)]"
								>
									<table
										class="excel-table w-full border-collapse text-center"
										style="width: 100%;"
									>
										<thead>
											<tr
												class="border-b border-slate-200 bg-slate-100 text-[10.5px] font-extrabold text-slate-600 uppercase sm:text-xs"
											>
												<th class="w-[12%] py-1">차량</th>
												<th class="w-[8%] py-1">로번</th>
												<th class="w-[14%] py-1">출발/종료</th>
												<th class="w-[20%] py-1">시작/종료</th>
												<th class="w-[15%] py-1" style="background-color: #ecfdf5; color: #047857;"
													>기사</th
												>
												<th class="w-[15%] py-1" style="background-color: #f5f3ff; color: #4338ca;"
													>내일기사</th
												>
												<th class="w-[16%] py-1">비고</th>
											</tr>
										</thead>
										<tbody class="divide-y divide-slate-200">
											{#each dispatchRows as row}
												{#if row.route_id === route.id}
													<tr
														class="transition-all hover:bg-indigo-50/20 {row.is_regular_duty
															? 'bg-indigo-50/10'
															: ''}"
													>
														<!-- 차량 번호 -->
														<td class="border-r bg-blue-50/10 py-0.5">
															<input
																type="text"
																bind:value={row.vehicle_no}
																oninput={() => (row.is_inherited = false)}
																placeholder="차량 번호"
																class="excel-input {row.is_inherited
																	? 'text-indigo-700 italic'
																	: 'text-blue-700'} w-full text-center font-bold"
															/>
														</td>

														<!-- 로번 (turn index, seq) -->
														<td
															class="turn-cell relative border-r bg-amber-50/20 py-0.5 text-center text-base font-extrabold text-amber-900"
														>
															{row.seq}
															{#if row.is_regular_duty}
																<div
																	class="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-indigo-600"
																	title="당연 근무"
																></div>
															{/if}
														</td>

														<!-- 출발 / 종료 시각 (2줄 1셀, 여백 최소화 & 글자 확대) -->
														<td class="stacked-cell border-r bg-blue-50/20">
															<input
																type="text"
																bind:value={row.start_time}
																class="w-full rounded bg-transparent text-center text-[13px] leading-tight font-bold text-blue-700 focus:bg-white focus:outline-none"
															/>
															<div class="text-[13px] leading-tight font-semibold text-slate-500">
																{row.end_time || '-'}
															</div>
														</td>

														<!-- 시작 / 종료 위치 (2줄 1셀, 여백 최소화 & 글자 확대) -->
														<td
															class="stacked-cell border-r bg-slate-50/40"
															title={`${row.start_location || ''} → ${row.end_location || ''}`}
														>
															<div
																class="truncate text-[13px] leading-tight font-semibold text-slate-700"
															>
																{row.start_location || '-'}
															</div>
															<div
																class="truncate text-[13px] leading-tight font-medium text-slate-500"
															>
																{row.end_location || '-'}
															</div>
														</td>

														<!-- 기사 배정 (driver_name) -->
														<td
															class="relative cursor-pointer border-r border-slate-200 transition-colors {selectedDriver
																? 'animate-pulse bg-emerald-100'
																: row.driver_name && (!isHideRecommendations || !row.is_inherited)
																	? row.is_inherited
																		? 'bg-indigo-50/80'
																		: 'bg-emerald-50'
																	: 'bg-emerald-50/20'}"
															onclick={() => assignTodayDriver(row)}
														>
															<input
																type="text"
																value={isHideRecommendations && row.is_inherited
																	? ''
																	: row.driver_name || ''}
																placeholder={selectedDriver ? '배정하기' : '기사 배정'}
																class="excel-input text-center {row.is_inherited
																	? 'text-indigo-700 italic'
																	: 'text-emerald-700'} pointer-events-none font-black"
																readonly
															/>
															{#if row.is_inherited && !isHideRecommendations}
																<span
																	class="absolute top-[1px] right-1 origin-top-right scale-90 text-[11px] leading-none font-extrabold tracking-tighter text-indigo-500"
																	>승계</span
																>
															{/if}
														</td>

														<!-- 다음 날 기사 배정 (tomorrow_driver_name) -->
														<td
															class="relative cursor-pointer border-r border-slate-200 transition-colors {selectedDriver
																? 'animate-pulse bg-indigo-100'
																: row.tomorrow_driver_name &&
																	  (!isHideRecommendations || !row.is_tomorrow_inherited)
																	? row.is_tomorrow_inherited
																		? 'bg-indigo-50/50'
																		: 'bg-indigo-50'
																	: 'bg-indigo-50/20'}"
															onclick={() => assignTomorrowDriver(row)}
														>
															<input
																type="text"
																value={isHideRecommendations && row.is_tomorrow_inherited
																	? ''
																	: row.tomorrow_driver_name || ''}
																placeholder={selectedDriver ? '배정하기' : '기사 지정'}
																class="excel-input text-center {row.is_tomorrow_inherited
																	? 'text-indigo-600/70 italic'
																	: 'text-indigo-800'} pointer-events-none font-black"
																readonly
															/>
															{#if row.is_tomorrow_inherited && !isHideRecommendations}
																<span
																	class="absolute top-[1px] right-1 origin-top-right scale-90 text-[11px] leading-none font-extrabold tracking-tighter text-indigo-500"
																	>자동</span
																>
															{/if}
														</td>

														<!-- 비고/메모 -->
														<td>
															<input
																type="text"
																bind:value={row.memo}
																class="excel-input font-semibold text-slate-600"
																placeholder="메모 입력"
															/>
														</td>
													</tr>
												{/if}
											{/each}
										</tbody>
									</table>
								</div>
							</div>
						{/if}
					{/each}
				</div>

				<!-- 기사 리소스 보드 (표 축소에 맞춰 lg 이상에서 좌우 병렬 배치 보장) -->
				<div class="w-full min-w-[min(100%,300px)] flex-1 lg:sticky lg:top-4">
					<div
						class="flex flex-col overflow-hidden rounded-2xl border-2 border-slate-900 bg-white shadow-[3px_3px_0_rgba(0,0,0,1)]"
					>
						<div
							class="flex items-center justify-between border-b-2 border-slate-900 bg-slate-100 px-4 py-3"
						>
							<h3
								class="flex items-center gap-2 text-xs font-black tracking-tight text-slate-800 uppercase"
							>
								<Icon icon="ph:users-four-fill" class="text-lg text-indigo-600" />
								투입 대기 기사 등록 보드
							</h3>
							<span
								class="badge rounded-full bg-indigo-100 px-3 py-1 text-[10px] font-black tracking-tighter text-indigo-700 uppercase"
							>
								{availableDrivers.length}명 대기중
							</span>
						</div>

						<div class="bg-slate-50/50 p-3">
							{#if availableDrivers.length === 0}
								<div class="py-6 text-center text-xs font-bold text-slate-400">
									현재 투입 대기 중인 기사가 없습니다.
								</div>
							{:else}
								{@const reserveDrivers = availableDrivers.filter(
									(/** @type {any} */ d) => !String(d.vehicle_no || '').trim()
								)}
								{@const vehicleDrivers = availableDrivers.filter((/** @type {any} */ d) =>
									Boolean(String(d.vehicle_no || '').trim())
								)}
								<div class="max-h-[75vh] min-h-[480px] space-y-3 overflow-x-hidden overflow-y-auto">
									<!-- 1. 상단: 예비기사 (차량 번호 없음 -> '예' 아이콘 + 시원한 파랑 카드) -->
									{#if reserveDrivers.length > 0}
										<div class="space-y-2">
											<div class="flex items-center gap-2 border-b border-sky-200 pb-1">
												<span class="text-xs font-black text-sky-700"
													>예비기사 ({reserveDrivers.length})</span
												>
											</div>
											<div class="flex flex-wrap content-start items-start gap-2">
												{#each reserveDrivers as driver}
													<button
														type="button"
														class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[18px] leading-tight font-bold shadow-xs transition-all
                                                        {selectedDriver?.name === driver.name
															? 'border-blue-600 bg-blue-600 text-white shadow-sm'
															: 'border-sky-200 bg-sky-50 text-sky-900 hover:border-sky-400 hover:bg-sky-100'}"
														onclick={() => selectDriver(driver)}
													>
														<span class="font-black tracking-tight">{driver.name}</span>
														<span
															class="rounded px-1.5 py-0.5 text-[13px] font-black {selectedDriver?.name ===
															driver.name
																? 'bg-white/20 text-white'
																: 'bg-sky-600 text-white'}"
														>
															예
														</span>
													</button>
												{/each}
											</div>
										</div>
									{/if}

									<!-- 2. 분리선 + 나머지 차량 배정 기사 -->
									{#if vehicleDrivers.length > 0}
										<div
											class="space-y-2 {reserveDrivers.length > 0
												? 'border-t-2 border-slate-200 pt-3'
												: ''}"
										>
											<div class="flex items-center gap-2 border-b border-slate-200 pb-1">
												<span class="text-xs font-black text-slate-600"
													>차량 기사 ({vehicleDrivers.length})</span
												>
											</div>
											<div class="flex flex-wrap content-start items-start gap-2">
												{#each vehicleDrivers as driver}
													<button
														type="button"
														class="inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[18px] leading-tight font-bold shadow-xs transition-all
                                                        {selectedDriver?.name === driver.name
															? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
															: 'border-slate-200 bg-white text-slate-700 hover:border-indigo-400 hover:bg-indigo-50'}"
														onclick={() => selectDriver(driver)}
													>
														<span class="font-black tracking-tight">{driver.name}</span>
														<span
															class="rounded px-1.5 py-0.5 text-[13px] font-black {selectedDriver?.name ===
															driver.name
																? 'bg-white/20 text-white'
																: driver.role === 'MAIN'
																	? 'bg-blue-100 text-blue-800'
																	: 'bg-amber-100 text-amber-800'}"
														>
															{driver.role === 'MAIN' ? '주' : '보'}
														</span>
														<span
															class="font-mono text-[15px] {selectedDriver?.name === driver.name
																? 'text-indigo-100'
																: 'text-slate-400'}"
														>
															{driver.vehicle_no}
														</span>
													</button>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/if}
						</div>

						<div class="border-t border-slate-200 bg-white px-4 py-2">
							<p class="text-[10px] leading-relaxed font-bold text-slate-500">
								{#if selectedDriver}
									<span class="animate-pulse font-black text-indigo-600"
										>[{selectedDriver.name}] ({selectedDriver.vehicle_no || '전담 차량 없음'})</span
									>
									기사님이 조율 카드로 선택되었습니다. 위 표에서 임의의 노선의
									<span class="font-black text-indigo-600">기사 칸</span>
									또는 <span class="font-black text-indigo-600">다음 날 기사 칸</span>을 클릭하여
									자원을 신속히 임명하십시오.
								{:else}
									* 투입 대기 기사 버튼을 클릭해 기사를 선정한 다음, 원하는 차량의 오늘/다음 날 기사
									칸을 클릭해 즉석에서 배치하십시오.
								{/if}
							</p>
						</div>
					</div>
				</div>
			</div>

			<!-- 하단 저장 버튼 그룹 (반응형) -->
			<div
				class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3"
			>
				<button
					class="btn w-full justify-center sm:w-auto {isAutoFilled
						? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
						: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'} flex items-center gap-1.5 rounded-xl border-2 px-5 font-black shadow-sm transition-all"
					onclick={autoFillDrivers}
				>
					{#if isAutoFilled}
						<Icon icon="ph:x-circle-fill" class="h-4.5 w-4.5" />
						채우기 취소
					{:else}
						<Icon icon="ph:magic-wand-fill" class="h-4.5 w-4.5" />
						자동 채우기
					{/if}
				</button>
				<button
					class="btn w-full justify-center rounded-xl border-2 border-slate-200 bg-white px-5 font-black text-slate-800 hover:bg-slate-50 sm:w-auto"
					onclick={() => saveDispatch('DRAFT')}
				>
					임시저장
				</button>
				<button
					class="btn w-full justify-center rounded-xl border-none bg-slate-900 px-6 font-black text-white shadow-lg hover:bg-black sm:w-auto"
					onclick={() => saveDispatch('CONFIRMED')}
				>
					공지 발행 (확정)
				</button>
			</div>
		</main>
	{/if}
</div>

<style>
	.excel-table {
		border-collapse: collapse;
		width: 100%;
		table-layout: fixed;
	}
	.excel-table th,
	.excel-table td {
		box-sizing: border-box;
		border: 1px solid #ddd;
		padding: 1px 1px !important;
		height: auto;
		font-size: 13px;
		letter-spacing: -0.04em;
		line-height: 1.1;
		text-align: center;
		vertical-align: middle;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.excel-table td.stacked-cell {
		padding: 1px 1px !important;
		line-height: 1.1;
	}
	.excel-table th {
		background-color: #f8fafc;
		font-weight: 800;
		color: #64748b;
		text-transform: uppercase;
		padding: 3px 1px !important;
		font-size: 10.5px;
		letter-spacing: -0.04em;
	}
	.excel-input {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		border: none;
		padding: 1px 0 !important;
		margin: 0 !important;
		font-size: 13px;
		letter-spacing: -0.04em;
		line-height: 1.15;
		outline: none;
		background: transparent;
		font-weight: 600;
		text-align: center;
	}
	@media (min-width: 768px) {
		.excel-table th,
		.excel-table td {
			padding: 1px 2px !important;
			font-size: 16px;
			letter-spacing: -0.03em;
			line-height: 1.15;
		}
		.excel-table th {
			padding: 4px 2px !important;
			font-size: 13px;
		}
		.excel-input {
			padding: 1px !important;
			font-size: 16px;
			letter-spacing: -0.03em;
			line-height: 1.2;
		}
	}
	.excel-input:focus {
		background-color: #f0f7ff;
		box-shadow: inset 0 0 0 2px #3b82f6;
	}
	.turn-cell {
		background-color: #fffbeb;
		font-weight: 900;
		text-align: center;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}
</style>
