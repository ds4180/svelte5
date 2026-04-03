<script>
    /**
     * @file (app)/v1/app/chart/+page.svelte
     * @description Chart.js 연동 차트 데모 페이지 (Svelte 5 & DaisyUI)
     */
    import Chart from "$lib/components/Chart.svelte";
    import Icon from '@iconify/svelte';

    /** @type {'bar'|'line'|'pie'} */
    let selectedType = $state('bar');
    
    // 차트 데이터 (반응형)
    let chartData = $state({
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [{
            label: 'Total Revenue ($)',
            data: [12, 19, 3, 5, 2, 3],
            backgroundColor: [
                'rgba(59, 130, 246, 0.2)',
                'rgba(59, 130, 246, 0.4)',
                'rgba(59, 130, 246, 0.6)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(59, 130, 246, 1.0)',
                'rgba(30, 64, 175, 1.0)'
            ],
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
            borderRadius: 12
        }]
    });

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    font: {
                        family: 'Outfit',
                        weight: 'bold'
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    display: false
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    /**
     * @function randomizeData
     * @description 임의의 데이터로 차트 업데이트 테스트
     */
    function randomizeData() {
        chartData.datasets[0].data = Array.from({length: 6}, () => Math.floor(Math.random() * 20));
    }
</script>

<div class="space-y-12 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-40 px-4 md:px-8 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase block mb-2">Visualization Engine v4.0</span>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-slate-900">데이터 <span class="text-indigo-600 NOT-ITALIC">시각화 <Icon icon="mdi:chart-bar" class="inline-block align-text-bottom text-indigo-600 ml-1" /></span></h1>
            <p class="text-sm font-bold text-slate-500 mt-4">복잡한 데이터를 직관적인 차트로 변환하여 비즈니스 통찰력을 제공합니다.</p>
        </div>
        <div class="flex items-center gap-2">
            <select class="select border-2 border-slate-900 rounded-2xl font-black italic uppercase text-xs" bind:value={selectedType}>
                <option value="bar">Bar Chart</option>
                <option value="line">Line Chart</option>
                <option value="pie">Pie Chart</option>
            </select>
            <button class="btn btn-neutral rounded-2xl px-6 font-black uppercase text-xs" onclick={randomizeData}>
                 Randomize
            </button>
        </div>
    </div>

    <!-- Chart Container -->
    <div class="bg-white border-2 border-slate-900 rounded-[3rem] p-10 md:p-14 shadow-2xl relative">
        <div class="mb-14 flex justify-between items-center">
            <div>
                 <h3 class="text-2xl font-black italic text-slate-900 uppercase tracking-tighter mb-1">Fiscal Performance Snapshot</h3>
                 <p class="text-[10px] font-bold text-slate-400 uppercase">Analysis of recurring revenue flows</p>
            </div>
            <div class="text-right">
                 <span class="text-xs font-black uppercase text-indigo-600 italic">Live Rendering Engine</span>
            </div>
        </div>

        <div class="h-[400px]">
             <Chart type={selectedType} data={chartData} options={chartOptions} />
        </div>

        <div class="mt-14 pt-10 border-t border-slate-100 grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div class="flex flex-col">
                 <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Reliability</span>
                 <span class="text-lg font-black text-slate-900 leading-none">99.9%</span>
            </div>
            <div class="flex flex-col">
                 <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Latency</span>
                 <span class="text-lg font-black text-slate-900 leading-none">12ms</span>
            </div>
            <div class="flex flex-col">
                 <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Engine</span>
                 <span class="text-lg font-black text-slate-900 leading-none italic uppercase">ChartJS</span>
            </div>
            <div class="flex flex-col">
                 <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Renders</span>
                 <span class="text-lg font-black text-slate-900 leading-none">60FPS</span>
            </div>
        </div>
    </div>
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>
