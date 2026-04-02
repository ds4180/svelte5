<script>
	import { onMount } from 'svelte';
	import { fastApi } from "$lib/api"; // Assuming fastApi is available from central api.js
	import Icon from '@iconify/svelte'; // Icon 컴포넌트 추가

	let topTitle = $state('My Application');
	let darkMode = $state(false);
	let landingPage = $state('/');
	console.log('Config page script is running!');
	// State to hold original values from backend for comparison or reset
	let originalSettings = $state({});
// Function to load settings from backend
async function loadSettings() {
  try {
    // Assuming GET /v1/admin/config returns a dict like {key: value}
    const configList = await fastApi('GET', '/v1/admin/config'); // This returns a list of {key, value} objects
    if (configList) {
      // Map backend keys to frontend state
      const configMap = {};
      configList.forEach(item => {
          configMap[item.key] = item.value;
      });

      // Helper to safely get string value from JSONB, handling objects
      const getStringValue = (val, defaultValue) => {
          if (typeof val === 'object' && val !== null) {
              // Try common keys or just stringify the object
              return String(val.text || val.value || val.name || JSON.stringify(val));
          }
          return String(val || defaultValue);
      };

      topTitle = getStringValue(configMap.site_title, 'My Application');
      darkMode = configMap.theme_mode === 'dark'; // Boolean conversion is fine
      landingPage = getStringValue(configMap.landing_page, '/');

      // Store original for comparison
      originalSettings = {
          site_title: topTitle,
          theme_mode: darkMode ? "dark" : "light",
          landing_page: landingPage,
      };
    }
  } catch (e) {
    console.error("Failed to load settings:", e);
    // Optionally, show an alert
    alert("설정을 불러오는데 실패했습니다.");
  }
}

	// Function to save settings to backend
	async function saveSettings() {
		try {
			// Collect changes and send only changed values
			// Backend expects PUT /v1/admin/config/{key} with {value: ...}

			if (topTitle !== originalSettings.site_title) {
				await fastApi('PUT', '/v1/admin/config/site_title', { value: topTitle });
				originalSettings.site_title = topTitle;
			}
			if ((darkMode ? 'dark' : 'light') !== originalSettings.theme_mode) {
				await fastApi('PUT', '/v1/admin/config/theme_mode', { value: darkMode ? 'dark' : 'light' });
				originalSettings.theme_mode = darkMode ? 'dark' : 'light';
			}
			if (landingPage !== originalSettings.landing_page) {
				await fastApi('PUT', '/v1/admin/config/landing_page', { value: landingPage });
				originalSettings.landing_page = landingPage;
			}

			alert('설정이 저장되었습니다.');
		} catch (e) {
			console.error('Failed to save settings:', e);
			// Optionally, show an alert
			alert('설정 저장에 실패했습니다.');
		}
	}

	// Function to send push notification to all users
	async function sendPushNotificationToAll() {
		try {
			await fastApi('POST', '/push/send-to-all');
			alert('모든 사용자에게 푸시 알림을 전송했습니다.');
		} catch (e) {
			console.error('Failed to send push notification:', e);
			alert('푸시 알림 전송에 실패했습니다.');
		}
	}

	// Load settings when the component mounts
	onMount(() => {
		loadSettings();
	});
</script>

<div class="space-y-6 md:space-y-10 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-20 md:pb-40 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
    
    <!-- 페이지 헤더 -->
    <div class="border-b-2 md:border-b-4 border-slate-900 pb-6 md:pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div>
            <span class="text-[8px] md:text-[10px] font-black tracking-[0.2em] md:tracking-[0.4em] text-slate-400 uppercase block mb-1 md:mb-2">System Administration</span>
            <h1 class="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-black">기본 <span class="text-blue-600 NOT-ITALIC">설정 <Icon icon="mdi:cog" class="inline-block align-text-bottom text-blue-600 ml-1" /></span></h1>
            <p class="text-xs md:text-sm font-bold text-slate-500 mt-2 md:mt-3">시스템 전반에 걸친 기본 설정을 관리합니다.</p>
        </div>
        <div class="flex gap-2 md:gap-4">
            <a href="/v1/admin" class="btn btn-sm md:btn-lg bg-slate-200 text-slate-700 rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-slate-300 border-none transition-all shadow-md md:shadow-xl">
                <Icon icon="mdi:home-outline" class="w-4 h-4 md:w-6 md:h-6" />
                관리자 홈
            </a>
            <button onclick={sendPushNotificationToAll} class="btn btn-sm md:btn-lg bg-purple-600 text-white rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-purple-700 border-none transition-all shadow-md md:shadow-xl">
                <Icon icon="mdi:bell-outline" class="w-4 h-4 md:w-6 md:h-6" />
                푸시 알림 전송
            </button>
            <button onclick={saveSettings} class="btn btn-sm md:btn-lg bg-blue-600 text-white rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-blue-700 border-none transition-all shadow-md md:shadow-xl">
                <Icon icon="mdi:content-save-outline" class="w-4 h-4 md:w-6 md:h-6" />
                설정 저장
            </button>
        </div>
    </div>

    <!-- 설정 폼 카드 -->
    <div class="card bg-base-100 shadow-md border border-base-300 mb-8">
        <div class="card-body bg-base-200 rounded-b-xl p-5 md:p-8 space-y-4">
            <div class="form-control w-full">
                <label class="label" for="topTitleInput"><span class="label-text font-bold text-black">상단 타이틀</span></label>
                <input type="text" id="topTitleInput" class="input input-bordered w-full bg-white text-black" bind:value={topTitle} placeholder="웹사이트 상단에 표시될 타이틀" />
            </div>

            <div class="form-control w-full">
                <label class="label cursor-pointer justify-start gap-3">
                    <span class="label-text font-bold text-base-content">다크 모드 활성화</span>
                    <input type="checkbox" class="toggle toggle-primary" bind:checked={darkMode} />
                </label>
            </div>

            <div class="form-control w-full">
                <label class="label" for="landingPageInput"><span class="label-text font-bold text-base-content">기본 랜딩 페이지</span></label>
                <input type="text" id="landingPageInput" class="input input-bordered w-full" bind:value={landingPage} placeholder="로그인 후 이동할 기본 페이지 경로" />
            </div>
        </div>
    </div>
</div>


