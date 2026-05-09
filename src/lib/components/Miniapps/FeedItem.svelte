<script>
    /**
     * @file FeedItem.svelte
     * @description 메모, 지시사항, 메시징 통합 액션 아이템 컴포넌트
     */
    import Icon from '@iconify/svelte';
    import { fly, fade } from 'svelte/transition';

    let { 
        item = {
            id: null,
            type: 'MEMO', // MEMO, INSTRUCTION, MESSAGE
            content: '',
            status: 'PENDING', // PENDING, ONGOING, COMPLETED
            sender: null,
            created_at: new Date().toISOString(),
            is_done: false
        },
        onAction = () => {}
    } = $props();

    // 타입별 스타일 설정
    const typeConfig = {
        MEMO: {
            icon: 'ph:notepad-fill',
            color: 'text-amber-500',
            bgColor: 'bg-amber-50/30',
            borderColor: 'border-amber-100'
        },
        INSTRUCTION: {
            icon: 'ph:info-fill',
            color: 'text-indigo-600',
            bgColor: 'bg-indigo-50/30',
            borderColor: 'border-indigo-100'
        },
        MESSAGE: {
            icon: 'ph:paper-plane-tilt-fill',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50/30',
            borderColor: 'border-blue-100'
        },
        NOTIFICATION: {
            icon: 'ph:bell-ringing-fill',
            color: 'text-rose-500',
            bgColor: 'bg-rose-50/30',
            borderColor: 'border-rose-100'
        }
    };

    const config = $derived(typeConfig[item.type] || typeConfig.MEMO);

    function handleStatusToggle() {
        const nextStatus = {
            'PENDING': 'ONGOING',
            'ONGOING': 'COMPLETED',
            'COMPLETED': 'PENDING'
        };
        onAction('status', nextStatus[item.status]);
    }
</script>

<div 
    in:fly={{ y: 20, duration: 400 }}
    out:fade={{ duration: 200 }}
    class="group p-5 rounded-3xl border-2 transition-all duration-300 {config.bgColor} {config.borderColor} hover:shadow-xl hover:shadow-slate-100"
>
    <div class="flex justify-between items-start mb-3">
        <div class="flex items-center gap-2">
            <div class="p-2 rounded-xl bg-white shadow-sm">
                <Icon icon={config.icon} class="h-4 w-4 {config.color}" />
            </div>
            <span class="text-[10px] font-black uppercase tracking-widest opacity-40">{item.type}</span>
        </div>
        
        {#if item.type === 'INSTRUCTION'}
            <button 
                class="badge badge-sm border-none font-black text-[9px] uppercase cursor-pointer hover:scale-105 transition-transform
                       {item.status === 'COMPLETED' ? 'bg-emerald-500 text-white' : item.status === 'ONGOING' ? 'bg-amber-400 text-white' : 'bg-slate-200 text-slate-500'}"
                onclick={handleStatusToggle}
            >
                {item.status === 'ONGOING' ? '처리중' : item.status === 'COMPLETED' ? '완료' : '대기중'}
            </button>
        {/if}
    </div>

    <div class="space-y-1">
        {#if item.type === 'MESSAGE' && item.sender}
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">From: {item.sender}</p>
        {/if}
        
        <p class="text-sm font-bold leading-relaxed text-slate-800 {item.is_done ? 'line-through opacity-40' : ''}">
            {item.content}
        </p>
    </div>

    <div class="mt-5 flex items-center justify-between">
        <span class="text-[9px] font-bold text-slate-400 uppercase">
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>

        <div class="flex gap-2">
            {#if item.type === 'MEMO'}
                <button 
                    class="btn btn-xs btn-ghost btn-circle {item.is_done ? 'text-emerald-500' : 'opacity-20'}"
                    onclick={() => onAction('toggle_done', !item.is_done)}
                >
                    <Icon icon="ph:check-circle-fill" class="text-lg" />
                </button>
            {/if}

            {#if item.type === 'MESSAGE'}
                <button 
                    class="btn btn-xs bg-white border-slate-200 rounded-xl font-black text-[10px] hover:bg-blue-600 hover:text-white hover:border-blue-600"
                    onclick={() => onAction('reply')}
                >
                    REPLY
                </button>
            {/if}

            <button 
                class="btn btn-xs btn-ghost btn-circle opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-red-500"
                onclick={() => onAction('delete')}
            >
                <Icon icon="ph:trash-bold" />
            </button>
        </div>
    </div>
</div>
