// ==UserScript==
// @name         Spotvnow Live Status for Mobile Modal (롤캐용 v2)
// @namespace    http://tampermonkey.net/
// @version      2.0.0
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

    // --- 캐시 ---
    const liveStatusCache = JSON.parse(localStorage.getItem('spotvLiveStatusCache') || '{}');
    let lastFetchTimestamp = 0; // 마지막 가져오기 타임스탬프
    let isFetching = false; // 현재 상태 가져오기 진행 중인지 여부

    // --- 라이브 표시 및 새로고침 버튼 CSS ---
    GM_addStyle(`
        /* 버튼 라이브 상태 표시 스타일 */
        #sports-channels-modal .spotv-btn.is-live {
            border-color: #ffd700 !important; /* 금색 테두리 */
            color: #ffd700 !important;      /* 금색 텍스트 */
            font-weight: bold;
             /* 선택 사항: 작은 맥박 효과 추가 */
            /* box-shadow: 0 0 5px #ffd700, 0 0 10px #ffd700; */
            /* animation: pulse-live 1.5s infinite ease-in-out; */
        }

        /* 선택 사항: 맥박 애니메이션 */
        /* @keyframes pulse-live {
            0% { box-shadow: 0 0 3px #ffd700; }
            50% { box-shadow: 0 0 8px #e6c300; }
            100% { box-shadow: 0 0 3px #ffd700; }
        } */

        /* 새로고침 버튼 컨테이너 스타일 */
        .sport-section-header-container {
            display: flex;
            align-items: center;
            justify-content: space-between; /* 새로고침 버튼을 오른쪽으로 밀어냄 */
            width: 100%; /* 전체 너비를 차지하도록 보장 */
        }

        /* 새로고침 버튼 자체 스타일 */
        .spotv-refresh-button {
            background: none;
            border: none;
            color: #a0a5ac; /* 부제목 색상과 일치 */
            cursor: pointer;
            padding: 0 5px;
            font-size: 0.9em;
            margin-left: 10px; /* 제목과의 간격 */
            display: inline-flex; /* 아이콘 중앙 정렬을 위해 flex 사용 */
            align-items: center;
            justify-content: center;
            transition: color 0.2s;
        }
        .spotv-refresh-button:hover {
            color: #c5c8cc; /* 호버 시 더 밝은 색상 */
        }
         .spotv-refresh-button i { /* Font Awesome 아이콘 */
             line-height: 1; /* 추가 간격 방지 */
         }
         .spotv-refresh-button.is-loading i {
             animation: spinAround 1s infinite linear; /* 로딩 중 회전 애니메이션 */
         }
         /* 간단한 회전 애니메이션 */
         @keyframes spinAround {
             from { transform: rotate(0deg); }
             to { transform: rotate(360deg); }
         }
    `);

    // --- 헬퍼 함수 ---
    function isCacheValid(cacheEntry) {
        // 캐시 항목이 유효한지 (존재하고 만료되지 않았는지) 확인
        return cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_EXPIRY);
    }

    function getChannelNumberFromUrl(m3u8Url) {
        // M3U8 URL에서 채널 번호 추출
        if (!m3u8Url || typeof m3u8Url !== 'string') return null;
        const match = m3u8Url.match(/ch(\d+)-nlivecdn/);
        return match ? parseInt(match[1], 10) : null;
    }

    function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
        // 지정된 시간 내에 HTTP 요청을 수행 (GM_xmlhttpRequest 사용)
        return new Promise((resolve, reject) => {
            const controller = new AbortController(); const signal = controller.signal;
            const timer = setTimeout(() => { controller.abort(); reject(new Error(`요청 시간 초과 (${timeout}ms)`)); }, timeout);
            GM_xmlhttpRequest({
                method: "HEAD", // HEAD 요청 사용 - 파일 다운로드 없이 존재 여부만 확인
                url: url, signal: signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                onload: (response) => { clearTimeout(timer); if (response.status >= 200 && response.status < 400) resolve(true); // 성공 또는 리디렉션은 보통 라이브/사용 가능 의미
                    else reject(new Error(`${url} 요청 실패 (상태 코드: ${response.status})`)); },
                onerror: (error) => { clearTimeout(timer); reject(new Error(`${url} 요청 실패: ${error.error || '알 수 없음'}`)); },
                onabort: () => { clearTimeout(timer); reject(new Error('요청 중단됨')); }, // 중단 명시적 처리
                ontimeout: () => { clearTimeout(timer); reject(new Error(`${url} GM_xmlhttpRequest 시간 초과`)); }
            });
        });
    }

    async function fetchSpotvnowLiveStatus(num) {
        // 특정 Spotvnow 채널의 라이브 상태 확인 (캐시 우선 확인)
        const channelId = `spotv${num}`;
        const cached = liveStatusCache[channelId];
        if (isCacheValid(cached)) {
            // console.log(`[캐시 HIT] Spotv 채널 ${num}: ${cached.live}`);
            return { channel: num, live: cached.live };
        }

        // console.log(`[캐시 MISS] Spotv 채널 ${num} 상태 확인 중`);
        const pNum = num.toString().padStart(2, '0');
        // **중요**: script.js가 버튼에 대해 생성하는 정확한 M3U8 URL 패턴 사용
        const url = `https://ch${pNum}-nlivecdn.spotvnow.co.kr/ch${pNum}/decr/medialist_14173921312004482655_hls.m3u8`;

        try {
            await fetchWithTimeout(url, FETCH_TIMEOUT);
            // fetch가 성공하면 (오류 발생 안 함) 라이브로 간주
            // console.log(`Spotv 채널 ${num} 라이브 상태`);
            liveStatusCache[channelId] = { live: true, timestamp: Date.now() };
            localStorage.setItem('spotvLiveStatusCache', JSON.stringify(liveStatusCache));
            return { channel: num, live: true };
        } catch (err) {
            // console.log(`Spotv 채널 ${num} 오프라인 상태: ${err.message}`);
            liveStatusCache[channelId] = { live: false, timestamp: Date.now() };
            localStorage.setItem('spotvLiveStatusCache', JSON.stringify(liveStatusCache));
            return { channel: num, live: false };
        }
    }

    function updateLiveStatusIndicators() {
        // 모달 내의 Spotvnow 버튼들에 라이브 상태 표시 업데이트
        const sportsModalSection = document.getElementById('sports-channels-modal');
        if (!sportsModalSection) return;

        const spotvButtons = sportsModalSection.querySelectorAll('button.spotv-btn');
        // console.log(`업데이트할 Spotv 버튼 ${spotvButtons.length}개 발견.`);

        spotvButtons.forEach(button => {
            const url = button.dataset.url;
            const channelNum = getChannelNumberFromUrl(url); // URL에서 채널 번호 추출

            if (channelNum !== null) {
                const channelId = `spotv${channelNum}`;
                const status = liveStatusCache[channelId]; // 캐시에서 상태 확인

                if (status && status.live) {
                    button.classList.add('is-live'); // 라이브면 is-live 클래스 추가
                    button.title = `Spotvnow 채널 ${channelNum} (LIVE)`; // 툴팁 업데이트
                } else {
                    button.classList.remove('is-live'); // 오프라인이면 is-live 클래스 제거
                     button.title = `Spotvnow 채널 ${channelNum}`; // 기본 툴팁으로 리셋
                }
            } else {
                 // console.warn("버튼에서 채널 번호를 추출할 수 없습니다:", button);
            }
        });
         console.log("라이브 상태 표시 업데이트 완료.");
    }

    async function fetchAllSpotvStatuses(force = false) {
        // 모든 Spotvnow 채널의 라이브 상태를 가져옴 (필요시 강제 실행)
        if (isFetching) {
            console.log("이미 상태를 가져오는 중입니다.");
            return;
        }
        const now = Date.now();
        if (!force && now - lastFetchTimestamp < CACHE_EXPIRY / 2) { // 불필요한 반복 호출 줄이기
            console.log("마지막 호출 이후 시간이 얼마 지나지 않아 가져오기를 건너<0xEB><0x9B><0x8D>니다.");
            updateLiveStatusIndicators(); // 캐시에서 상태 표시 업데이트는 수행
            return;
        }

        isFetching = true;
        console.log("모든 Spotvnow 라이브 상태 가져오는 중...");
        const refreshButton = document.getElementById('spotv-refresh-btn');
        if (refreshButton) refreshButton.classList.add('is-loading'); // 새로고침 버튼 로딩 상태 표시

        const channelNumbers = Array.from({ length: MAX_CHANNELS }, (_, i) => i + 1);
        const fetchPromises = channelNumbers.map(num =>
            fetchSpotvnowLiveStatus(num).catch(err => {
                console.error(`채널 ${num} 상태 확인 오류:`, err);
                return { channel: num, live: false }; // 오류 발생 시 오프라인으로 처리
            })
        );

        try {
            await Promise.allSettled(fetchPromises); // 모든 확인 작업 완료 대기
        } catch (e) {
            console.error("상태 확인 Promise.allSettled 중 오류 발생:", e);
        } finally {
            isFetching = false;
            lastFetchTimestamp = Date.now(); // 마지막 확인 시간 기록
            if (refreshButton) refreshButton.classList.remove('is-loading'); // 로딩 상태 해제
            console.log("상태 확인 완료.");
            updateLiveStatusIndicators(); // 확인 완료 후 UI 업데이트
        }
    }

    // --- 모달과의 통합 ---

    function addRefreshButton() {
        // 스포츠 채널 섹션 헤더에 새로고침 버튼 추가
        const sportsHeader = document.querySelector('h4.toggle-header[onclick*="sports-channels-modal"]');
        if (!sportsHeader || document.getElementById('spotv-refresh-btn')) {
            // 버튼이 이미 있거나 헤더를 찾지 못하면 종료
            return;
        }

        // 헤더 텍스트 내용을 span으로 감싸서 flex 정렬이 가능하게 함
        const headerText = sportsHeader.textContent;
        sportsHeader.innerHTML = ''; // 기존 내용 지우기

        const textSpan = document.createElement('span');
        textSpan.textContent = headerText.trim(); // 헤더 텍스트

        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'spotv-refresh-btn';
        refreshBtn.className = 'spotv-refresh-button';
        refreshBtn.title = 'Spotvnow 라이브 상태 새로고침';
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i>'; // Font Awesome 아이콘 사용
        refreshBtn.addEventListener('click', (event) => {
            event.stopPropagation(); // 섹션 토글 방지
            event.preventDefault();
            // 수동 새로고침 시 캐시 지우기
            Object.keys(liveStatusCache).forEach(key => { delete liveStatusCache[key]; });
             localStorage.removeItem('spotvLiveStatusCache');
             console.log("수동 새로고침: 캐시 지움.");
            fetchAllSpotvStatuses(true); // 강제로 상태 다시 가져오기
        });

        // 텍스트와 버튼을 담을 새 컨테이너
        const headerContainer = document.createElement('div');
        headerContainer.className = 'sport-section-header-container';
        headerContainer.appendChild(textSpan);
        headerContainer.appendChild(refreshBtn);

        // 컨테이너를 헤더 요소에 추가
        sportsHeader.appendChild(headerContainer);

         // 원래의 토글 기능 다시 연결 (중요!)
        const originalOnclick = sportsHeader.getAttribute('onclick');
        if (originalOnclick) {
             // 이제 컨테이너에 클릭 이벤트를 연결하여 공백 클릭 시에도 작동하도록 함
             headerContainer.addEventListener('click', (e) => {
                  // 클릭된 대상이 새로고침 버튼 자체가 아닐 경우에만 토글 실행
                 if (e.target !== refreshBtn && !refreshBtn.contains(e.target)) {
                    try {
                         // 원본 onclick 문자열을 안전하게 재실행 (약간의 편법이지만 필요함)
                         new Function(originalOnclick)();
                    } catch (err) {
                         console.error("원본 onclick 재실행 오류:", err);
                    }
                 }
             });
             // 부모 H4에서 onclick 속성 제거 (이중 토글 방지)
             sportsHeader.removeAttribute('onclick');
             // 컨테이너에 커서 스타일 설정
             sportsHeader.style.cursor = 'pointer';
        }

        console.log("스포츠 채널 헤더에 새로고침 버튼 추가 완료.");
    }


    // 모달을 관찰하여 스포츠 섹션이 표시될 때 감지
    const modal = document.getElementById('controls-modal');
    if (modal) {
        const observer = new MutationObserver(mutationsList => {
            for (let mutation of mutationsList) {
                // 모달 자체가 활성화되었거나 스포츠 섹션 스타일이 변경되었는지 확인
                if (mutation.target === modal && mutation.attributeName === 'class' && modal.classList.contains('is-active')) {
                     console.log("컨트롤 모달 열림.");
                     addRefreshButton(); // 모달 열릴 때 새로고침 버튼이 있는지 확인하고 추가
                     const sportsSection = document.getElementById('sports-channels-modal');
                     if(sportsSection && sportsSection.style.display === 'block') {
                         console.log("모달 열릴 때 스포츠 섹션이 이미 열려 있음.");
                         fetchAllSpotvStatuses(); // 이미 열려 있으면 상태 확인 실행
                     }
                     break; // 관찰 배치당 한 번의 트리거만 필요
                } else if (mutation.target.id === 'sports-channels-modal' && mutation.attributeName === 'style') {
                    const sportsSection = mutation.target;
                    if (sportsSection.style.display === 'block') {
                        console.log("스포츠 섹션 열림.");
                        addRefreshButton(); // 새로고침 버튼 존재 확인
                        fetchAllSpotvStatuses(); // 섹션이 열릴 때 상태 확인 실행
                    } else {
                        // console.log("스포츠 섹션 닫힘.");
                    }
                     break;
                }
            }
        });

        observer.observe(modal, {
            attributes: true, // 모달 자체의 속성 변경(class) 관찰
            childList: true, // 자식 노드 추가/제거 관찰 (여기서는 덜 필요할 수 있음)
            subtree: true,   // 하위 요소의 속성 변경(sports-section의 style)을 관찰하기 위해 필요
            attributeFilter: ['class', 'style'] // 'class'(모달 활성화)와 'style'(섹션 표시) 속성 필터링
         });
        console.log("컨트롤 모달 및 스포츠 섹션에 대한 MutationObserver 시작됨.");
    } else {
        console.error("관찰할 컨트롤 모달(#controls-modal)을 찾을 수 없습니다.");
    }

    // --- 초기 정리 (선택 사항) ---
    // 스크립트 로드 시 매우 오래된 캐시 항목 제거
    const now = Date.now();
    let changed = false;
    Object.keys(liveStatusCache).forEach(key => {
        if (!liveStatusCache[key] || now - liveStatusCache[key].timestamp >= CACHE_EXPIRY * 10) { // 10배 유효 기간 지난 항목 제거
            delete liveStatusCache[key];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('spotvLiveStatusCache', JSON.stringify(liveStatusCache));
        console.log("매우 오래된 캐시 항목 정리 완료.");
    }

    console.log("Spotvnow 라이브 상태 스크립트 (모바일 모달용) 초기화 완료.");

})();
