// ==UserScript==
// @name         버튼 연동 (롤캐용)
// @namespace    http://tampermonkey.net/
// @version      1.2.1
// @description  스포티비 + 쿠팡플레이 확인용
// @author       ㅇㅌㄹㅋ
// @match        https://lolcast-e0478.web.app/*
// @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/spolist.user.js
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js
// ==/UserScript==


(function() {
    'use strict';

    const styles = `
        #customPlayerPanel {
            position: fixed;
            top: 5px;
            left: 190px;
            background: #14161A;
            z-index: 10000;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            border-radius: 3px;
            color: #c5c8cc;
            box-shadow: 0 2px 10px rgba(0,0,0,0.3);
            transition: left 0.3s ease;
        }
        #customPlayerPanel #buttonContainer { display: flex; align-items: center; width: fit-content; height: 28px; }
        /* --- 버튼 배경/테두리/텍스트 색상 변경 --- */
        #customPlayerPanel #spotvnowButton, #customPlayerPanel #refreshButton {
            background: #2a2d33;
            border: 1px solid #4b505a;
            color: #c5c8cc;
            cursor: pointer;
            width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: bold; padding: 0;
            transition: background-color 0.2s, border-color 0.2s;
        }
        #customPlayerPanel #spotvnowButton img, #customPlayerPanel #refreshButton img {
            width: 20px; height: 20px;
            filter: brightness(0) invert(0.8);
        }
        #customPlayerPanel #spotvnowButton:hover, #customPlayerPanel #refreshButton:hover {
            background: #3c4047;
            border-color: #6a707c;
        }
        #customPlayerPanel #refreshButton { display: none; margin-left: 5px; }

        /* --- 닫기 버튼 스타일 유지 (빨간색 강조) --- */
        #customPlayerPanel #closeButton {
            position: absolute; top: 2px; right: 2px; background: #ff4d4d; border: none; cursor: pointer;
            width: 23px; height: 23px; display: none; padding: 0; border-radius: 50%; z-index: 10001;
            line-height: 23px; text-align: center;
        }
        #customPlayerPanel #closeButton:hover { background: #cc0000; }
        #customPlayerPanel #closeButton img { width: 11px; height: 11px; display: inline-block; vertical-align: middle; margin-top: -2px; filter: brightness(0) invert(1); /* 흰색 아이콘 */ }

        /* --- 리스트 스타일 변경 --- */
        #customPlayerPanel #streamList {
            background: #14161A; /* ★★★ 패널과 동일한 배경 ★★★ */
            margin-top: 0; display: none; max-height: 500px; overflow-y: auto;
            padding: 5px; width: 400px; border-radius: 0 0 3px 3px;
            color: #c5c8cc; /* 기본 텍스트 색상 */
            scrollbar-width: thin;
            scrollbar-color: #6a707c #2a2d33; /* 스크롤바 색상 */
        }
         #customPlayerPanel #streamList::-webkit-scrollbar { width: 6px; }
         #customPlayerPanel #streamList::-webkit-scrollbar-track { background: #2a2d33; border-radius: 3px;}
         #customPlayerPanel #streamList::-webkit-scrollbar-thumb { background-color: #6a707c; border-radius: 3px; }

        /* --- 리스트 아이템 스타일 변경 --- */
        #customPlayerPanel .streamItem {
            margin: 2px 0; padding: 5px; background: #2a2d33; /* 약간 밝은 어두운 배경 */
            border-radius: 3px; cursor: pointer; display: flex; align-items: center;
            transition: background-color 0.2s;
        }
        #customPlayerPanel .streamItem:hover { background: #3c4047; /* 호버 시 약간 더 밝게 */ }
        #customPlayerPanel .thumbnail { width: 120px; height: 68px; margin-right: 8px; object-fit: cover; flex-shrink: 0; border: 1px solid #4b505a; /* 어두운 테두리 */ }
        #customPlayerPanel .streamInfo { font-size: 12px; line-height: 1.3; }
        #customPlayerPanel .streamTitle { font-weight: bold; color: #e0e3e6; /* 제목은 조금 더 밝게 */ }
        #customPlayerPanel .streamerName { color: #a0a5ac; /* 스트리머 이름은 약간 어둡게 */ }

        /* 로딩/없음 메시지 */
         #customPlayerPanel #streamList div[style*="text-align: center"] { color: #888e99 !important; }
    `;

    const liveStatusCache = JSON.parse(localStorage.getItem('liveStatusCache') || '{}');
    const thumbnailCache = JSON.parse(localStorage.getItem('thumbnailCache') || '{}');
    const CACHE_EXPIRY = 300000; // 5 minutes
    const FETCH_TIMEOUT = 10000; // 10 seconds
    const THUMBNAIL_TIMEOUT = 15000; // 15 seconds
    const DEFAULT_THUMBNAIL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAA4CAMAAAAPRHmFAAAAM1BMVEX///+ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZ0B4eAAAAEHRSTlMAESIzRFVmd4iZqrvM3e7/dpUBFQAAAMpJREFUeNrt0sESgCAIBLEcQPD/v7ZKkISXTZN15O5K8sFfAQC+5kFAD8H5XwICAgICAvI/BAQEBASkPwgICAgISC8QEBAYooDhN+AQQKkQAYsHwkL4cCAgICAgIP1CQEBAQEBaBwQEBAQEBAQEBAQEBAQEBOT/FBAQEBAQEIABFQQEBAQE5J8UEBAQEBAQkD4gICAgIK0DAgICAgJSHwQEBAQEBH4UEBAQEBD4RUBAQEBA+AsEBAQEBKQvEBAQEBCQ+wL4H6zP4dAcIQAAAABJRU5ErkJggg==';
    const COUPANG_ID_PREFIX = 'lccp'; // Coupang ID Prefix

    const coupangPlayUrls = [
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/70d5a559acf6499e93050793eb248532/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/42bae655ed2c4de5b8926d6f25ab4d61/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/8c03657875ef4dd4be048f0e6c6a6e4c/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/8b474ac1a7004b9e906ed2efc73ec23d/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/8ab14ad8f0ce4c1782a9cb9b15c388b4/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/0df6c0312da849a494eac7e46e587100/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/c78b1450ad33472c920ea3c756993fb6/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/ea6151c04a944320a86d4ae51c21256d/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/d22c82d6841b41519ff05bd3196e9637/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/70fd66b6a08c486b9e9cdf607a471bc1/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/8b36955b262e4249bce0cf139ea8509c/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/2b7e797b36904c8a9fbeef1fa7d0f2ce/index.m3u8",
        "https://live04.coupangstreaming.com/v1/master/d226efdd6829df54ce3eb8bbdfe3981f7fc650b4/play_live04/out/v1/0a317776efd940f285a95f6ec3fac015/index.m3u8",
        "https://live04.coupangstreaming.com/out/v1/3826333a4f954aa0be1493c2ca287e36/index.m3u8",
        "https://live04.coupangstreaming.com/out/v1/5fbab823487d4cf6a3c4da096fa8a8f7/index.m3u8",
        "https://live04.coupangstreaming.com/out/v1/8986e1546f784526befa63514dff03ed/index.m3u8",
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

    const panel = document.createElement('div');
    panel.id = 'customPlayerPanel';
    document.body.appendChild(panel);

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'buttonContainer';
    panel.appendChild(buttonContainer);

    const spotvnowButton = document.createElement('button');
    spotvnowButton.id = 'spotvnowButton';
    spotvnowButton.title = '라이브 목록 열기/닫기'; // Title can be made more generic
    const buttonImg = document.createElement('img');
    buttonImg.src = 'https://images.icon-icons.com/3478/PNG/512/checklist_list_orderlist_order_icon_219982.png';
    buttonImg.alt = '목록';
    spotvnowButton.appendChild(buttonImg);
    buttonContainer.appendChild(spotvnowButton);

    const refreshButton = document.createElement('button');
    refreshButton.id = 'refreshButton';
    refreshButton.title = '목록 새로고침';
    const refreshImg = document.createElement('img');
    refreshImg.src = 'https://cdn-icons-png.flaticon.com/512/61/61444.png';
    refreshImg.alt = '새로고침';
    refreshButton.appendChild(refreshImg);
    buttonContainer.appendChild(refreshButton);

    const closeButton = document.createElement('button');
    closeButton.id = 'closeButton';
    closeButton.title = '목록 닫기';
    const closeImg = document.createElement('img');
    closeImg.src = 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png';
    closeImg.alt = '닫기';
    closeButton.appendChild(closeImg);
    panel.appendChild(closeButton);

    const list = document.createElement('div');
    list.id = 'streamList';
    panel.appendChild(list);

    function isCacheValid(cacheEntry) {
        return cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_EXPIRY);
    }

    function createStreamItemHTML(stream) {
        if (!stream || !stream.id) return '';
        let displayText, titleText, streamerNameText;

        if (stream.from === 'spotvnow') {
            const channelNum = stream.id.replace('lcspo', '');
            displayText = `Spotvnow 채널 ${channelNum}`;
            titleText = `Spotvnow 채널 ${channelNum}`;
            streamerNameText = stream.streamer || `ch${channelNum}`;
        } else if (stream.from === 'coupangplay') {
            const channelIndex = parseInt(stream.id.replace(COUPANG_ID_PREFIX, ''), 10) + 1;
            displayText = `쿠팡플레이 채널 ${channelIndex}`;
            titleText = `쿠팡플레이 채널 ${channelIndex}`;
            streamerNameText = stream.streamer || `Coupang Play`;
        } else {
            displayText = stream.title || "Unknown Stream";
            titleText = stream.title || "Unknown Stream";
            streamerNameText = stream.streamer || "Unknown";
        }

        return `
            <div class="streamItem" data-stream-id="${stream.id}" data-m3u8-url="${stream.m3u8Url}" data-stream-title="${titleText}" data-stream-provider="${stream.from}" title="${titleText}">
                <img src="${stream.image || DEFAULT_THUMBNAIL}" class="thumbnail" alt="Thumbnail" onerror="this.onerror=null; this.src='${DEFAULT_THUMBNAIL}';">
                <div class="streamInfo">
                    <div class="streamTitle">${displayText}</div>
                    <div class="streamerName">${streamerNameText}</div>
                </div>
            </div>
        `;
    }

    function updateStreamListDOM(streams) {
        const validStreams = streams.filter(s => s && s.id && s.m3u8Url);
        validStreams.sort((a, b) => {
            if (a.from === 'spotvnow' && b.from !== 'spotvnow') return -1;
            if (a.from !== 'spotvnow' && b.from === 'spotvnow') return 1;
            if (a.from === 'coupangplay' && b.from !== 'coupangplay') return -1;
            if (a.from !== 'coupangplay' && b.from === 'coupangplay') return 1;

            const numA = parseInt(a.id.replace('lcspo', '').replace(COUPANG_ID_PREFIX, ''), 10);
            const numB = parseInt(b.id.replace('lcspo', '').replace(COUPANG_ID_PREFIX, ''), 10);
            return numA - numB;
        });

        const listHTML = validStreams.map(createStreamItemHTML).join('');
        list.innerHTML = listHTML || '<div style="padding: 10px; text-align: center; color: #888e99;">라이브 스트림이 없습니다.</div>';

        list.querySelectorAll('.streamItem').forEach(item => {
            item.addEventListener('click', () => {
                const streamId = item.dataset.streamId;
                const m3u8Url = item.dataset.m3u8Url;
                const streamTitle = item.dataset.streamTitle; // For display or fallback
                const streamProvider = item.dataset.streamProvider;

                if (!streamId || !m3u8Url) {
                    console.error("Stream ID or M3U8 URL not found on item.", item);
                    return;
                }

                const sidebar = document.getElementById('sidebar');
                if (!sidebar) {
                    console.error("Sidebar element (#sidebar) not found.");
                    alert("플레이어 페이지의 사이드바를 찾을 수 없습니다.");
                    return;
                }

                if (streamProvider === 'spotvnow') {
                    const channelNumStr = streamId.replace('lcspo', '');
                    const baseM3u8Path = `ch${channelNumStr.padStart(2, '0')}-nlivecdn`;
                    const targetButton = sidebar.querySelector(`.channel-button[data-url*="${baseM3u8Path}"]`);

                    if (targetButton && typeof targetButton.click === 'function') {
                        console.log(`Found Spotvnow button for channel ${channelNumStr} (matching ${baseM3u8Path}), clicking...`);
                        targetButton.click();
                        closeButton.click();
                    } else {
                        console.warn(`Spotvnow button for channel ${channelNumStr} (matching ${baseM3u8Path}) not found. Trying window.loadStream.`);
                        if (typeof window.loadStream === 'function') {
                            const spotvNowShortTitle = `CH${channelNumStr.padStart(2, '0')}`;
                            window.loadStream(m3u8Url, spotvNowShortTitle, "spotvnow");
                            closeButton.click();
                        } else {
                            alert(`플레이어 페이지에서 Spotvnow 채널 ${channelNumStr} 버튼을 찾을 수 없거나 loadStream 함수가 없습니다.`);
                        }
                    }
                } else if (streamProvider === 'coupangplay') {
                    const targetButton = sidebar.querySelector(`.channel-button[data-url="${m3u8Url}"]`);


                    if (targetButton && typeof targetButton.click === 'function') {
                        console.log(`Found Coupang Play button for M3U8, clicking...`);
                        targetButton.click();
                        closeButton.click();
                    } else {
                        console.error(`Coupang Play button for M3U8 ${m3u8Url} not found in sidebar or not clickable.`);
                        alert(`플레이어 페이지에서 해당 쿠팡플레이 채널 버튼을 찾을 수 없습니다.\n(M3U8: ${m3u8Url.slice(-30)})`);

                    }
                }
            });
        });
    }

    function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController();
            const signal = controller.signal;
            const timer = setTimeout(() => {
                controller.abort();
                reject(new Error(`Request timed out after ${timeout}ms for ${url}`));
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
                    if (response.status >= 200 && response.status < 300) resolve(response.responseText);
                    else reject(new Error(`Request failed with status ${response.status} for ${url}`));
                },
                onerror: (error) => {
                    clearTimeout(timer);
                    reject(new Error(`Request failed for ${url}: ${error.error || 'Unknown'}`));
                },
                onabort: () => {
                    clearTimeout(timer);
                    console.warn(`Request aborted for ${url}`);
                },
                ontimeout: () => {
                    /* Handled by controller */ }
            });
        });
    }

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
            video.style.opacity = '0';
            document.body.appendChild(video);
            const hls = new Hls({
                debug: false,
                enableWorker: true,
                lowLatencyMode: false,
                liveSyncDurationCount: 1,
                liveMaxLatencyDurationCount: 2
            });
            let timeoutHandle = setTimeout(() => {
                console.warn(`Thumbnail generation timed out for ${cacheKey}`);
                cleanup();
                resolve(DEFAULT_THUMBNAIL);
            }, THUMBNAIL_TIMEOUT);
            let cleanedUp = false;

            const cleanup = () => {
                if (cleanedUp) return;
                cleanedUp = true;
                clearTimeout(timeoutHandle);
                if (hls) {
                    hls.destroy();
                }
                if (video) {
                    video.removeEventListener('loadeddata', onLoadedData);
                    video.removeEventListener('seeked', onSeeked);
                    video.removeEventListener('error', onError);
                    video.pause();
                    video.removeAttribute('src');
                    try {
                        video.load();
                    } catch (e) {
                        /* ignore */ }
                    video.remove();
                }
            };

            const onLoadedData = () => {
                video.removeEventListener('loadeddata', onLoadedData);
                if (cleanedUp) return;
                const seekTime = Math.min((video.duration >= 1 && isFinite(video.duration)) ? 0.5 : 0, 5);
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
                        else video.currentTime = video.seekable.start(0);
                    } catch (e) {
                        console.error(`Seek error for ${cacheKey}:`, e);
                        cleanup();
                        resolve(DEFAULT_THUMBNAIL);
                    }
                } else {
                    console.warn(`Video not seekable or invalid duration for ${cacheKey}. Trying to capture as is.`);
                    onSeeked();
                }
            };
            const onSeeked = () => {
                if (cleanedUp) return;
                requestAnimationFrame(() => {
                    if (cleanedUp) return;
                    const canvas = document.createElement('canvas');
                    canvas.width = video.videoWidth || video.width;
                    canvas.height = video.videoHeight || video.height;
                    if (canvas.width === 0 || canvas.height === 0) {
                        console.warn(`Canvas dimensions are zero for ${cacheKey}.`);
                        cleanup();
                        resolve(DEFAULT_THUMBNAIL);
                        return;
                    }
                    const ctx = canvas.getContext('2d');
                    try {
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                        if (dataUrl.length < 200) {
                            console.warn(`Generated thumbnail is too small for ${cacheKey}. Likely blank.`);
                            cleanup();
                            resolve(DEFAULT_THUMBNAIL);
                        } else {
                            thumbnailCache[cacheKey] = {
                                data: dataUrl,
                                timestamp: Date.now()
                            };
                            try {
                                localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
                            } catch (e) {
                                console.error("Error saving thumbnail to localStorage:", e);
                            }
                            cleanup();
                            resolve(dataUrl);
                        }
                    } catch (e) {
                        console.error(`Canvas drawImage error for ${cacheKey}:`, e);
                        cleanup();
                        resolve(DEFAULT_THUMBNAIL);
                    }
                });
            };
            const onError = (e) => {
                console.error(`Video element error for ${cacheKey}:`, video.error || e);
                cleanup();
                resolve(DEFAULT_THUMBNAIL);
            };

            video.addEventListener('loadeddata', onLoadedData);
            video.addEventListener('seeked', onSeeked);
            video.addEventListener('error', onError);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (!cleanedUp) video.play().catch(e => {
                    /* Autoplay often prevented */ });
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                console.error(`HLS.js error for ${cacheKey}: Type: ${data.type}, Details: ${data.details}`, data);
                if (data.fatal || data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    if (!cleanedUp) {
                        cleanup();
                        resolve(DEFAULT_THUMBNAIL);
                    }
                }
            });
            try {
                hls.loadSource(m3u8Url);
                hls.attachMedia(video);
            } catch (e) {
                console.error(`Error setting up HLS for ${cacheKey}: `, e);
                cleanup();
                resolve(DEFAULT_THUMBNAIL);
            }
        });
    }

    async function fetchSpotvnowLive(num) {
        const id = `lcspo${num.toString().padStart(2, '0')}`;
        const cached = liveStatusCache[id];
        if (isCacheValid(cached)) {
            if (cached.data && thumbnailCache[id] && !isCacheValid(thumbnailCache[id])) {
                cached.data.image = await generateHlsThumbnail(cached.data.m3u8Url, id);
            } else if (cached.data && !cached.data.image && thumbnailCache[id] && isCacheValid(thumbnailCache[id])) {
                cached.data.image = thumbnailCache[id].data;
            }
            return cached.data;
        }
        const pNum = num.toString().padStart(2, '0');
        const m3u8Url = `https://ch${pNum}-nlivecdn.spotvnow.co.kr/ch${pNum}/decr/medialist_14173921312004482655_hls.m3u8`;
        try {
            const thumb = await generateHlsThumbnail(m3u8Url, id);
            if (thumb === DEFAULT_THUMBNAIL) {
                console.log(`Spotvnow Ch ${pNum} got default thumbnail. Offline or stream issue.`);
                liveStatusCache[id] = {
                    data: null,
                    timestamp: Date.now()
                };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                return null;
            }
            const data = {
                title: `Spotvnow Channel ${num}`,
                from: 'spotvnow',
                image: thumb,
                streamer: `Spotvnow ch${pNum}`,
                viewers: 'N/A',
                url: m3u8Url,
                id: id,
                m3u8Url: m3u8Url
            };
            liveStatusCache[id] = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            return data;
        } catch (err) {
            console.log(`Fetch/Thumbnail fail for Spotvnow Ch ${pNum}: ${err.message}. Offline.`);
            liveStatusCache[id] = {
                data: null,
                timestamp: Date.now()
            };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            delete thumbnailCache[id];
            localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
            return null;
        }
    }

    async function fetchCoupangPlayLive(m3u8Url, index) {
        const id = `${COUPANG_ID_PREFIX}${index.toString().padStart(2, '0')}`;
        const cached = liveStatusCache[id];
        if (isCacheValid(cached)) {
            if (cached.data && thumbnailCache[id] && !isCacheValid(thumbnailCache[id])) {
                cached.data.image = await generateHlsThumbnail(cached.data.m3u8Url, id);
            } else if (cached.data && !cached.data.image && thumbnailCache[id] && isCacheValid(thumbnailCache[id])) {
                cached.data.image = thumbnailCache[id].data;
            }
            return cached.data;
        }
        try {
            const thumb = await generateHlsThumbnail(m3u8Url, id);
            if (thumb === DEFAULT_THUMBNAIL) {
                console.log(`Coupang Play URL ${index} (${m3u8Url.substring(m3u8Url.length - 20)}) got default thumbnail. Offline/issue.`);
                liveStatusCache[id] = {
                    data: null,
                    timestamp: Date.now()
                };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                return null;
            }
            const data = {
                title: `쿠팡플레이 채널 ${index + 1}`,
                from: 'coupangplay',
                image: thumb,
                streamer: `쿠팡플레이`,
                viewers: 'N/A',
                url: m3u8Url,
                id: id,
                m3u8Url: m3u8Url
            };
            liveStatusCache[id] = {
                data: data,
                timestamp: Date.now()
            };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            return data;
        } catch (err) {
            console.log(`Fetch/Thumbnail fail for Coupang Play URL ${index} (${m3u8Url.substring(m3u8Url.length - 20)}): ${err.message}. Offline.`);
            liveStatusCache[id] = {
                data: null,
                timestamp: Date.now()
            };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            delete thumbnailCache[id];
            localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
            return null;
        }
    }

    let loadingInterval = null;
    async function updateLiveStreamList() {
        list.style.display = 'block';
        closeButton.style.display = 'block';
        refreshButton.style.display = 'flex';
        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #888e99;">로딩 중<span id="loadingDots">.</span></div>';
        loadingInterval && clearInterval(loadingInterval);
        const dotsSpan = list.querySelector('#loadingDots');
        let dotCount = 1;
        if (dotsSpan) {
            loadingInterval = setInterval(() => {
                dotCount = (dotCount % 3) + 1;
                dotsSpan.textContent = '.'.repeat(dotCount);
            }, 500);
        }

        const spotvnowChannelNumbers = Array.from({
            length: 40
        }, (_, i) => i + 1);
        const spotvnowFetchPromises = spotvnowChannelNumbers.map(num => fetchSpotvnowLive(num).catch(err => {
            console.error(`Unhandled Spotvnow CH${num}:`, err);
            return null;
        }));
        const coupangPlayFetchPromises = coupangPlayUrls.map((url, index) => fetchCoupangPlayLive(url, index).catch(err => {
            console.error(`Unhandled Coupang URL ${index}:`, err);
            return null;
        }));

        const allFetchPromises = [...spotvnowFetchPromises, ...coupangPlayFetchPromises];
        const results = await Promise.allSettled(allFetchPromises);
        loadingInterval && clearInterval(loadingInterval);
        loadingInterval = null;
        const liveStreams = results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value);
        updateStreamListDOM(liveStreams);
    }

    spotvnowButton.addEventListener('click', () => {
        if (list.style.display === 'block') {
            closeButton.click();
        } else {
            updateLiveStreamList();
        }
    });
    refreshButton.addEventListener('click', () => {
        Object.keys(liveStatusCache).forEach(key => {
            if (liveStatusCache[key]) liveStatusCache[key].timestamp = 0;
        });
        Object.keys(thumbnailCache).forEach(key => {
            if (thumbnailCache[key]) thumbnailCache[key].timestamp = 0;
        });
        localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
        localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
        console.log("Cache timestamps reset, refreshing list...");
        updateLiveStreamList();
    });
    closeButton.addEventListener('click', () => {
        list.style.display = 'none';
        closeButton.style.display = 'none';
        refreshButton.style.display = 'none';
        loadingInterval && clearInterval(loadingInterval);
        loadingInterval = null;
    });

    console.log("Custom Spotvnow & CoupangPlay List script initialized (Coupang Sidebar Click Mode).");

    const sidebar = document.getElementById('sidebar');
    if (panel && sidebar) {
        const computedPanelStyle = getComputedStyle(panel);
        const initialPanelLeftPx = parseInt(computedPanelStyle.left, 10) || 190;

        const adjustPanelPosition = () => {
            const panelWidth = panel.offsetWidth;
            requestAnimationFrame(() => {
                if (sidebar.classList.contains('is-collapsed')) {

                    panel.style.left = `-${panelWidth + 20}px`;
                } else {

                    panel.style.left = `${initialPanelLeftPx}px`;
                }
            });
        };

        adjustPanelPosition();

        const observer = new MutationObserver((mutationsList) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    adjustPanelPosition(); 
                    break; 
                }
            }
        });

        observer.observe(sidebar, {
            attributes: true,
            attributeFilter: ['class']
        });

    } else {
        if (!panel) console.error("Custom panel element (#customPlayerPanel) not found.");
        if (!sidebar) console.error("Sidebar element (#sidebar) not found.");
    }

    const now = Date.now();
    let changed = false;
    const veryOldThreshold = CACHE_EXPIRY * 5;
    Object.keys(liveStatusCache).forEach(key => {
        if (!liveStatusCache[key] || now - (liveStatusCache[key].timestamp || 0) >= veryOldThreshold) {
            delete liveStatusCache[key];
            changed = true;
        }
    });
    Object.keys(thumbnailCache).forEach(key => {
        if (!thumbnailCache[key] || now - (thumbnailCache[key].timestamp || 0) >= veryOldThreshold) {
            delete thumbnailCache[key];
            changed = true;
        }
    });
    if (changed) {
        localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
        localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
        console.log("Cleaned up very old cache entries.");
    }
})();
