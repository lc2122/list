// ==UserScript==
// @name         모바일용 스포티비 확인
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  모바일 SpotvCoupang 라이브 상태 확인 기능
// @author       ㅇㅌㄹㅋ
// @match        https://lolcast-e0478.web.app/*
// @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/mobile.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const CACHE_EXPIRY = 180000;
    const FETCH_TIMEOUT = 8000;
    const MAX_SPOTV_CHANNELS = 40;
    const REFRESH_BUTTON_ID = 'live-refresh-modal-btn'; // ID 변경 (더 포괄적)
    const SPOTV_ID_PREFIX = 'spotv';
    const COUPANG_ID_PREFIX = 'coupang';

    // --- ★★★ START Coupang Play M3U8 URLs (이전 스크립트에서 가져옴) ★★★ ---
    const coupangPlayUrls = [
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/576b33b6685c4c8aa054f69aef24ed62/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/ca6eb1f963d64a04b99b27f07091897e/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/5734898c225c4fc7a12d40fcea24879d/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/fcf9c6a5f7554769a8efc327a545aeb1/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/8ab14ad8f0ce4c1782a9cb9b15c388b4/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/0df6c0312da849a494eac7e46e587100/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/c78b1450ad33472c920ea3c756993fb6/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/ea6151c04a944320a86d4ae51c21256d/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/d22c82d6841b41519ff05bd3196e9637/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/70fd66b6a08c486b9e9cdf607a471bc1/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/8b36955b262e4249bce0cf139ea8509c/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/2b7e797b36904c8a9fbeef1fa7d0f2ce/index.m3u8",
      "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/0a317776efd940f285a95f6ec3fac015/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/5aaf57c64fb04e1e9629f73e66fb8fb0/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/5fbab823487d4cf6a3c4da096fa8a8f7/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/8986e1546f784526befa63514dff03ed/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/8b3ea164a8c84f5d93d324bdbc808420/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/8b3ea164a8c84f5d93d324bdbc808420/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/674dd7f9081b44dc85915835272282b8/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/ef52a96b02034ba79b3c79bd887a85c5/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/fd6c882c00e445578040f963d29b10f3/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/90d01e430d4f4d5895f7811e8ef381f5/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/e59dd75fd2ea4f7cba4f4a9fc5635e14/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/1e1e6b43d62d48dfb6080722826f2d35/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/cfec7a84f01d48159af8d5cd56c85855/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/7c4a5083c48540de91b5b9d06d09e5fb/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/9f7d1257cc5744b9aac6ec912de8226e/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/c07fdb81484a4117be588095638ce1f7/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/ae138e08137c49cf830c2d2f84528a1a/index.m3u8",
      "https://live04.coupangstreaming.com/out/v1/97c767e38a554c22949f5f556516c8d7/index.m3u8"
      ];
    // --- ★★★ END Coupang Play M3U8 URLs ★★★ ---

    // 캐시 이름을 'liveStatusCache'로 통일 (이전 스크립트와 호환성 위해 spotvLiveStatusCache 사용 가능)
    const liveStatusCache = JSON.parse(localStorage.getItem('liveStatusCache') || '{}');
    let lastFetchTimestamp = 0;
    let isFetching = false;

    GM_addStyle(`
        #sports-channels-modal .spotv-btn.is-live,
        #sports-channels-modal .coupang-btn.is-live { /* Coupang 버튼도 동일 스타일 적용 */
            border-color: #ffd700 !important;
            color: #ffd700 !important;
            font-weight: bold;
        }
        #${REFRESH_BUTTON_ID}.is-loading i {
             animation: spinAround 1s infinite linear;
         }
         @keyframes spinAround {
             from { transform: rotate(0deg); }
             to { transform: rotate(360deg); }
         }
         #${REFRESH_BUTTON_ID} i {
            color: #485fc7;
         }
         #${REFRESH_BUTTON_ID}:hover i {
             color: #3e56c4;
         }
         #${REFRESH_BUTTON_ID}.is-loading i {
             color: #ff3860;
         }
    `);

    function isCacheValid(cacheEntry) {
        return cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_EXPIRY);
    }

    function getSpotvChannelNumberFromUrl(m3u8Url) {
        if (!m3u8Url || typeof m3u8Url !== 'string') return null;
        const match = m3u8Url.match(/ch(\d+)-nlivecdn/);
        return match ? parseInt(match[1], 10) : null;
    }

    // Coupang Play URL의 인덱스를 반환 (캐시 키 및 식별용)
    function getCoupangChannelIndexFromUrl(m3u8Url) {
        if (!m3u8Url || typeof m3u8Url !== 'string') return -1;
        return coupangPlayUrls.indexOf(m3u8Url);
    }


    function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController(); const signal = controller.signal;
            const timer = setTimeout(() => { controller.abort(); reject(new Error(`요청 시간 초과 (${timeout}ms)`)); }, timeout);
            GM_xmlhttpRequest({
                method: "HEAD", // HEAD 요청으로 충분 (데이터를 받을 필요 없음)
                url: url, signal: signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                onload: (response) => { clearTimeout(timer); if (response.status >= 200 && response.status < 400) resolve(true); // 3xx도 성공으로 간주할 수 있음
                    else reject(new Error(`${url} 요청 실패 (상태 코드: ${response.status})`)); },
                onerror: (error) => { clearTimeout(timer); reject(new Error(`${url} 요청 실패: ${error.error || '알 수 없음'}`)); },
                onabort: () => { clearTimeout(timer); reject(new Error('요청 중단됨')); }, // AbortController에 의한 중단
                ontimeout: () => { clearTimeout(timer); reject(new Error(`${url} GM_xmlhttpRequest 시간 초과`)); } // GM_xmlhttpRequest 자체 타임아웃
            });
        });
    }

    async function fetchSpotvnowLiveStatus(num) {
        const channelId = `${SPOTV_ID_PREFIX}${num}`;
        const cached = liveStatusCache[channelId];
        if (isCacheValid(cached)) {
            return { channel: num, live: cached.live, provider: 'spotv' };
        }
        const pNum = num.toString().padStart(2, '0');
        const url = `https://ch${pNum}-nlivecdn.spotvnow.co.kr/ch${pNum}/decr/medialist_14173921312004482655_hls.m3u8`;
        try {
            await fetchWithTimeout(url, FETCH_TIMEOUT);
            liveStatusCache[channelId] = { live: true, timestamp: Date.now() };
            // localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache)); // 매번 저장하지 않고 마지막에 한 번만
            return { channel: num, live: true, provider: 'spotv' };
        } catch (err) {
            // console.warn(`Spotv 채널 ${num} 확인 실패: ${err.message}`);
            liveStatusCache[channelId] = { live: false, timestamp: Date.now() };
            return { channel: num, live: false, provider: 'spotv' };
        }
    }

    async function fetchCoupangPlayLiveStatus(m3u8Url, index) {
        const channelId = `${COUPANG_ID_PREFIX}${index}`; // 고유 ID 생성 (인덱스 기반)
        const cached = liveStatusCache[channelId];
        if (isCacheValid(cached)) {
            return { channel: index, live: cached.live, provider: 'coupang' };
        }
        try {
            await fetchWithTimeout(m3u8Url, FETCH_TIMEOUT);
            liveStatusCache[channelId] = { live: true, timestamp: Date.now() };
            return { channel: index, live: true, provider: 'coupang' };
        } catch (err) {
            // console.warn(`Coupang 채널 ${index} (${m3u8Url.slice(-20)}) 확인 실패: ${err.message}`);
            liveStatusCache[channelId] = { live: false, timestamp: Date.now() };
            return { channel: index, live: false, provider: 'coupang' };
        }
    }


    function updateLiveStatusIndicators() {
        const sportsModalSection = document.getElementById('sports-channels-modal');
        if (!sportsModalSection) return;

        // Spotv Buttons
        const spotvButtons = sportsModalSection.querySelectorAll('button.spotv-btn');
        spotvButtons.forEach(button => {
            const url = button.dataset.url;
            const channelNum = getSpotvChannelNumberFromUrl(url);
            if (channelNum !== null) {
                const channelId = `${SPOTV_ID_PREFIX}${channelNum}`;
                const status = liveStatusCache[channelId];
                if (status && status.live) {
                    button.classList.add('is-live');
                    button.title = `Spotvnow 채널 ${channelNum} (LIVE)`;
                } else {
                    button.classList.remove('is-live');
                    button.title = `Spotvnow 채널 ${channelNum}`;
                }
            }
        });

        // Coupang Play Buttons
        const coupangButtons = sportsModalSection.querySelectorAll('button.coupang-btn');
        coupangButtons.forEach(button => {
            const url = button.dataset.url;
            const channelIndex = getCoupangChannelIndexFromUrl(url); // URL로 인덱스 찾기
            if (channelIndex !== -1) {
                const channelId = `${COUPANG_ID_PREFIX}${channelIndex}`;
                const status = liveStatusCache[channelId];
                if (status && status.live) {
                    button.classList.add('is-live');
                    button.title = `쿠팡플레이 채널 ${channelIndex + 1} (LIVE)`;
                } else {
                    button.classList.remove('is-live');
                    button.title = `쿠팡플레이 채널 ${channelIndex + 1}`;
                }
            }
        });
        console.log("라이브 상태 표시 업데이트 완료.");
    }

    async function fetchAllLiveStatuses(force = false) { // Renamed
        if (isFetching) {
            console.log("이미 상태를 가져오는 중입니다.");
            return;
        }
        const now = Date.now();
        // 캐시 만료 시간의 절반이 지나지 않았으면 강제 새로고침이 아닌 경우 건너뛰기
        if (!force && (now - lastFetchTimestamp < CACHE_EXPIRY / 2) && Object.keys(liveStatusCache).length > 0) {
            console.log("마지막 호출 이후 시간이 얼마 지나지 않아 가져오기를 건너<0xEB><0x9B><0x8D>니다. 기존 상태로 업데이트.");
            updateLiveStatusIndicators(); // 캐시된 상태로 UI 업데이트
            return;
        }

        isFetching = true;
        console.log("모든 라이브 상태 가져오는 중 (Spotv & Coupang)...");
        const refreshButton = document.getElementById(REFRESH_BUTTON_ID);
        if (refreshButton) refreshButton.classList.add('is-loading');

        // Spotvnow fetches
        const spotvChannelNumbers = Array.from({ length: MAX_SPOTV_CHANNELS }, (_, i) => i + 1);
        const spotvFetchPromises = spotvChannelNumbers.map(num =>
            fetchSpotvnowLiveStatus(num).catch(err => {
                // console.error(`Spotv 채널 ${num} 상태 확인 중 예외:`, err.message);
                return { channel: num, live: false, provider: 'spotv' }; // 실패 시 오프라인으로 간주
            })
        );

        // Coupang Play fetches
        const coupangFetchPromises = coupangPlayUrls.map((url, index) =>
            fetchCoupangPlayLiveStatus(url, index).catch(err => {
                // console.error(`Coupang 채널 ${index} 상태 확인 중 예외:`, err.message);
                return { channel: index, live: false, provider: 'coupang' }; // 실패 시 오프라인으로 간주
            })
        );

        const allFetchPromises = [...spotvFetchPromises, ...coupangFetchPromises];

        try {
            await Promise.allSettled(allFetchPromises); // 모든 작업이 완료될 때까지 기다림 (성공/실패 무관)
        } catch (e) {
            // 일반적으로 Promise.allSettled는 자체적으로 reject되지 않음.
            console.error("상태 확인 Promise.allSettled 중 예상치 못한 오류 발생:", e);
        } finally {
            isFetching = false;
            lastFetchTimestamp = Date.now();
            if (refreshButton) refreshButton.classList.remove('is-loading');
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache)); // 모든 상태 업데이트 후 한 번만 저장
            console.log("모든 라이브 상태 확인 완료.");
            updateLiveStatusIndicators(); // 최종적으로 UI 업데이트
        }
    }

    function addOrUpdateButton() {
        const buttonContainer = document.getElementById('custom-url-buttons-modal');
        if (!buttonContainer) {
            // console.warn("'custom-url-buttons-modal' 컨테이너를 찾을 수 없습니다.");
            return;
        }

        let refreshBtn = document.getElementById(REFRESH_BUTTON_ID);

        if (!refreshBtn) {
            console.log("라이브 상태 새로고침 버튼 생성 시도...");

            const controlP = document.createElement('p');
            controlP.className = 'control';

            refreshBtn = document.createElement('button');
            refreshBtn.id = REFRESH_BUTTON_ID;
            // 클래스 이름은 기존 스타일과 일치시키거나 필요에 따라 수정
            refreshBtn.className = 'button is-light is-small live-refresh-modal-btn';
            refreshBtn.title = '라이브 상태 새로고침 (Spotv & Coupang)';

            // Font Awesome 아이콘 사용 (페이지에 Font Awesome이 로드되어 있어야 함)
            refreshBtn.innerHTML = '<span class="icon"><i class="fas fa-sync-alt"></i></span>';

            refreshBtn.addEventListener('click', (event) => {
                event.preventDefault();
                // 캐시 전체를 비우는 대신, 각 항목의 timestamp를 0으로 만들어 강제 갱신 유도 가능
                // Object.keys(liveStatusCache).forEach(key => { if(liveStatusCache[key]) liveStatusCache[key].timestamp = 0; });
                // 여기서는 기존 방식대로 캐시를 완전히 비움
                Object.keys(liveStatusCache).forEach(key => { delete liveStatusCache[key]; });
                localStorage.removeItem('liveStatusCache'); // LocalStorageからも削除
                console.log("수동 새로고침: 모든 라이브 캐시 지움.");
                fetchAllLiveStatuses(true); // 강제 새로고침
            });

            controlP.appendChild(refreshBtn);
            // buttonContainer의 첫 번째 자식으로 추가하여 다른 버튼들 앞에 오도록
            if (buttonContainer.firstChild) {
                buttonContainer.insertBefore(controlP, buttonContainer.firstChild);
            } else {
                buttonContainer.appendChild(controlP);
            }


            console.log("라이브 상태 새로고침 버튼이 'custom-url-buttons-modal'에 추가되었습니다.");

        } else {
             // 버튼이 이미 존재하면 로딩 상태만 업데이트
             if (!isFetching) {
                 refreshBtn.classList.remove('is-loading');
             }
        }
    }

    // 페이지 로드 시 또는 특정 이벤트 발생 시 버튼 추가/업데이트 시도
    // addOrUpdateButton(); // 초기 로드 시점에 버튼 컨테이너가 없을 수 있음

    const modal = document.getElementById('controls-modal'); // 이 모달이 열릴 때 버튼을 추가/업데이트
    if (modal) {
        const observer = new MutationObserver(mutationsList => {
            let modalOpened = false;
            let sportsSectionOpened = false; // 스포츠 채널 섹션이 실제로 보이는지 확인

            for (let mutation of mutationsList) {
                // 컨트롤 모달 자체가 활성화될 때
                if (mutation.target === modal && mutation.attributeName === 'class' && modal.classList.contains('is-active')) {
                     modalOpened = true;
                }
                // 스포츠 채널 섹션의 display 속성이 변경되어 'block'이 될 때
                else if (mutation.target.id === 'sports-channels-modal' && mutation.attributeName === 'style') {
                    const sportsSection = mutation.target; // mutation.target은 #sports-channels-modal
                    if (sportsSection.style.display === 'block' || sportsSection.style.display === '') { // display가 ''인 경우도 block으로 간주
                        sportsSectionOpened = true;
                    }
                }
            }

            if (modalOpened) {
                 // console.log("컨트롤 모달 열림 감지.");
                 addOrUpdateButton(); // 새로고침 버튼을 추가하거나 상태 업데이트
            }
            if (sportsSectionOpened) {
                 console.log("스포츠 채널 섹션 열림 감지.");
                 fetchAllLiveStatuses(); // 스포츠 섹션이 열리면 라이브 상태 확인 (캐시 로직에 따라 실제 fetch 여부 결정)
            }
        });

        // 모달 자체의 class 변경과, 모달 내부 요소들의 style 변경(subtree)을 감지
        observer.observe(modal, {
            attributes: true, // modal의 class 변경 감지
            childList: true,  // modal 내부에 #sports-channels-modal이 동적으로 추가될 수 있으므로
            subtree: true,    // #sports-channels-modal의 style 변경 감지
            attributeFilter: ['class', 'style'] // 감시할 속성 지정
         });
        console.log("MutationObserver 시작됨 (컨트롤 모달 및 스포츠 채널 섹션 감지).");
    } else {
        console.error("관찰할 컨트롤 모달(#controls-modal)을 찾을 수 없습니다.");
    }

    // 매우 오래된 캐시 항목 정리 (예: 10배수 이상 지난 항목)
    const now = Date.now();
    let changed = false;
    Object.keys(liveStatusCache).forEach(key => {
        if (!liveStatusCache[key] || now - (liveStatusCache[key].timestamp || 0) >= CACHE_EXPIRY * 10) {
            delete liveStatusCache[key];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
        console.log("매우 오래된 캐시 항목 정리 완료.");
    }

    console.log("모바일용 라이브 상태 확인 스크립트 (Spotv & Coupang) 초기화 완료.");

})();
