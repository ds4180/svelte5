<script>
    /**
     * @file src/routes/(app)/v1/admin/dispatch/+page.svelte
     * @description [Phase 1] 관리 레이아웃 + 쌩 엑셀 표(2열) 통합 버전 (API 연동, 기사 목록 리소스 보드 완비)
     */
    import { untrack } from 'svelte';
    import Icon from '@iconify/svelte';
    import { fade } from 'svelte/transition';
    import {
        adminGetActiveRouteMasters,
        adminGetDailyDispatch,
        adminSaveDailyDispatch
    } from '$lib/api/admin.js';
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

    const formatDateISO = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

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
        selectedRoute?.id === 'ALL'
            ? routes
            : selectedRoute
                ? [selectedRoute]
                : []
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
                        const found = activeRoutes.find(r => r.id === targetId || r.route_name === selectedRoute?.route_name);
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
                    const found = routes.find(r => r.id === forceRouteId);
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
                            } else if (routeName.includes('291') || routeName.includes('292') || routeName.includes('293')) {
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
                    } else if (routeName.includes('291') || routeName.includes('292') || routeName.includes('293')) {
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
            console.error("❌ Failed to sync dispatch data:", err);
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
        dispatchRows
            .map(d => d.driver_name)
            .filter(name => name && name !== '')
    );

    // 투입 가능한 기사 필터링 (기선택된 기사 제외)
    let availableDrivers = $derived(
        driverData.filter(driver => !assignedDrivers.includes(driver.name))
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
            return driverData.find(d => d.vehicle_no === driver.vehicle_no && d.role === 'SUB');
        } else if (driver.role === 'SUB') {
            return driverData.find(d => d.vehicle_no === driver.vehicle_no && d.role === 'MAIN');
        }
        return null;
    }

    // 내일 자 예측 컬럼의 기사명을 전반적으로 재계산/동기화해줍니다 (당연근무 회전 및 동일차량 로테이션 반영)
    function updateTomorrowPredictions() {
        const N = dispatchRows.length;
        if (N === 0) return;

        dispatchRows = dispatchRows.map(row => {
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
                    const todayDriverObj = driverData.find(d => d.name === updatedRow.driver_name.trim());
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
            dispatchRows = dispatchRows.map(row => {
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
                            const ydDriverObj = driverData.find(d => d.name === yesterdayName);
                            if (ydDriverObj && (ydDriverObj.role === 'MAIN' || ydDriverObj.role === 'SUB')) {
                                const mainDriver = driverData.find(d => d.vehicle_no === updatedRow.vehicle_no && d.role === 'MAIN');
                                const subDriver = driverData.find(d => d.vehicle_no === updatedRow.vehicle_no && d.role === 'SUB');
                                
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
            dispatchRows = dispatchRows.map(row => {
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
            alert('선택된 노선이 없습니다.');
            return;
        }
        try {
            if (selectedRoute.id === 'ALL') {
                const groupedPayloads = routes.map(r => {
                    const rRows = dispatchRows.filter(row => row.route_id === r.id);
                    if (rRows.length === 0) return null;
                    return {
                        target_date: selectedDateKey,
                        route_master_id: r.id,
                        status: status,
                        rows: rRows.map(row => ({
                            timetable_id: row.timetable_id,
                            driver_name: row.driver_name || null,
                            tomorrow_driver_name: row.tomorrow_driver_name || null,
                            vehicle_no: row.vehicle_no || null,
                            start_time: row.start_time || null,
                            memo: row.memo || null
                        }))
                    };
                }).filter(p => p !== null);
                
                await Promise.all(groupedPayloads.map(payload => adminSaveDailyDispatch(payload)));
            } else {
                const payload = {
                    target_date: selectedDateKey,
                    route_master_id: selectedRoute.id,
                    status: status,
                    rows: dispatchRows.map(row => ({
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
            alert(status === 'CONFIRMED' ? '배차 정보가 17시 확정 공지되었습니다.' : '배차 정보가 성공적으로 임시저장되었습니다.');
            
            // 데이터 재로딩
            await syncData(selectedDateKey, selectedRoute.id);
        } catch (err) {
            alert('배차 저장 실패: ' + err.message);
        }
    }

    // 내일 확정 공지 상태 (모든 행이 CONFIRMED 인지 여부 판단)
    let isTomorrowAnnounced = $derived(
        dispatchRows.length > 0 && dispatchRows.every(row => row.status === 'CONFIRMED')
    );
</script>

<style>
    .excel-table {
        border-collapse: collapse;
        width: 100%;
        table-layout: fixed;
    }
    .excel-table th, .excel-table td {
        box-sizing: border-box;
        border: 1px solid #ddd;
        padding: 0;
        height: 25px;
        font-size: 11px;
        letter-spacing: -0.05em;
        line-height: 25px;
    }
    .excel-table th {
        background-color: #f8fafc;
        font-weight: 800;
        color: #64748b;
        text-transform: uppercase;
        font-size: 10px;
        letter-spacing: -0.05em;
    }
    .excel-input {
        box-sizing: border-box;
        width: 100%;
        height: 100%;
        border: none;
        padding: 0 !important;
        margin: 0 !important;
        font-size: 11px;
        letter-spacing: -0.05em;
        line-height: 25px;
        outline: none;
        background: transparent;
        font-weight: 600;
    }
    .excel-input:focus {
        background-color: #f0f7ff;
        box-shadow: inset 0 0 0 2px #3b82f6;
    }
    .turn-cell {
        background-color: #fffbeb;
        font-weight: 900;
        text-align: center;
        letter-spacing: -0.05em;
        line-height: 25px;
    }
</style>

<div class="min-h-screen bg-slate-50 p-2 md:p-4 font-sans pb-12">
    <!-- 헤더 영역 -->
    <header class="mb-4 border-b-2 border-slate-900 pb-3">
        <div class="flex justify-between items-end">
            <div>
                <div class="flex items-center gap-3 mb-1.5">
                    <span class="badge bg-slate-900 text-white font-black uppercase text-[10px] px-3 py-1">Admin</span>
                    {#if isLocked}
                        <span class="badge badge-error text-white font-black uppercase text-[10px] animate-pulse">Lock by {lockedBy}</span>
                    {:else}
                        <span class="badge bg-emerald-100 text-emerald-700 font-black uppercase text-[10px]">Editing Mode</span>
                    {/if}
                </div>
                <h1 class="text-2xl md:text-3xl font-black uppercase italic tracking-tighter text-slate-900 mb-0.5">Dispatch Canvas</h1>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Fleet Management System</p>
            </div>
            
            {#if selectedRoute}
                <button class="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white border-none font-black rounded-lg px-6 shadow-lg"
                        onclick={() => saveDispatch('CONFIRMED')}>
                    {isTomorrowAnnounced ? '17시 재공지 완료' : '17시 확정 공지'}
                </button>
            {/if}
        </div>
    </header>

    <!-- 날짜 네비게이션 -->
    <div class="mb-4 flex items-center justify-between bg-white p-1.5 rounded-xl border-2 border-slate-900 shadow-[3px_3px_0_rgba(0,0,0,1)]">
        <div class="flex items-center gap-1">
            <!-- 이전 날짜 -->
            <button 
                class="px-3 py-1.5 text-xs font-black rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all flex flex-col items-center"
                onclick={() => moveDate(-1)}
            >
                <span class="text-[9px] uppercase tracking-tighter opacity-70">{getRelativeLabel(prevDate)}</span>
                <div class="flex items-center gap-1">
                    <Icon icon="ph:caret-left-bold" />
                    {formatDateDisplay(prevDate)}
                </div>
            </button>

            <!-- 선택된 날짜 -->
            <div class="px-5 py-2 bg-slate-900 text-white rounded-lg shadow-md flex flex-col items-center group relative overflow-hidden">
                <div class="absolute inset-0 bg-blue-600/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                <span class="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-0.5 z-10">
                    {getRelativeLabel(selectedDate)} Target
                </span>
                <div class="flex items-center gap-2.5 z-10">
                    <Icon icon="ph:calendar-star-fill" class="text-blue-400 text-base" />
                    <span class="text-xs font-black tracking-tight">{selectedFullDate}</span>
                </div>
            </div>

            <!-- 다음 날짜 -->
            <button 
                class="px-3 py-1.5 text-xs font-black rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all flex flex-col items-center"
                onclick={() => moveDate(1)}
            >
                <span class="text-[9px] uppercase tracking-tighter opacity-70">{getRelativeLabel(nextDate)}</span>
                <div class="flex items-center gap-1">
                    {formatDateDisplay(nextDate)}
                    <Icon icon="ph:caret-right-bold" />
                </div>
            </button>

            <div class="w-[2px] h-8 bg-slate-100 mx-3"></div>

            <!-- 오늘로 복귀 -->
            <button 
                class="px-3 py-2 text-[10px] font-black rounded-lg border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-all uppercase tracking-tighter flex items-center gap-1.5"
                onclick={() => setDate(today)}
            >
                <Icon icon="ph:arrow-u-up-left-bold" />
                Jump to Today
            </button>
        </div>

        <div class="flex items-center gap-6 px-6">
            <div class="flex flex-col items-end">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Drivers Active</span>
                <div class="flex items-baseline gap-1">
                    <span class="text-lg font-black text-emerald-600">{assignedDrivers.length}</span>
                    <span class="text-[10px] font-bold text-slate-400">/ {driverData.length}</span>
                </div>
            </div>
            <div class="w-[1px] h-8 bg-slate-200"></div>
            <div class="flex flex-col items-end">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Live Routes</span>
                <span class="text-lg font-black text-slate-900">{routes.length}</span>
            </div>
        </div>
    </div>

    <!-- 🚌 노선 선택 수평 칩 그룹 (전체 노선 포함) -->
    {#if routes.length > 0}
        <div class="mb-4 flex items-center gap-1.5 overflow-x-auto pb-3 pt-0.5 scrollbar-none">
            <!-- 🌟 "전체 노선" 전용 버튼 탑재 -->
            <button
                class="px-4 py-2.5 rounded-xl font-extrabold transition-all shrink-0 text-xs flex items-center gap-1.5 border-2 shadow-sm
                {selectedRoute?.id === 'ALL' 
                ? 'bg-slate-900 text-white border-slate-900 shadow-slate-200' 
                : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}"
                onclick={() => selectRoute({ id: 'ALL', route_name: '전체 노선' })}
            >
                <Icon icon="lucide:layout-grid" class="w-4 h-4" />
                전체 노선
            </button>

            {#each routes as r}
                <button
                    class="px-4 py-2.5 rounded-xl font-extrabold transition-all shrink-0 text-xs flex items-center gap-1.5 border-2 shadow-sm
                    {selectedRoute?.id === r.id 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-slate-200' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}"
                    onclick={() => selectRoute(r)}
                >
                    <span class="w-1.5 h-1.5 rounded-full {selectedRoute?.id === r.id ? 'bg-white' : 'bg-slate-400'}"></span>
                    {r.route_name}
                </button>
            {/each}
        </div>
    {/if}

    {#if !selectedRoute}
        <div class="bg-white rounded-2xl border border-slate-200 shadow-lg p-12 flex flex-col items-center justify-center min-h-[400px]" transition:fade>
            <Icon icon="ph:calendar-x-bold" class="text-6xl text-slate-300 mb-4" />
            <h3 class="text-lg font-black text-slate-700 mb-1">활성화된 노선이 없습니다</h3>
            <p class="text-sm text-slate-400">선택하신 날짜({selectedFullDate})에 운행 중인 노선 마스터 도면이 존재하지 않습니다.</p>
            <p class="text-xs text-slate-400 mt-2">노선 마스터 관리 페이지에서 이 날짜에 해당하는 유효한 노선을 먼저 등록해주세요.</p>
        </div>
    {:else}
        <main class="w-full bg-white rounded-2xl border-2 border-slate-900 shadow-[5px_5px_0_rgba(0,0,0,1)] p-5 overflow-hidden" transition:fade>
            <div class="flex flex-col gap-2 mb-4">
                <div class="flex justify-between items-center">
                    <h2 class="text-xl font-black text-slate-900 flex items-center gap-2">
                        <div class="w-2.5 h-6 bg-blue-600 rounded-full"></div>
                        {selectedRoute.route_name} 배차표 조율 캔버스
                        <span class="ml-3 px-2.5 py-1 bg-slate-900 text-white text-xs font-black rounded-md shadow-sm tracking-tight">
                            {selectedFullDate}
                        </span>
                    </h2>
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></div>
                            <span class="text-[10px] font-bold text-slate-500">배정됨</span>
                        </div>
                        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-3 py-1 rounded-full">Widescreen Excel-Density Grid</div>
                    </div>
                </div>
            </div>

            <!-- 🚐 [Density Excel Sheet] 전면 격자 노선별 표 분할 렌더링 -->
            <div class="mt-2">
                {#each activeRoutesForRender as route}
                    {@const routeRowsCount = dispatchRows.filter(row => row.route_id === route.id).length}
                    {#if routeRowsCount > 0}
                        <div class="mb-8">
                            <!-- 🏷️ 노선 전용 구분 헤더 -->
                            <div class="flex items-center justify-between mb-2 px-1">
                                <h3 class="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                                    <span class="inline-block w-2 h-4 bg-indigo-600 rounded-sm"></span>
                                    {route.route_name} 배차표
                                </h3>
                                <span class="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded font-black uppercase tracking-wider">
                                    {routeRowsCount}개 로번
                                </span>
                            </div>

                            <div class="overflow-x-auto border-2 border-slate-900 rounded-xl shadow-[2px_2px_0_rgba(0,0,0,1)] bg-white">
                                <table class="excel-table w-full text-left border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr class="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-600 font-extrabold uppercase">
                                            <th style="width: 120px;">차량 번호</th>
                                            <th style="width: 60px;">로번</th>
                                            <th style="width: 80px;">출발 시각</th>
                                            <th style="width: 80px;">종료 시각</th>
                                            <th style="width: 150px;">시작 위치</th>
                                            <th style="width: 150px;">종료 위치</th>
                                            <th style="width: 120px; background-color: #ecfdf5; color: #047857;">기사</th>
                                            <th style="width: 120px; background-color: #f5f3ff; color: #4338ca;">다음 날 기사</th>
                                            <th style="width: 250px;">비고/메모</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-200">
                                        {#each dispatchRows as row}
                                            {#if row.route_id === route.id}
                                                <tr class="hover:bg-indigo-50/20 text-xs transition-all {row.is_regular_duty ? 'bg-indigo-50/10' : ''}">
                                                    <!-- 차량 번호 -->
                                                    <td class="bg-blue-50/10">
                                                        <input type="text" bind:value={row.vehicle_no} oninput={() => row.is_inherited = false} placeholder="차량 번호" class="excel-input {row.is_inherited ? 'text-indigo-700 italic' : 'text-blue-700'} text-center font-bold" />
                                                    </td>
                                                    
                                                    <!-- 로번 (turn index, seq) -->
                                                    <td class="turn-cell bg-amber-50/20 text-center text-amber-900 font-extrabold text-sm relative border-r">
                                                        {row.seq}
                                                        {#if row.is_regular_duty}
                                                            <div class="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-indigo-600 rounded-full" title="당연 근무"></div>
                                                        {/if}
                                                    </td>
                                                    
                                                    <!-- 출발 시각 (start_time) -->
                                                    <td class="bg-blue-50/30">
                                                        <input type="text" bind:value={row.start_time} class="excel-input text-center text-blue-700 font-bold border-r" />
                                                    </td>
                                                    
                                                    <!-- 종료 시각 (end_time) -->
                                                    <td class="bg-slate-50/40 text-center border-r">
                                                        <input type="text" value={row.end_time || ''} class="excel-input text-center text-slate-500 font-semibold pointer-events-none" readonly />
                                                    </td>
                                                    
                                                    <!-- 시작 위치 (start_location) -->
                                                    <td class="bg-slate-50/40 px-3 border-r">
                                                        <input type="text" value={row.start_location || ''} class="excel-input text-slate-500 font-semibold pointer-events-none" readonly />
                                                    </td>
                                                    
                                                    <!-- 종료 위치 (end_location) -->
                                                    <td class="bg-slate-50/40 px-3 border-r">
                                                        <input type="text" value={row.end_location || ''} class="excel-input text-center text-slate-500 font-semibold pointer-events-none" readonly />
                                                    </td>
                                                    
                                                    <!-- 기사 배정 (driver_name) -->
                                                    <td 
                                                        class="cursor-pointer transition-colors relative border-r border-slate-200 {selectedDriver ? 'bg-emerald-100 animate-pulse' : (row.driver_name && (!isHideRecommendations || !row.is_inherited) ? (row.is_inherited ? 'bg-indigo-50/80' : 'bg-emerald-50') : 'bg-emerald-50/20')}"
                                                        onclick={() => assignTodayDriver(row)}
                                                    >
                                                        <input type="text" value={(isHideRecommendations && row.is_inherited) ? '' : (row.driver_name || '')} placeholder={selectedDriver ? '배정하기' : '기사 배정'} class="excel-input text-center {row.is_inherited ? 'text-indigo-700 italic' : 'text-emerald-700'} font-black pointer-events-none" readonly />
                                                        {#if row.is_inherited && !isHideRecommendations}
                                                            <span class="absolute top-[1px] right-1 text-[7px] text-indigo-500 font-extrabold tracking-tighter leading-none scale-90 origin-top-right">승계</span>
                                                        {/if}
                                                    </td>
                                                    
                                                    <!-- 다음 날 기사 배정 (tomorrow_driver_name) -->
                                                    <td 
                                                        class="cursor-pointer transition-colors relative border-r border-slate-200 {selectedDriver ? 'bg-indigo-100 animate-pulse' : (row.tomorrow_driver_name && (!isHideRecommendations || !row.is_tomorrow_inherited) ? (row.is_tomorrow_inherited ? 'bg-indigo-50/50' : 'bg-indigo-50') : 'bg-indigo-50/20')}"
                                                        onclick={() => assignTomorrowDriver(row)}
                                                    >
                                                        <input type="text" value={(isHideRecommendations && row.is_tomorrow_inherited) ? '' : (row.tomorrow_driver_name || '')} placeholder={selectedDriver ? '배정하기' : '기사 지정'} class="excel-input text-center {row.is_tomorrow_inherited ? 'text-indigo-600/70 italic' : 'text-indigo-800'} font-black pointer-events-none" readonly />
                                                        {#if row.is_tomorrow_inherited && !isHideRecommendations}
                                                            <span class="absolute top-[1px] right-1 text-[7px] text-indigo-500 font-extrabold tracking-tighter leading-none scale-90 origin-top-right">자동</span>
                                                        {/if}
                                                    </td>

                                                    <!-- 비고/메모 -->
                                                    <td class="px-2">
                                                        <input type="text" bind:value={row.memo} class="excel-input text-slate-600 text-xs font-semibold px-1" placeholder="메모 입력" />
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

            <!-- 기사 리소스 보드 (하단에 넓게 가로 그리드 배치) -->
            <div class="mt-8 border-t-2 border-slate-200 pt-6">
                <div class="bg-white rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0_rgba(0,0,0,1)] overflow-hidden flex flex-col">
                    <div class="bg-slate-100 px-4 py-3 border-b-2 border-slate-900 flex justify-between items-center">
                        <h3 class="text-xs font-black text-slate-800 flex items-center gap-2 uppercase tracking-tight">
                            <Icon icon="ph:users-four-fill" class="text-indigo-600 text-lg" />
                            투입 대기 기사 등록 보드
                        </h3>
                        <span class="badge bg-indigo-100 text-indigo-700 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-tighter">
                            {availableDrivers.length}명 대기중
                        </span>
                    </div>
                    
                    <div class="p-4 bg-slate-50/50">
                        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-[220px] overflow-y-auto">
                            {#each availableDrivers as driver}
                                <button 
                                    class="flex items-center justify-between p-2 rounded-xl border-2 transition-all text-xs group shadow-sm
                                        {selectedDriver?.name === driver.name 
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-md' 
                                            : 'bg-white border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 text-slate-700'}"
                                    onclick={() => selectDriver(driver)}
                                >
                                    <div class="flex flex-col items-start gap-0.5 text-left">
                                        <div class="flex items-center gap-1">
                                            <span class="font-black tracking-tight">{driver.name}</span>
                                            {#if driver.role === 'MAIN'}
                                                <span class="px-1 py-0.2 text-[8px] font-black rounded bg-blue-100 text-blue-800 uppercase tracking-tighter">주</span>
                                            {:else}
                                                <span class="px-1 py-0.2 text-[8px] font-black rounded bg-amber-100 text-amber-800 uppercase tracking-tighter">보</span>
                                            {/if}
                                        </div>
                                        {#if driver.vehicle_no}
                                            <span class="text-[9px] font-bold text-slate-400 group-hover:text-slate-500 {selectedDriver?.name === driver.name ? 'text-indigo-200' : ''}">
                                                {driver.vehicle_no}
                                            </span>
                                        {/if}
                                    </div>
                                    <Icon icon="ph:check-circle-fill" class="{selectedDriver?.name === driver.name ? 'text-white' : 'text-slate-200 group-hover:text-indigo-500'} text-sm transition-colors" />
                                </button>
                            {/each}
                        </div>
                    </div>
                    
                    <div class="px-4 py-2 border-t border-slate-200 bg-white">
                        <p class="text-[10px] text-slate-500 leading-relaxed font-bold">
                            {#if selectedDriver}
                                <span class="text-indigo-600 font-black animate-pulse">[{selectedDriver.name}] ({selectedDriver.vehicle_no || '전담 차량 없음'})</span> 기사님이 조율 카드로 선택되었습니다. 위 표에서 임의의 노선의 <span class="text-indigo-600 font-black">기사 칸</span> 또는 <span class="text-indigo-600 font-black">다음 날 기사 칸</span>을 클릭하여 자원을 신속히 임명하십시오.
                            {:else}
                                * 투입 대기 기사 버튼을 클릭해 기사를 선정한 다음, 원하는 차량의 오늘/다음 날 기사 칸을 클릭해 즉석에서 배치하십시오.
                            {/if}
                        </p>
                    </div>
                </div>
            </div>

            <!-- 하단 플로팅 저장 버튼 그룹 -->
            <div class="mt-6 flex justify-end gap-3">
                <button class="btn {isAutoFilled ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'} border-2 rounded-xl px-6 font-black flex items-center gap-1.5 transition-all shadow-sm" onclick={autoFillDrivers}>
                    {#if isAutoFilled}
                        <Icon icon="ph:x-circle-fill" class="h-4.5 w-4.5" />
                        채우기 취소
                    {:else}
                        <Icon icon="ph:magic-wand-fill" class="h-4.5 w-4.5" />
                        자동 채우기
                    {/if}
                </button>
                <button class="btn bg-white hover:bg-slate-50 text-slate-800 border-slate-200 border-2 rounded-xl px-6 font-black" onclick={() => saveDispatch('DRAFT')}>
                    임시저장
                </button>
                <button class="btn bg-slate-900 hover:bg-black text-white border-none rounded-xl px-8 font-black shadow-lg" onclick={() => saveDispatch('CONFIRMED')}>
                    공지 발행 (확정)
                </button>
            </div>
        </main>
    {/if}
</div>
