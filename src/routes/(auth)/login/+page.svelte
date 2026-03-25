<script>
    /**
     * @file login/+page.svelte (오피스 전용 로그인 모델)
     * @description 고대비 블랙&화이트, 선명한 디자인의 강력한 가독성을 가진 로그인 폼
     */
    import { enhance } from "$app/forms";
    import { onMount, untrack } from "svelte"; // 👈 추가
    import { alertState } from "$lib/runes/alert.svelte.js";

    let { form } = $props();
    let loading = $state(false);
    let isMounted = $state(false); // 👈 하이드레이션 완료 여부 체크

    onMount(() => {
        isMounted = true;
    });

    // 🔄 [하이드레이션 방어] 서버에서 온 에러 피드백을 안전하게 처리
    $effect(() => {
        // ⚠️ isMounted가 true일 때만(하이드레이션 완료 후) 알림을 보냅니다.
        if (isMounted && form?.error) {
            untrack(() => {
                alertState.send(form.error, { level: 2, style: 'error' });
                loading = false;
            });
        }
    });

    function handleSubmit() {
        loading = true;
    }
</script>

<svelte:head>
    <title>AUTH | JEJU.LIVE ACCESS</title>
</svelte:head>

<!-- 전체 화면을 채우는 순백색 로그인 컨테이너 -->
<div class="min-h-screen bg-white flex flex-col justify-center items-center p-6 animate-fade-in text-black font-['Outfit']">
    
    <!-- 📄 로그인 센터 박스: 1px 선명한 경계선과 다크 셰도우 포인트 -->
    <div class="w-full max-w-[420px] border border-black p-10 md:p-14 bg-white relative">
        <!-- 상단 유령 로딩 바 (현대적인 로딩 지시자) -->
        {#if loading}
            <div class="absolute top-0 left-0 w-full h-[3px] bg-black animate-pulse"></div>
        {/if}

        <div class="mb-14 text-center space-y-2">
            <span class="text-[9px] font-black tracking-[0.4em] opacity-30 uppercase block">Terminal Authentication</span>
            <h1 class="text-4xl font-black tracking-tighter uppercase italic leading-none">Jeju.Live</h1>
            <p class="text-[10px] font-bold opacity-30 tracking-widest mt-2">SYSTEM CLOUD INFRASTRUCTURE v5.0</p>
        </div>

        <form 
            method="post" 
            use:enhance={handleSubmit} 
            class="space-y-10"
        >
            <!-- 🆔 아이디 입력 (선명한 외곽선) -->
            <div class="space-y-3">
                <label for="username" class="text-[10px] font-black uppercase tracking-widest opacity-40">Operator ID / ID</label>
                <input 
                    type="text" 
                    id="username" 
                    name="username" 
                    class="w-full h-14 border border-black px-5 font-bold focus:bg-slate-50 focus:outline-none transition-all placeholder:opacity-10 placeholder:italic"
                    placeholder="Enter Username"
                    required
                />
            </div>

            <!-- 🔑 비밀번호 입력 (고대비 인터페이스) -->
            <div class="space-y-3">
                <label for="password" class="text-[10px] font-black uppercase tracking-widest opacity-40">Encryption Key / PW</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password" 
                    class="w-full h-14 border border-black px-5 font-bold focus:bg-slate-50 focus:outline-none transition-all placeholder:opacity-10 placeholder:italic"
                    placeholder="••••••••"
                    required
                />
            </div>

            <!-- 🔒 접속 버튼 -->
            <button 
                type="submit" 
                class="btn btn-black w-full h-16 rounded-none font-black text-lg uppercase tracking-widest border border-black hover:bg-white hover:text-black hover:border-black transition-all"
                disabled={loading}
            >
                {loading ? 'Authenticating...' : 'Sign In Now'}
            </button>
        </form>

        <div class="mt-16 flex flex-col items-center gap-2">
            <a href="/" class="text-[9px] font-black border-b border-black opacity-20 hover:opacity-100 transition-opacity uppercase tracking-widest">Return to Public Portal</a>
        </div>
    </div>

    <!-- 🌐 하단 상태표시 바 -->
    <div class="mt-12 opacity-10 flex items-center gap-3 text-[9px] font-black uppercase tracking-widest grayscale select-none">
        <div class="w-2 h-2 rounded-full bg-black animate-pulse"></div>
        <div>SSL ENCRYPTED SECURE CHANNEL</div>
    </div>
</div>

<style>
    /* 📌 페이드인 애니메이션 */
    .animate-fade-in {
        animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    :global(.btn-black) {
        background-color: #000;
        color: #fff;
    }
</style>
