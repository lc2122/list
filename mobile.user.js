// ==UserScript==
// @name         모바일용 스포티비 확인
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  모바일 Spotvnow 라이브 상태 확인 기능
// @author       ㅇㅌㄹㅋ
// @match        https://lolcast-e0478.web.app/m
// @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/mobile.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    const CACHE_EXPIRY = 180000; 
    const FETCH_TIMEOUT = 8000; 
    const MAX_CHANNELS = 40;
    const REFRESH_BUTTON_ID = 'spotv-refresh-modal-btn'; 

    const liveStatusCache = JSON.parse(localStorage.getItem('spotvLiveStatusCache') || '{}');
    let lastFetchTimestamp = 0; 
    let isFetching = false;

    GM_addStyle(`
        #sports-channels-modal .spotv-btn.is-live {
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

    function getChannelNumberFromUrl(m3u8Url) {
        if (!m3u8Url || typeof m3u8Url !== 'string') return null;
        const match = m3u8Url.match(/ch(\d+)-nlivecdn/);
        return match ? parseInt(match[1], 10) : null;
    }

    function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController(); const signal = controller.signal;
            const timer = setTimeout(() => { controller.abort(); reject(new Error(`요청 시간 초과 (${timeout}ms)`)); }, timeout);
            GM_xmlhttpRequest({
                method: "HEAD",
                url: url, signal: signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                onload: (response) => { clearTimeout(timer); if (response.status >= 200 && response.status < 400) resolve(true);
                    else reject(new Error(`${url} 요청 실패 (상태 코드: ${response.status})`)); },
                onerror: (error) => { clearTimeout(timer); reject(new Error(`${url} 요청 실패: ${error.error || '알 수 없음'}`)); },
                onabort: () => { clearTimeout(timer); reject(new Error('요청 중단됨')); },
                ontimeout: () => { clearTimeout(timer); reject(new Error(`${url} GM_xmlhttpRequest 시간 초과`)); }
            });
        });
    }

    async function fetchSpotvnowLiveStatus(num) {
        const channelId = `spotv${num}`;
        const cached = liveStatusCache[channelId];
        if (isCacheValid(cached)) {
            return { channel: num, live: cached.live };
        }
        const pNum = num.toString().padStart(2, '0');
        const url = `https://ch${pNum}-nlivecdn.spotvnow.co.kr/ch${pNum}/decr/medialist_14173921312004482655_hls.m3u8`;
        try {
            await fetchWithTimeout(url, FETCH_TIMEOUT);
            liveStatusCache[channelId] = { live: true, timestamp: Date.now() };
            localStorage.setItem('spotvLiveStatusCache', JSON.stringify(liveStatusCache));
            return { channel: num, live: true };
        } catch (err) {
            liveStatusCache[channelId] = { live: false, timestamp: Date.now() };
            localStorage.setItem('spotvLiveStatusCache', JSON.stringify(liveStatusCache));
            return { channel: num, live: false };
        }
    }

    function updateLiveStatusIndicators() {
        const sportsModalSection = document.getElementById('sports-channels-modal');
        if (!sportsModalSection) return;
        const spotvButtons = sportsModalSection.querySelectorAll('button.spotv-btn');
        spotvButtons.forEach(button => {
            const url = button.dataset.url;
            const channelNum = getChannelNumberFromUrl(url);
            if (channelNum !== null) {
                const channelId = `spotv${channelNum}`;
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
         console.log("라이브 상태 표시 업데이트 완료.");
    }

    async function fetchAllSpotvStatuses(force = false) {
        if (isFetching) {
            console.log("이미 상태를 가져오는 중입니다.");
            return;
        }
        const now = Date.now();
        if (!force && now - lastFetchTimestamp < CACHE_EXPIRY / 2) {
            console.log("마지막 호출 이후 시간이 얼마 지나지 않아 가져오기를 건너<0xEB><0x9B><0x8D>니다.");
            updateLiveStatusIndicators();
            return;
        }

        isFetching = true;
        console.log("모든 Spotvnow 라이브 상태 가져오는 중...");
        const refreshButton = document.getElementById(REFRESH_BUTTON_ID);
        if (refreshButton) refreshButton.classList.add('is-loading'); 
        const channelNumbers = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1);
        const fetchPromises = channelNumbers.map(num =>
            fetchSpotvnowLiveStatus(num).catch(err => {
                console.error(`채널 ${num} 상태 확인 오류:`, err);
                return { channel: num, live: false };
            })
        );

        try {
            await Promise.allSettled(fetchPromises);
        } catch (e) {
            console.error("상태 확인 Promise.allSettled 중 오류 발생:", e);
        } finally {
            isFetching = false;
            lastFetchTimestamp = Date.now();
            if (refreshButton) refreshButton.classList.remove('is-loading'); 
            console.log("상태 확인 완료.");
            updateLiveStatusIndicators(); 
        }
    }

    function addOrUpdateButton() {
        const buttonContainer = document.getElementById('custom-url-buttons-modal');
        if (!buttonContainer) {
            return; 
        }

        let refreshBtn = document.getElementById(REFRESH_BUTTON_ID);

        if (!refreshBtn) {
            console.log("Spotvnow 새로고침 버튼 생성 시도...");
            
            const controlP = document.createElement('p');
            controlP.className = 'control';

            refreshBtn = document.createElement('button');
            refreshBtn.id = REFRESH_BUTTON_ID;
            refreshBtn.className = 'button is-light is-small spotv-refresh-modal-btn'; 
            refreshBtn.title = 'Spotvnow 라이브 상태 새로고침';

            refreshBtn.innerHTML = '<span class="icon"><i class="fas fa-sync-alt"></i></span>';

            refreshBtn.addEventListener('click', (event) => {
                event.preventDefault(); 
                Object.keys(liveStatusCache).forEach(key => { delete liveStatusCache[key]; });
                 localStorage.removeItem('spotvLiveStatusCache');
                 console.log("수동 새로고침: 캐시 지움.");
                fetchAllSpotvStatuses(true); 
            });

            controlP.appendChild(refreshBtn);
            buttonContainer.appendChild(controlP);

            console.log("Spotvnow 새로고침 버튼이 'custom-url-buttons-modal'에 추가되었습니다.");

        } else {
             if (!isFetching) {
                 refreshBtn.classList.remove('is-loading');
             }
        }
    }
    const modal = document.getElementById('controls-modal');
    if (modal) {
        const observer = new MutationObserver(mutationsList => {
            let modalOpened = false;
            let sportsSectionOpened = false;

            for (let mutation of mutationsList) {
                if (mutation.target === modal && mutation.attributeName === 'class' && modal.classList.contains('is-active')) {
                     modalOpened = true;
                }
                else if (mutation.target.id === 'sports-channels-modal' && mutation.attributeName === 'style') {
                    const sportsSection = mutation.target;
                    if (sportsSection.style.display === 'block') {
                        sportsSectionOpened = true;
                    }
                }
            }

            if (modalOpened) {
                 addOrUpdateButton();
            }
            if (sportsSectionOpened) {
                 console.log("스포츠 섹션 열림.");
                 fetchAllSpotvStatuses(); 
            }
        });

        observer.observe(modal, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['class', 'style']
         });
        console.log("MutationObserver 시작됨 (모달 및 스포츠 섹션 감지).");
    } else {
        console.error("관찰할 컨트롤 모달(#controls-modal)을 찾을 수 없습니다.");
    }

    const now = Date.now();
    let changed = false;
    Object.keys(liveStatusCache).forEach(key => {
        if (!liveStatusCache[key] || now - liveStatusCache[key].timestamp >= CACHE_EXPIRY * 10) {
            delete liveStatusCache[key];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('spotvLiveStatusCache', JSON.stringify(liveStatusCache));
        console.log("매우 오래된 캐시 항목 정리 완료.");
    }

    console.log("Spotvnow 라이브 상태 스크립트 v2.1 (버튼 위치 변경) 초기화 완료.");

})();
