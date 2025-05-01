// ==UserScript==
// @name         버튼 연동 (롤캐용)
// @namespace    http://tampermonkey.net/
// @version      1.1.0
// @description  스포티비 확인용
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

        #customPlayerPanel #closeButton {
            position: absolute; top: 2px; right: 2px; background: #ff4d4d; border: none; cursor: pointer;
            width: 23px; height: 23px; display: none; padding: 0; border-radius: 50%; z-index: 10001;
            line-height: 23px; text-align: center;
        }
        #customPlayerPanel #closeButton:hover { background: #cc0000; }
        #customPlayerPanel #closeButton img { width: 11px; height: 11px; display: inline-block; vertical-align: middle; margin-top: -2px; filter: brightness(0) invert(1); }

        #customPlayerPanel #streamList {
            background: #14161A; 
            margin-top: 0; display: none; max-height: 500px; overflow-y: auto;
            padding: 5px; width: 400px; border-radius: 0 0 3px 3px;
            color: #c5c8cc;
            scrollbar-width: thin;
            scrollbar-color: #6a707c #2a2d33;
        }
         #customPlayerPanel #streamList::-webkit-scrollbar { width: 6px; }
         #customPlayerPanel #streamList::-webkit-scrollbar-track { background: #2a2d33; border-radius: 3px;}
         #customPlayerPanel #streamList::-webkit-scrollbar-thumb { background-color: #6a707c; border-radius: 3px; }

        #customPlayerPanel .streamItem {
            margin: 2px 0; padding: 5px; background: #2a2d33;
            border-radius: 3px; cursor: pointer; display: flex; align-items: center;
            transition: background-color 0.2s;
        }
        #customPlayerPanel .streamItem:hover { background: #3c4047; }
        #customPlayerPanel .thumbnail { width: 120px; height: 68px; margin-right: 8px; object-fit: cover; flex-shrink: 0; border: 1px solid #4b505a; }
        #customPlayerPanel .streamInfo { font-size: 12px; line-height: 1.3; }
        #customPlayerPanel .streamTitle { font-weight: bold; color: #e0e3e6; }
        #customPlayerPanel .streamerName { color: #a0a5ac; }

         #customPlayerPanel #streamList div[style*="text-align: center"] { color: #888e99 !important; }
    `;

    const liveStatusCache = JSON.parse(localStorage.getItem('liveStatusCache') || '{}');
    const thumbnailCache = JSON.parse(localStorage.getItem('thumbnailCache') || '{}');
    const CACHE_EXPIRY = 300000;
    const FETCH_TIMEOUT = 10000;
    const THUMBNAIL_TIMEOUT = 15000;
    const DEFAULT_THUMBNAIL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAA4CAMAAAAPRHmFAAAAM1BMVEX///+ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZ0B4eAAAAEHRSTlMAESIzRFVmd4iZqrvM3e7/dpUBFQAAAMpJREFUeNrt0sESgCAIBLEcQPD/v7ZKkISXTZN15O5K8sFfAQC+5kFAD8H5XwICAgICAvI/BAQEBASkPwgICAgISC8QEBAYooDhN+AQQKkQAYsHwkL4cCAgICAgIP1CQEBAQEBaBwQEBAQEBAQEBAQEBAQEBOT/FBAQEBAQEIABFQQEBAQE5J8UEBAQEBAQkD4gICAgIK0DAgICAgJSHwQEBAQEBH4UEBAQEBD4RUBAQEBA+AsEBAQEBKQvEBAQEBCQ+wL4H6zP4dAcIQAAAABJRU5ErkJggg==';

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
    spotvnowButton.title = 'Spotvnow 목록 열기/닫기';
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

    function isCacheValid(cacheEntry) { return cacheEntry && (Date.now() - cacheEntry.timestamp < CACHE_EXPIRY); }
    function createStreamItemHTML(stream) {
        if (!stream || !stream.id) return '';
        const channelNum = stream.id.replace('lcspo', '');
        return `
            <div class="streamItem" data-channel-num="${channelNum}" title="Spotvnow 채널 ${channelNum}">
                <img src="${stream.image || DEFAULT_THUMBNAIL}" class="thumbnail" alt="Thumbnail" onerror="this.onerror=null; this.src='${DEFAULT_THUMBNAIL}';">
                <div class="streamInfo">
                    <div class="streamTitle">Spotvnow 채널 ${channelNum}</div>
                    <div class="streamerName">${stream.streamer || `ch${channelNum}`}</div>
                </div>
            </div>
        `;
    }

    function updateStreamListDOM(streams) {
        const validStreams = streams.filter(s => s && s.id);
        validStreams.sort((a, b) => parseInt(a.id.replace('lcspo', '')) - parseInt(b.id.replace('lcspo', '')));

        const listHTML = validStreams.map(createStreamItemHTML).join('');
        list.innerHTML = listHTML || '<div style="padding: 10px; text-align: center; color: #888e99;">라이브 스트림이 없습니다.</div>';

        list.querySelectorAll('.streamItem').forEach(item => {
            item.addEventListener('click', () => {
                const channelNumStr = item.dataset.channelNum;
                if (!channelNumStr) { console.error("No channel number found.", item); return; }
                const sidebar = document.getElementById('sidebar');
                if (!sidebar) { console.error("Sidebar element (#sidebar) not found."); return; }

                const targetButton = sidebar.querySelector(`.channel-button[data-url*="ch${channelNumStr.padStart(2, '0')}-nlivecdn"]`);

                if (targetButton && typeof targetButton.click === 'function') {
                    console.log(`Found button (.channel-button) for channel ${channelNumStr}, clicking...`);
                    targetButton.click();
                    closeButton.click();
                } else {
                    console.error(`Button (.channel-button) for channel ${channelNumStr} not found or not clickable.`);
                    alert(`플레이어 페이지에서 채널 ${channelNumStr} 버튼(.channel-button)을 찾을 수 없습니다.`);
                }
            });
        });
    };

    function fetchWithTimeout(url, timeout = FETCH_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const controller = new AbortController(); const signal = controller.signal;
            const timer = setTimeout(() => { controller.abort(); reject(new Error(`Request timed out after ${timeout}ms`)); }, timeout);
            GM_xmlhttpRequest({
                method: "GET", url: url, signal: signal,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' },
                onload: (response) => { clearTimeout(timer); if (response.status >= 200 && response.status < 300) resolve(response.responseText); else reject(new Error(`Request failed with status ${response.status} for ${url}`)); },
                onerror: (error) => { clearTimeout(timer); reject(new Error(`Request failed for ${url}: ${error.error || 'Unknown'}`)); },
                onabort: () => clearTimeout(timer),
                ontimeout: () => { clearTimeout(timer); reject(new Error(`GM_xmlhttpRequest timed out for ${url}`)); }
            });
        });
    }
    async function generateHlsThumbnail(m3u8Url, cacheKey) {
        const cached = thumbnailCache[cacheKey];
        if (cached && isCacheValid(cached)) return cached.data;
        if (!window.Hls || !Hls.isSupported()) { console.warn("HLS.js not supported."); return DEFAULT_THUMBNAIL; }
        return new Promise(resolve => {
            const video = document.createElement('video'); video.muted = true; video.preload = 'metadata'; video.crossOrigin = 'anonymous'; video.width = 160; video.height = 90; video.style.position = 'fixed'; video.style.left = '-9999px'; document.body.appendChild(video);
            const hls = new Hls({}); let timeoutHandle = setTimeout(() => { console.warn(`Thumb timeout ${cacheKey}`); cleanup(); resolve(DEFAULT_THUMBNAIL); }, THUMBNAIL_TIMEOUT); let cleanedUp = false;
            const cleanup = () => { if (cleanedUp) return; cleanedUp = true; clearTimeout(timeoutHandle); if (hls) hls.destroy(); if (video) { video.removeEventListener('loadeddata', onLoadedData); video.removeEventListener('seeked', onSeeked); video.removeEventListener('error', onError); video.pause(); video.removeAttribute('src'); video.load(); video.remove(); } };
            const onLoadedData = () => { video.removeEventListener('loadeddata', onLoadedData); const seekTime = Math.min(video.duration >= 2 ? 2 : (video.duration / 2), 5); if (video.seekable && video.seekable.length > 0 && isFinite(seekTime)) { try { let canSeek = false; for (let i = 0; i < video.seekable.length; i++) if (seekTime >= video.seekable.start(i) && seekTime <= video.seekable.end(i)) { canSeek = true; break; } if (canSeek) video.currentTime = seekTime; else { console.warn(`Seek time invalid ${cacheKey}.`); video.currentTime = video.seekable.start(0); } } catch (e) { console.error(`Seek error ${cacheKey}:`, e); cleanup(); resolve(DEFAULT_THUMBNAIL); } } else { console.warn(`Not seekable ${cacheKey}`); cleanup(); resolve(DEFAULT_THUMBNAIL); } };
            const onSeeked = () => { if (cleanedUp) return; requestAnimationFrame(() => { if (cleanedUp) return; const canvas = document.createElement('canvas'); canvas.width = video.width; canvas.height = video.height; const ctx = canvas.getContext('2d'); try { ctx.drawImage(video, 0, 0, canvas.width, canvas.height); const dataUrl = canvas.toDataURL('image/jpeg', 0.7); const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); const pixelData = imageData.data; let isBlank = true; for (let i = 0; i < pixelData.length; i += 4 * Math.floor(pixelData.length / 100)) if (pixelData[i] !== 0 || pixelData[i+1] !== 0 || pixelData[i+2] !== 0) if (pixelData[i] !== 255 || pixelData[i+1] !== 255 || pixelData[i+2] !== 255) { isBlank = false; break; } if (dataUrl.length < 200 || isBlank) { console.warn(`Thumb blank/small ${cacheKey}`); cleanup(); resolve(DEFAULT_THUMBNAIL); } else { thumbnailCache[cacheKey] = { data: dataUrl, timestamp: Date.now() }; try { localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache)); } catch (e) { console.error("Saving thumb cache:", e); } cleanup(); resolve(dataUrl); } } catch (e) { console.error(`Canvas draw error ${cacheKey}:`, e); cleanup(); resolve(DEFAULT_THUMBNAIL); } }); };
            const onError = (e) => { console.error(`Video error ${cacheKey}:`, video.error || e); cleanup(); resolve(DEFAULT_THUMBNAIL); };
            video.addEventListener('loadeddata', onLoadedData); video.addEventListener('seeked', onSeeked); video.addEventListener('error', onError);
            hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(e => { /* Autoplay prevented, fine */ }); });
            hls.on(Hls.Events.ERROR, (event, data) => { console.error(`HLS.js error ${cacheKey}: T:${data.type}, D:${data.details}`, data); if (data.fatal || data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR) if (!cleanedUp) { cleanup(); resolve(DEFAULT_THUMBNAIL); } });
            hls.loadSource(m3u8Url); hls.attachMedia(video);
        });
    }
    async function fetchSpotvnowLive(num) {
        const id = `lcspo${num.toString().padStart(2, '0')}`;
        const cached = liveStatusCache[id];
        if (isCacheValid(cached)) { if (cached.data && thumbnailCache[id] && !isCacheValid(thumbnailCache[id])) { cached.data.image = await generateHlsThumbnail(cached.data.m3u8Url, id); } else if (cached.data && !cached.data.image && thumbnailCache[id]) { cached.data.image = thumbnailCache[id].data; } return cached.data; }
        const pNum = num.toString().padStart(2, '0');
        const url = `https://ch${pNum}-nlivecdn.spotvnow.co.kr/ch${pNum}/decr/medialist_14173921312004482655_hls.m3u8`;
        try { await fetchWithTimeout(url, FETCH_TIMEOUT); const thumb = await generateHlsThumbnail(url, id); if (thumb === DEFAULT_THUMBNAIL) { console.log(`Ch ${pNum} no thumb. Offline.`); liveStatusCache[id] = { data: null, timestamp: Date.now() }; localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache)); return null; } const data = { title: `Spotvnow Channel ${num}`, from: 'muzso', image: thumb, streamer: `Spotvnow ch${pNum}`, viewers: 'N/A', url: `/muzso/${id}`, id: id, m3u8Url: url }; liveStatusCache[id] = { data: data, timestamp: Date.now() }; localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache)); return data; } catch (err) { console.log(`Fetch fail Ch ${pNum}: ${err.message}. Offline.`); liveStatusCache[id] = { data: null, timestamp: Date.now() }; localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache)); delete thumbnailCache[id]; localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache)); return null; }
    }

    let loadingInterval = null;
    async function updateSpotvnowList() {
        list.style.display = 'block';
        closeButton.style.display = 'block';
        refreshButton.style.display = 'flex';

        list.innerHTML = '<div style="padding: 20px; text-align: center; color: #888e99;">로딩 중<span id="loadingDots">.</span></div>';
        loadingInterval && clearInterval(loadingInterval);
        const dotsSpan = list.querySelector('#loadingDots');
        let dotCount = 1;
        loadingInterval = setInterval(() => {
            dotCount = (dotCount % 3) + 1;
            if (dotsSpan) dotsSpan.textContent = '.'.repeat(dotCount);
        }, 500);

        const channelNumbers = Array.from({ length: 40 }, (_, i) => i + 1);
        const fetchPromises = channelNumbers.map(num => fetchSpotvnowLive(num).catch(err => { console.error(`Fetch err ch ${num}:`, err); return null; }));
        const results = await Promise.allSettled(fetchPromises);
        loadingInterval && clearInterval(loadingInterval); loadingInterval = null;
        const liveStreams = results.filter(r => r.status === 'fulfilled' && r.value !== null).map(r => r.value);
        updateStreamListDOM(liveStreams);
    }

    spotvnowButton.addEventListener('click', () => { if (list.style.display === 'block') closeButton.click(); else updateSpotvnowList(); });
    refreshButton.addEventListener('click', () => { Object.keys(liveStatusCache).forEach(key => { liveStatusCache[key].timestamp = 0; }); Object.keys(thumbnailCache).forEach(key => { thumbnailCache[key].timestamp = 0; }); console.log("Cache cleared, refreshing..."); updateSpotvnowList(); });
    closeButton.addEventListener('click', () => { list.style.display = 'none'; closeButton.style.display = 'none'; refreshButton.style.display = 'none'; loadingInterval && clearInterval(loadingInterval); loadingInterval = null; });

    console.log("Custom Spotvnow List script initialized (Dark Theme Fixed).");

    const sidebar = document.getElementById('sidebar');
    if (panel && sidebar) {
        const computedPanelStyle = getComputedStyle(panel);
        const initialPanelLeftPx = parseInt(computedPanelStyle.left, 10) || 10;
        console.log(`Initial Panel Left: ${initialPanelLeftPx}px`);
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
        observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
        console.log("MutationObserver started for iframe sidebar class changes.");
    } else {
        if (!panel) console.error("Tampermonkey panel (#customPlayerPanel) not found.");
        if (!sidebar) console.error("Sidebar element (#sidebar) not found inside iframe.");
        console.error("Cannot link panel position to iframe sidebar state.");
    }
    const now = Date.now(); let changed = false;
    Object.keys(liveStatusCache).forEach(key => { if (!liveStatusCache[key] || now - liveStatusCache[key].timestamp >= CACHE_EXPIRY * 5) { delete liveStatusCache[key]; changed = true; } });
    Object.keys(thumbnailCache).forEach(key => { if (!thumbnailCache[key] || now - thumbnailCache[key].timestamp >= CACHE_EXPIRY * 5) { delete thumbnailCache[key]; changed = true; } });
    if (changed) { localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache)); localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache)); console.log("Cleaned up old cache entries."); }

})();
