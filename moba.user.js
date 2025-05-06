// ==UserScript==
// @name         Spotvnow Live Status for Mobile Modal (롤캐용 v2)
// @namespace    http://tampermonkey.net/
// @version      2.0.1
// @description  모바일 모달의 스포츠 섹션에 Spotvnow 라이브 상태 확인 기능을 통합합니다.
// @author       ㅇㅌㄹㅋ (Adapted by AI)
// @match        https://lolcast-e0478.web.app/m 
// @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/moba.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // --- 설정 ---
    const CACHE_EXPIRY = 180000; // 3분 라이브 상태 캐시 유효 시간
    const FETCH_TIMEOUT = 8000; // 8초 M3U8 접근성 확인 타임아웃
    const MAX_CHANNELS = 40; // 확인할 Spotvnow 채널 수
    const REFRESH_BUTTON_ID = 'spotv-refresh-modal-btn'; // 버튼 ID 정의

    // --- 캐시 ---
    const liveStatusCache = JSON.parse(localStorage.getItem('spotvLiveStatusCache') || '{}');
    let lastFetchTimestamp = 0; // 마지막 가져오기 타임스탬프
    let isFetching = false; // 현재 상태 가져오기 진행 중인지 여부

    // --- CSS ---
    GM_addStyle(`
        /* 버튼 라이브 상태 표시 스타일 */
        #sports-channels-modal .spotv-btn.is-live {
            border-color: #ffd700 !important; /* 금색 테두리 */
            color: #ffd700 !important;      /* 금색 텍스트 */
            font-weight: bold;
        }

        /* 새로고침 버튼 로딩 상태 (아이콘 회전) */
        #${REFRESH_BUTTON_ID}.is-loading i {
             animation: spinAround 1s infinite linear;
         }
         @keyframes spinAround {
             from { transform: rotate(0deg); }
             to { transform: rotate(360deg); }
         }

         /* 새로고침 버튼 아이콘 색상 조정 (선택 사항) */
         #${REFRESH_BUTTON_ID} i {
            color: #485fc7; /* Bulma is-link 색상과 비슷하게 */
         }
         #${REFRESH_BUTTON_ID}:hover i {
             color: #3e56c4; /* 호버 시 약간 어둡게 */
         }
         #${REFRESH_BUTTON_ID}.is-loading i {
             color: #ff3860; /* 로딩 중에는 빨간색 (선택 사항) */
         }
    `);

    // --- 헬퍼 함수 (변경 없음) ---
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
        if (refreshButton) refreshButton.classList.add('is-loading'); // 버튼 로딩 상태 표시

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
            if (refreshButton) refreshButton.classList.remove('is-loading'); // 로딩 상태 해제
            console.log("상태 확인 완료.");
            updateLiveStatusIndicators(); // UI 업데이트
        }
    }

    // --- UI 통합 ---

    function addOrUpdateButton() {
        // "사용자 입력" 섹션의 버튼 그룹 찾기
        const buttonContainer = document.getElementById('custom-url-buttons-modal');
        if (!buttonContainer) {
            // console.warn("버튼 컨테이너(custom-url-buttons-modal)를 찾을 수 없습니다.");
            return; // 컨테이너 없으면 버튼 추가 불가
        }

        // 기존 버튼 확인
        let refreshBtn = document.getElementById(REFRESH_BUTTON_ID);

        if (!refreshBtn) {
            // 버튼이 없으면 새로 생성
            console.log("Spotvnow 새로고침 버튼 생성 시도...");

            // Bulma .control 요소로 감싸기
            const controlP = document.createElement('p');
            controlP.className = 'control';

            refreshBtn = document.createElement('button');
            refreshBtn.id = REFRESH_BUTTON_ID;
            // 기존 버튼들과 유사한 스타일 적용 (is-link, is-info 대신 기본 버튼 사용)
            refreshBtn.className = 'button is-light is-small spotv-refresh-modal-btn'; // is-light 추가
            refreshBtn.title = 'Spotvnow 라이브 상태 새로고침';
            // 아이콘만 표시
            refreshBtn.innerHTML = '<span class="icon"><i class="fas fa-sync-alt"></i></span>';

            refreshBtn.addEventListener('click', (event) => {
                event.preventDefault(); // 기본 동작 방지
                // 캐시 지우고 강제 새로고침
                Object.keys(liveStatusCache).forEach(key => { delete liveStatusCache[key]; });
                 localStorage.removeItem('spotvLiveStatusCache');
                 console.log("수동 새로고침: 캐시 지움.");
                fetchAllSpotvStatuses(true); // 강제 fetch
            });

            controlP.appendChild(refreshBtn);
            // 버튼 그룹의 마지막 자식으로 추가 ("즐겨찾기 관리" 버튼 오른쪽)
            buttonContainer.appendChild(controlP);

            console.log("Spotvnow 새로고침 버튼이 'custom-url-buttons-modal'에 추가되었습니다.");

        } else {
             // console.log("Spotvnow 새로고침 버튼이 이미 존재합니다.");
             // 필요시 버튼 상태 업데이트 로직 추가 가능 (예: is-loading 클래스 제거)
             if (!isFetching) {
                 refreshBtn.classList.remove('is-loading');
             }
        }
    }

    // 모달 상태 및 스포츠 섹션 상태 변경 감지
    const modal = document.getElementById('controls-modal');
    if (modal) {
        const observer = new MutationObserver(mutationsList => {
            let modalOpened = false;
            let sportsSectionOpened = false;

            for (let mutation of mutationsList) {
                // 모달이 활성화되었는지 확인
                if (mutation.target === modal && mutation.attributeName === 'class' && modal.classList.contains('is-active')) {
                     modalOpened = true;
                }
                // 스포츠 섹션의 스타일(display)이 변경되었는지 확인
                else if (mutation.target.id === 'sports-channels-modal' && mutation.attributeName === 'style') {
                    const sportsSection = mutation.target;
                    if (sportsSection.style.display === 'block') {
                        sportsSectionOpened = true;
                    }
                }
            }

            // 변경 사항에 따른 동작 실행
            if (modalOpened) {
                 // console.log("컨트롤 모달 열림.");
                 addOrUpdateButton(); // 모달 열릴 때 버튼 추가 또는 업데이트
            }
            if (sportsSectionOpened) {
                 console.log("스포츠 섹션 열림.");
                 fetchAllSpotvStatuses(); // 스포츠 섹션 열릴 때 라이브 상태 확인 (자동)
            }
        });

        observer.observe(modal, {
            attributes: true,
            childList: true, // 하위 요소 추가/제거 감지 (버튼 컨테이너 로딩 대비)
            subtree: true,
            attributeFilter: ['class', 'style']
         });
        console.log("MutationObserver 시작됨 (모달 및 스포츠 섹션 감지).");
    } else {
        console.error("관찰할 컨트롤 모달(#controls-modal)을 찾을 수 없습니다.");
    }

    // --- 초기 정리 (변경 없음) ---
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
