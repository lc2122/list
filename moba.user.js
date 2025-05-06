// ==UserScript==
    // @name         버튼 연동 (롤캐용 - 모바일 모달)
    // @namespace    http://tampermonkey.net/
    // @version      1.2.0
    // @description  모바일 더보기 모달에 Spotvnow 채널 목록 표시
    // @author       ㅇㅌㄹㅋ
    // @match        https://lolcast-e0478.web.app/*
    // @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/moba.user.js
    // @grant        GM_xmlhttpRequest
    // @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js
    // ==/UserScript==

    (function() {
        'use strict';

        // 모바일 모달에 맞춘 스타일
        const styles = `
            #sports-channels-modal .streamItem {
                margin: 2px;
                padding: 5px;
                background: #3a3d43;
                border-radius: 4px;
                cursor: pointer;
                display: flex;
                align-items: center;
                transition: background-color 0.2s;
                font-size: 0.75rem;
                color: #c5c8cc;
                border: 1px solid #5a5d63;
            }
            #sports-channels-modal .streamItem:hover {
                background: #4a4d53;
                border-color: #6a6d73;
            }
            #sports-channels-modal .thumbnail {
                width: 80px;
                height: 45px;
                margin-right: 8px;
                object-fit: cover;
                flex-shrink: 0;
                border: 1px solid #5a5d63;
                border-radius: 3px;
            }
            #sports-channels-modal .streamInfo {
                font-size: 0.7rem;
                line-height: 1.3;
            }
            #sports-channels-modal .streamTitle {
                font-weight: bold;
                color: #e0e3e6;
            }
            #sports-channels-modal .streamerName {
                color: #a0a5ac;
            }
            #sports-channels-modal .no-streams {
                padding: 10px;
                text-align: center;
                color: #888e99;
                font-size: 0.75rem;
            }
        `;

        // 캐시 및 상수
        const liveStatusCache = JSON.parse(localStorage.getItem('liveStatusCache') || '{}');
        const thumbnailCache = JSON.parse(localStorage.getItem('thumbnailCache') || '{}');
        const CACHE_EXPIRY = 300000; // 5분
        const FETCH_TIMEOUT = 10000; // 10초
        const THUMBNAIL_TIMEOUT = 15000; // 15초
        const DEFAULT_THUMBNAIL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAA4CAMAAAAPRHmFAAAAM1BMVEX///+ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZ0B4eAAAAEHRSTlMAESIzRFVmd4iZqrvM3e7/dpUBFQAAAMpJREFUeNrt0sESgCAIBLEcQPD/v7ZKkISXTZN15O5K8sFfAQC+5kFAD8H5XwICAgICAvI/BAQEBASkPwgICAgISC8QEBAYooDhN+AQQKkQAYsHwkL4cCAgICAgIP1CQEBAQEBaBwQEBAQEBAQEBAQEBAQEBOT/FBAQEBAQEIABFQQEBAQE5J8UEBAQEBAQkD4gICAgIK0DAgICAgJSHwQEBAQEBH4UEBAQEBD4RUBAQEBA+AsEBAQEBKQvEBAQEBCQ+wL4H6zP4dAcIQAAAABJRU5ErkJggg==';

        // 스타일 추가
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);

        // 캐시 유효성 검사
        function isCacheValid(cacheEntry) {
            return cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_EXPIRY);
        }

        // 스트림 항목 HTML 생성
        function createStreamItemHTML(stream) {
            if (!stream || !stream.id) return '';
            const channelNum = stream.id.replace('lcspo', '');
            return `
                <div class="streamItem" data-channel-num="${channelNum}" data-url="${stream.m3u8Url}" data-type="m3u8" title="Spotvnow 채널 ${channelNum}">
                    <img src="${stream.image || DEFAULT_THUMBNAIL}" class="thumbnail" alt="Thumbnail" onerror="this.src='${DEFAULT_THUMBNAIL}';">
                    <div class="streamInfo">
                        <div class="streamTitle">Spotvnow 채널 ${channelNum}</div>
                        <div class="streamerName">${stream.streamer || `ch${channelNum}`}</div>
                    </div>
                </div>
            `;
        }

        // 스트림 목록 업데이트
        function updateStreamListDOM(streams) {
            const container = document.getElementById('sports-channels-modal');
            if (!container) {
                console.error("Sports channels modal (#sports-channels-modal) not found.");
                return;
            }
            const validStreams = streams.filter(s => s && s.id);
            validStreams.sort((a, b) => parseInt(a.id.replace('lcspo', '')) - parseInt(b.id.replace('lcspo', '')));

            const listHTML = validStreams.map(createStreamItemHTML).join('');
            container.innerHTML = listHTML || '<div class="no-streams">라이브 스트림이 없습니다.</div>';

            // 스트림 항목에 클릭 이벤트 추가
            container.querySelectorAll('.streamItem').forEach(item => {
                item.addEventListener('click', async () => {
                    const url = item.dataset.url;
                    const type = item.dataset.type;
                    if (!url || !type) {
                        console.error("No URL or type found for stream item.", item);
                        return;
                    }
                    const videoArea = document.getElementById('video-area');
                    if (!videoArea) {
                        console.error("Video area (#video-area) not found.");
                        return;
                    }
                    const playerBoxes = videoArea.querySelectorAll('.player-box');
                    if (playerBoxes.length === 0) {
                        console.error("No player boxes found in video area.");
                        return;
                    }
                    const clickIndex = window.clickIndex || 0; // script.js의 clickIndex 사용
                    const targetBox = playerBoxes[clickIndex % playerBoxes.length];
                    try {
                        await window.loadPlayer(targetBox, url, type); // script.js의 loadPlayer 호출
                        window.clickIndex = (clickIndex + 1) % playerBoxes.length;
                        closeControlsModal(); // 모달 닫기
                    } catch (error) {
                        console.error("Failed to load player:", error);
                        alert(`채널 로드 실패: ${error.message}`);
                    }
                });
            });
        }

        // 타임아웃이 있는 fetch 함수
        function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
            return new Promise((resolve, reject) => {
                const controller = new AbortController();
                const signal = controller.signal;
                const timer = setTimeout(() => {
                    controller.abort();
                    reject(new Error(`Request timed out after ${timeout}ms`));
                }, timeout);
                GM_xmlhttpRequest({
                    method: "GET",
                    url: url,
                    signal: signal,
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                    },
                    onload: (response) => {
                        clearTimeout(timer);
                        if (response.status >= 200 && response.status < 300) {
                            resolve(response.responseText);
                        } else {
                            reject(new Error(`Request failed with status ${response.status} for ${url}`));
                        }
                    },
                    onerror: (error) => {
                        clearTimeout(timer);
                        reject(new Error(`Request failed for ${url}: ${error.error || 'Unknown'}`));
                    },
                    onabort: () => clearTimeout(timer),
                    ontimeout: () => {
                        clearTimeout(timer);
                        reject(new Error(`GM_xmlhttpRequest timed out for ${url}`));
                    }
                });
            });
        }

        // HLS 썸네일 생성
        async function generateHlsThumbnail(m3u8Url, cacheKey) {
            const cached = thumbnailCache[cacheKey];
            if (cached && isCacheValid(cached)) return cached.data;
            if (!window.Hls || !Hls.isSupported()) {
                console.warn("HLS.js not supported.");
                return DEFAULT_THUMBNAIL;
            }
            return new Promise(resolve => {
                const video = document.createElement('video');
                video.muted = true;
                video.preload = 'metadata';
                video.crossOrigin = 'anonymous';
                video.width = 160;
                video.height = 90;
                video.style.position = 'fixed';
                video.style.left = '-9999px';
                document.body.appendChild(video);
                const hls = new Hls({});
                let timeoutHandle = setTimeout(() => {
                    console.warn(`Thumb timeout ${cacheKey}`);
                    cleanup();
                    resolve(DEFAULT_THUMBNAIL);
                }, THUMBNAIL_TIMEOUT);
                let cleanedUp = false;
                const cleanup = () => {
                    if (cleanedUp) return;
                    cleanedUp = true;
                    clearTimeout(timeoutHandle);
                    if (hls) hls.destroy();
                    if (video) {
                        video.removeEventListener('loadeddata', onLoadedData);
                        video.removeEventListener('seeked', onSeeked);
                        video.removeEventListener('error', onError);
                        video.pause();
                        video.removeAttribute('src');
                        video.load();
                        video.remove();
                    }
                };
                const onLoadedData = () => {
                    video.removeEventListener('loadeddata', onLoadedData);
                    const seekTime = Math.min(video.duration >= 2 ? 2 : (video.duration / 2), 5);
                    if (video.seekable && video.seekable.length > 0 && isFinite(seekTime)) {
                        try {
                            let canSeek = false;
                            for (let i = 0; i < video.seekable.length; i++) {
                                if (seekTime >= video.seekable.start(i) && seekTime <= video.seekable.end(i)) {
                                    canSeek = true;
                                    break;
                                }
                            }
                            if (canSeek) video.currentTime = seekTime;
                            else {
                                console.warn(`Seek time invalid ${cacheKey}.`);
                                video.currentTime = video.seekable.start(0);
                            }
                        } catch (e) {
                            console.error(`Seek error ${cacheKey}:`, e);
                            cleanup();
                            resolve(DEFAULT_THUMBNAIL);
                        }
                    } else {
                        console.warn(`Not seekable ${cacheKey}`);
                        cleanup();
                        resolve(DEFAULT_THUMBNAIL);
                    }
                };
                const onSeeked = () => {
                    if (cleanedUp) return;
                    requestAnimationFrame(() => {
                        if (cleanedUp) return;
                        const canvas = document.createElement('canvas');
                        canvas.width = video.width;
                        canvas.height = video.height;
                        const ctx = canvas.getContext('2d');
                        try {
                            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const pixelData = imageData.data;
                            let isBlank = true;
                            for (let i = 0; i < pixelData.length; i += 4 * Math.floor(pixelData.length / 100)) {
                                if (pixelData[i] !== 0 || pixelData[i + 1] !== 0 || pixelData[i + 2] !== 0) {
                                    if (pixelData[i] !== 255 || pixelData[i + 1] !== 255 || pixelData[i + 2] !== 255) {
                                        isBlank = false;
                                        break;
                                    }
                                }
                            }
                            if (dataUrl.length < 200 || isBlank) {
                                console.warn(`Thumb blank/small ${cacheKey}`);
                                cleanup();
                                resolve(DEFAULT_THUMBNAIL);
                            } else {
                                thumbnailCache[cacheKey] = { data: dataUrl, timestamp: Date.now() };
                                try {
                                    localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
                                } catch (e) {
                                    console.error("Saving thumb cache:", e);
                                }
                                cleanup();
                                resolve(dataUrl);
                            }
                        } catch (e) {
                            console.error(`Canvas draw error ${cacheKey}:`, e);
                            cleanup();
                            resolve(DEFAULT_THUMBNAIL);
                        }
                    });
                };
                const onError = (e) => {
                    console.error(`Video error ${cacheKey}:`, video.error || e);
                    cleanup();
                    resolve(DEFAULT_THUMBNAIL);
                };
                video.addEventListener('loadeddata', onLoadedData);
                video.addEventListener('seeked', onSeeked);
                video.addEventListener('error', onError);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(e => { /* Autoplay prevented, fine */ });
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.error(`HLS.js error ${cacheKey}: T:${data.type}, D:${data.details}`, data);
                    if (data.fatal || data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        if (!cleanedUp) {
                            cleanup();
                            resolve(DEFAULT_THUMBNAIL);
                        }
                    }
                });
                hls.loadSource(m3u8Url);
                hls.attachMedia(video);
            });
        }

        // Spotvnow 채널 상태 가져오기
        async function fetchSpotvnowLive(num) {
            const id = `lcspo${num.toString().padStart(2, '0')}`;
            const cached = liveStatusCache[id];
            if (isCacheValid(cached)) {
                if (cached.data && thumbnailCache[id] && !isCacheValid(thumbnailCache[id])) {
                    cached.data.image = await generateHlsThumbnail(cached.data.m3u8Url, id);
                } else if (cached.data && !cached.data.image && thumbnailCache[id]) {
                    cached.data.image = thumbnailCache[id].data;
                }
                return cached.data;
            }
            const pNum = num.toString().padStart(2, '0');
            const url = `https://ch${pNum}-nlivecdn.spotvnow.co.kr/ch${pNum}/decr/medialist_14173921312004482655_hls.m3u8`;
            try {
                await fetchWithTimeout(url, FETCH_TIMEOUT);
                const thumb = await generateHlsThumbnail(url, id);
                if (thumb === DEFAULT_THUMBNAIL) {
                    console.log(`Ch ${pNum} no thumb. Offline.`);
                    liveStatusCache[id] = { data: null, timestamp: Date.now() };
                    localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                    return null;
                }
                const data = {
                    title: `Spotvnow Channel ${num}`,
                    from  from: 'muzso',
                    image: thumb,
                    streamer: `Spotvnow ch${pNum}`,
                    viewers: 'N/A',
                    url: `/muzso/${id}`,
                    id: id,
                    m3u8Url: url
                };
                liveStatusCache[id] = { data: data, timestamp: Date.now() };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                return data;
            } catch (err) {
                console.log(`Fetch fail Ch ${pNum}: ${err.message}. Offline.`);
                liveStatusCache[id] = { data: null, timestamp: Date.now() };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                delete thumbnailCache[id];
                localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
                return null;
            }
        }

        // Spotvnow 목록 업데이트
        async function updateSpotvnowList() {
            const container = document.getElementById('sports-channels-modal');
            if (!container) {
                console.error("Sports channels modal (#sports-channels-modal) not found.");
                return;
            }
            container.innerHTML = '<div class="no-streams">로딩 중...</div>';

            const channelNumbers = Array.from({ length: 10 }, (_, i) => i + 1); // 40 → 10으로 제한
            const fetchPromises = channelNumbers.map(num => fetchSpotvnowLive(num).catch(err => {
                console.error(`Fetch err ch ${num}:`, err);
                return null;
            }));
            const results = await Promise.allSettled(fetchPromises);
            const liveStreams = results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value);
            updateStreamListDOM(liveStreams);
        }

        // 모달 열림 감지
        function observeModal() {
            const controlsModal = document.getElementById('controls-modal');
            if (!controlsModal) {
                console.error("Controls modal (#controls-modal) not found.");
                return;
            }
            const observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.attributeName === 'class' && controlsModal.classList.contains('is-active')) {
                        console.log("Controls modal opened, updating Spotvnow list...");
                        updateSpotvnowList();
                    }
                });
            });
            observer.observe(controlsModal, { attributes: true, attributeFilter: ['class'] });
            console.log("Started observing controls modal for Spotvnow list updates.");
        }

        // 초기화
        console.log("Spotvnow List script for mobile modal initialized.");
        observeModal();

        // 캐시 정리
        const now = Date.now();
        let changed = false;
        Object.keys(liveStatusCache).forEach(key => {
            if (!liveStatusCache[key] || now - liveStatusCache[key].timestamp >= CACHE_EXPIRY * 5) {
                delete liveStatusCache[key];
                changed = true;
            }
        });
        Object.keys(thumbnailCache).forEach(key => {
            if (!thumbnailCache[key] || now - thumbnailCache[key].timestamp >= CACHE_EXPIRY * 5) {
                delete thumbnailCache[key];
                changed = true;
            }
        });
        if (changed) {
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
            console.log("Cleaned up old cache entries.");
        }
    })();
