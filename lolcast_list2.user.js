// ==UserScript==
// @name         롤캐 리스트github용
// @namespace    http://tampermonkey.net/
// @version      0.6
// @description  롤캐 방송 목록 with Spotvnow HLS thumbnails
// @author       lc2122
// @match        https://lc2122.github.io/lolcast/*
// @grant        GM_xmlhttpRequest
// @require      https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.4.12/hls.min.js
// ==/UserScript==

/* globals Hls */

(function() {
    'use strict';

    let isDarkMode = localStorage.getItem('lolcastDarkMode') === 'true' ||
                     (localStorage.getItem('lolcastDarkMode') === null && window.matchMedia('(prefers-color-scheme: dark)').matches);

    const styles = `
        #lolcastPanel {
            position: fixed;
            top: 55px;
            right: 17.5%;
            background: ${isDarkMode ? '#2a2a2a' : '#F8F8F8'};
            z-index: 10000;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            border-radius: 3px;
            color: ${isDarkMode ? '#ffffff' : '#000000'};
            transform: translateZ(0);
        }
        #buttonContainer { display: flex; align-items: center; width: fit-content; height: 28px; }
        #lolcastButton {
            background: ${isDarkMode ? '#3a3a3a' : '#F8F8F8'};
            border: none;
            cursor: pointer;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
        }
        #kickButton, #flowButton {
            background: ${isDarkMode ? '#3a3a3a' : '#F8F8F8'};
            border: none;
            cursor: pointer;
            width: 40px;
            height: 28px;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: bold;
            color: ${isDarkMode ? '#ffffff' : '#000000'};
        }
        #lolcastButton:hover, #kickButton:hover, #flowButton:hover { background: #0056b3; }
        #lolcastButton img { width: 24px; height: 24px; }
        #closeButton {
            position: absolute;
            top: 3px;
            right: 3px;
            background: #ff4d4d;
            border: none;
            cursor: pointer;
            width: 23px;
            height: 23px;
            display: none;
            padding: 0;
            border-radius: 50%;
        }
        #closeButton:hover { background: #cc0000; }
        #closeButton img { width: 11px; height: 11px; display: block; margin: auto; }
        #modeToggleButton {
            background: ${isDarkMode ? '#3a3a3a' : '#F8F8F8'};
            border: none;
            cursor: pointer;
            width: 28px;
            height: 28px;
            display: none;
            align-items: center;
            justify-content: center;
            margin-left: 5px;
        }
        #modeToggleButton:hover { background: #0056b3; }
        #modeToggleButton img { width: 24px; height: 24px; }
        #streamList {
            background: ${isDarkMode ? '#2a2a2a' : '#E8E7E3'};
            margin-top: 0;
            display: none;
            max-height: 400px;
            overflow-y: auto;
            padding: 5px;
            width: 500px;
            border-radius: 0 0 3px 3px;
            color: ${isDarkMode ? '#ffffff' : '#000000'};
        }
        .streamItem {
            margin: 2px 0;
            padding: 5px;
            background: ${isDarkMode ? 'rgba(80, 80, 80, 0.9)' : 'rgba(255, 255, 255, 0.9)'};
            border-radius: 3px;
            cursor: pointer;
            display: flex;
            align-items: center;
        }
        .streamItem:hover { background: ${isDarkMode ? '#7a7a7a' : '#e9ecef'}; }
        .thumbnail { width: 50px; height: 28px; margin-right: 10px; object-fit: cover; }
    `;

    const excludedStreamers = ['riotgames', 'gamesdonequick', '호진LEE'];
    const chzzkChannelIds = ['181a3baebe508d3b5fa5d9fe4d6b5241', 'be243c7cbfb8d4e28777eedc43e28181', '26722002e8651b504a1abee300545fd8',
                             '447451c85ed61ab9abb2c7a1f3e255bd', 'ef86feb3dd91c1916bf1302297b68dec', '34a2bd4f5988e37693e94306f0bfe57f',
                             'b70ec4738c99441a62672fe4fb6edbe2', '60791fdee51b6885bc83793de93e899f', '0e3bf03cd3e8e13070f698a795167b36',
                             'd6c101790f8ce022be88307814b0d205', 'd88a21503d2b84545026aa502111abd7', '13bfa7b04126a4edf3f46d584e3d4e7f',
                             '0d027498b18371674fac3ed17247e6b8'];
    const youtubeChannel = { id: 'UCw1DsweY9b2AKGjV4kGJP1A', name: 'LCK', platform: 'youtube' };
    const kickUsernames = ['d4ei4dy4ds3', 'kdj1779991', 'karyn4021', 'karyn4011', 'hamtore150', 'khh1111', 'arinarintv', 'nei0001', 'neiamok'];
    const channelNameCache = JSON.parse(localStorage.getItem('chzzkChannelNames') || '{}');
    const liveStatusCache = JSON.parse(localStorage.getItem('liveStatusCache') || '{}');
    const thumbnailCache = JSON.parse(localStorage.getItem('thumbnailCache') || '{}');
    const CACHE_EXPIRY = 5 * 60 * 1000;
    const REQUEST_TIMEOUT = 10000;

    const panel = document.createElement('div');
    panel.id = 'lolcastPanel';
    document.body.appendChild(panel);

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    const buttonContainer = document.createElement('div');
    buttonContainer.id = 'buttonContainer';
    panel.appendChild(buttonContainer);

    const button = document.createElement('button');
    button.id = 'lolcastButton';
    button.title = '스트림 목록 열기';
    const buttonImg = document.createElement('img');
    buttonImg.src = 'https://images.icon-icons.com/3478/PNG/512/checklist_list_orderlist_order_icon_219982.png';
    buttonImg.alt = 'Stream List';
    button.appendChild(buttonImg);
    buttonContainer.appendChild(button);

    const closeButton = document.createElement('button');
    closeButton.id = 'closeButton';
    closeButton.title = '목록 닫기';
    const closeImg = document.createElement('img');
    closeImg.src = 'https://cdn-icons-png.flaticon.com/512/1828/1828778.png';
    closeImg.alt = 'Close';
    closeButton.appendChild(closeImg);
    buttonContainer.appendChild(closeButton);

    const kickButton = document.createElement('button');
    kickButton.id = 'kickButton';
    kickButton.title = 'Kick 및 Spotvnow 스트리머 목록';
    kickButton.textContent = 'KICK';
    buttonContainer.appendChild(kickButton);

    const flowButton = document.createElement('button');
    flowButton.id = 'flowButton';
    flowButton.title = 'Flow 플레이어로 이동';
    flowButton.textContent = 'FLOW';
    buttonContainer.appendChild(flowButton);

    const modeToggleButton = document.createElement('button');
    modeToggleButton.id = 'modeToggleButton';
    modeToggleButton.title = '다크/라이트 모드 전환';
    const modeImg = document.createElement('img');
    modeImg.src = isDarkMode ? 'https://cdn-icons-png.flaticon.com/512/581/581601.png' : 'https://cdn-icons-png.flaticon.com/512/3073/3073665.png';
    modeImg.alt = 'Mode Toggle';
    modeToggleButton.appendChild(modeImg);
    buttonContainer.appendChild(modeToggleButton);

    const list = document.createElement('div');
    list.id = 'streamList';
    panel.appendChild(list);

    function isCacheValid(cacheEntry) {
        return cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_EXPIRY;
    }

    function createStreamItemHTML(stream) {
        if (!stream.id) {
            console.error('Missing ID for stream:', stream);
            return '';
        }
        return `
            <div class="streamItem" data-platform="${stream.from}" data-id="${stream.id}">
                <img src="${stream.image}" class="thumbnail" alt="Thumbnail">
                ${stream.streamer} (${stream.from}): ${stream.title} - ${stream.viewers || '시청자 수 없음'}명
            </div>
        `;
    }

    function updateStreamListDOM(streams) {
        const uniqueStreams = Array.from(new Map(streams.map(stream => [stream.id, stream])).values());
        const html = uniqueStreams.map(createStreamItemHTML).join('');
        list.innerHTML = html || '라이브 스트림이 없습니다.';
        list.querySelectorAll('.streamItem').forEach(item => {
            item.addEventListener('click', () => {
                const platform = item.dataset.platform;
                const streamerId = item.dataset.id;
                let targetUrl;

                if (platform === 'hls') {
                    const stream = uniqueStreams.find(s => s.id === streamerId);
                    targetUrl = `https://lc2122.github.io/lolcast/#/hls/${encodeURIComponent(stream.url)}`;
                } else {
                    targetUrl = `https://lc2122.github.io/lolcast/#/${platform}/${streamerId}`;
                }

                window.location.href = targetUrl;
                list.style.display = 'none';
                closeButton.style.display = 'none';
                kickButton.style.display = 'none';
                flowButton.style.display = 'none';
                modeToggleButton.style.display = 'none';
            });
        });
    }

    function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT) {
        return new Promise((resolve, reject) => {
            const requestId = setTimeout(() => reject(new Error('Request timed out')), timeout);
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': 'https://www.spotvnow.co.kr/',
                    'Origin': 'https://www.spotvnow.co.kr/'
                },
                onload: response => {
                    clearTimeout(requestId);
                    resolve(response.responseText);
                },
                onerror: () => {
                    clearTimeout(requestId);
                    reject(new Error('Request failed'));
                }
            });
        });
    }

    async function generateHlsThumbnail(url, channelId) {
        const cachedThumbnail = thumbnailCache[channelId];
        if (cachedThumbnail && isCacheValid(cachedThumbnail)) {
            console.log(`Thumbnail (${channelId}): Using cache`);
            return cachedThumbnail.data;
        }

        return new Promise(async (resolve) => {
            try {
                const response = await fetchWithTimeout(url);
                if (!response) throw new Error('No response from server');

                const blob = new Blob([response], { type: 'application/vnd.apple.mpegurl' });
                const blobUrl = URL.createObjectURL(blob);

                const video = document.createElement('video');
                video.muted = true;

                const hls = new Hls();
                hls.loadSource(blobUrl);
                hls.attachMedia(video);

                video.addEventListener('loadeddata', () => {
                    video.currentTime = 1;
                });

                video.addEventListener('seeked', () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 50;
                    canvas.height = 28;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const thumbnail = canvas.toDataURL('image/png');

                    thumbnailCache[channelId] = { data: thumbnail, timestamp: Date.now() };
                    localStorage.setItem('thumbnailCache', JSON.stringify(thumbnailCache));
                    console.log(`Thumbnail (${channelId}): Generated`);
                    hls.destroy();
                    URL.revokeObjectURL(blobUrl);
                    resolve(thumbnail);
                });

                video.addEventListener('error', () => {
                    console.log(`Thumbnail (${channelId}): Failed to load HLS`);
                    hls.destroy();
                    URL.revokeObjectURL(blobUrl);
                    resolve('https://via.placeholder.com/50x28?text=SPOTV');
                });

                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.error(`HLS error for ${channelId}:`, data);
                    hls.destroy();
                    URL.revokeObjectURL(blobUrl);
                    resolve('https://via.placeholder.com/50x28?text=SPOTV');
                });
            } catch (error) {
                console.error(`Thumbnail generation failed for ${channelId}:`, error);
                resolve('https://via.placeholder.com/50x28?text=SPOTV');
            }
        });
    }

    async function fetchStreamList() {
        const apiUrl = 'https://www.dostream.com/dev/stream_list.php';
        try {
            const text = await fetchWithTimeout(apiUrl);
            if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
                const streams = JSON.parse(text);
                return streams.map(stream => ({
                    title: stream.title || '라이브 방송 중',
                    from: stream.from || 'afreeca',
                    image: stream.image || 'https://via.placeholder.com/240x180',
                    streamer: stream.streamer || 'Unknown',
                    viewers: stream.viewers || 'N/A',
                    url: stream.url || '',
                    id: stream.url ? stream.url.split('/')[2] : stream.streamer
                }));
            }
            return [];
        } catch (error) {
            console.error('Error fetching dostream:', error);
            return [];
        }
    }

    async function fetchChzzkLive(channelId) {
        const cachedLive = liveStatusCache[channelId];
        if (isCacheValid(cachedLive) && cachedLive.data) return cachedLive.data;

        const liveStatusUrl = `https://api.chzzk.naver.com/polling/v2/channels/${channelId}/live-status`;
        try {
            const text = await fetchWithTimeout(liveStatusUrl);
            const liveData = JSON.parse(text);
            const live = liveData.content;
            if (!live || live.status !== 'OPEN') {
                liveStatusCache[channelId] = { data: null, timestamp: Date.now() };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                return null;
            }

            const channelName = channelNameCache[channelId] || live.channelName || 'Unknown';
            const thumbnailUrl = live.liveImageUrl || 'https://via.placeholder.com/240x180';

            const streamData = {
                title: live.liveTitle || '라이브 방송 중',
                from: 'chzzk',
                image: thumbnailUrl,
                streamer: channelName,
                viewers: live.concurrentUserCount !== undefined ? live.concurrentUserCount.toString() : 'N/A',
                url: `/chzzk/${channelId}`,
                id: channelId
            };

            liveStatusCache[channelId] = { data: streamData, timestamp: Date.now() };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            return streamData;
        } catch (error) {
            console.error(`Error fetching CHZZK for ${channelId}:`, error);
            return null;
        }
    }

    async function fetchYouTubeLive(channelId) {
        const cachedLive = liveStatusCache[channelId];
        if (isCacheValid(cachedLive) && cachedLive.data) return cachedLive.data;

        const url = `https://www.youtube.com/channel/${channelId}/live`;
        try {
            const text = await fetchWithTimeout(url);
            const videoIdMatch = text.match(/"videoId":"([\w-]+)"/);
            const isLive = text.includes('"isLiveNow":true') || text.includes('"isLive":true') || (text.match(/"liveBroadcastContent":"(\w+)"/)?.[1] === 'live');

            if (videoIdMatch && videoIdMatch[1] && isLive) {
                const videoId = videoIdMatch[1];
                const title = text.match(/"title":"([^"]+)"/)?.[1] || '라이브 방송 중';
                const thumbnail = text.match(/"thumbnailUrl":"([^"]+)"/)?.[1] || 'https://i.imgur.com/bL3GZl6.png';
                const channelName = channelNameCache[channelId] || text.match(/"channelName":"([^"]+)"/)?.[1] || 'LCK';

                if (!channelNameCache[channelId]) {
                    channelNameCache[channelId] = channelName;
                    localStorage.setItem('chzzkChannelNames', JSON.stringify(channelNameCache));
                }

                const streamData = {
                    title: title,
                    from: 'youtube',
                    image: thumbnail,
                    streamer: channelName,
                    viewers: 'N/A',
                    url: `/youtube/${videoId}`,
                    id: videoId
                };
                liveStatusCache[channelId] = { data: streamData, timestamp: Date.now() };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                return streamData;
            }
            liveStatusCache[channelId] = { data: null, timestamp: Date.now() };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            return null;
        } catch (error) {
            console.error(`Error fetching YouTube for ${channelId}:`, error);
            return null;
        }
    }

    async function fetchKickLive(username) {
        const cachedLive = liveStatusCache[username];
        if (isCacheValid(cachedLive) && cachedLive.data) {
            console.log(`Kick (${username}): Using cache`);
            return cachedLive.data;
        }

        const apiUrl = `https://kick.com/api/v1/channels/${username}`;
        try {
            const apiText = await fetchWithTimeout(apiUrl);
            const data = JSON.parse(apiText);

            if (!data || !data.livestream || !data.livestream.is_live) {
                console.log(`Kick (${username}): Not live`);
                liveStatusCache[username] = { data: null, timestamp: Date.now() };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                return null;
            }

            const streamData = {
                title: data.livestream.session_title || '라이브 방송 중',
                from: 'kick',
                image: data.livestream.thumbnail?.url || 'https://via.placeholder.com/240x180',
                streamer: data.user?.username || username,
                viewers: data.livestream.viewers !== undefined ? data.livestream.viewers.toString() : 'N/A',
                url: `/kick/${username}`,
                id: username
            };

            console.log(`Kick (${username}): Live`);
            liveStatusCache[username] = { data: streamData, timestamp: Date.now() };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            return streamData;
        } catch (error) {
            console.error(`Error fetching Kick for ${username}:`, error);
            liveStatusCache[username] = { data: null, timestamp: Date.now() };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            return null;
        }
    }

    async function fetchSpotvnowLive(channelNum) {
    const channelId = `lcspo${channelNum.toString().padStart(2, '0')}`;
    const cachedLive = liveStatusCache[channelId];
    if (isCacheValid(cachedLive) && cachedLive.data) {
        console.log(`Spotvnow (${channelId}): Using cache`);
        return cachedLive.data;
    }

    const hlsUrl = `https://ch${channelNum.toString().padStart(2, '0')}-nlivecdn.spotvnow.co.kr/ch${channelNum.toString().padStart(2, '0')}/decr/medialist_14173921312004482655_hls.m3u8`;
    try {
        const response = await fetchWithTimeout(hlsUrl);
        if (response) {
            const thumbnail = await generateHlsThumbnail(hlsUrl, channelId);
            const streamData = {
                title: `Spotvnow Channel ${channelNum}`,
                from: 'hls',
                image: thumbnail,
                streamer: `Spotvnow ch${channelNum.toString().padStart(2, '0')}`,
                viewers: 'N/A',
                url: hlsUrl,
                id: channelId
            };
            console.log(`Spotvnow (${channelId}): Live`);
            liveStatusCache[channelId] = { data: streamData, timestamp: Date.now() };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            return streamData;
        }
        throw new Error('Not live');
    } catch (error) {
        console.log(`Spotvnow (${channelId}): Not live or error`, error.message);
        liveStatusCache[channelId] = { data: null, timestamp: Date.now() }; // 캐시에 null 저장
        localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
        return null; // 오류 시 null 반환
    }
}

    async function updateStreamList() {
        console.log('Opening stream list (non-Kick only)...');
        list.style.display = 'block';
        closeButton.style.display = 'block';
        kickButton.style.display = 'block';
        flowButton.style.display = 'block';
        modeToggleButton.style.display = 'block';
        list.innerHTML = '로딩 중<span id="loadingDots"></span>';

        const dots = document.getElementById('loadingDots');
        let dotCount = 0;
        const loadingInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            dots.textContent = '.'.repeat(dotCount);
        }, 500);

        const streams = new Map();
        const promises = [];

        Object.values(liveStatusCache)
            .filter(entry => isCacheValid(entry) && entry.data && entry.data.from !== 'kick' && entry.data.from !== 'hls')
            .forEach(entry => streams.set(entry.data.id, entry.data));

        promises.push(fetchStreamList().then(dostreamStreams => {
            dostreamStreams
                .filter(stream => !excludedStreamers.includes(stream.streamer))
                .forEach(stream => streams.set(stream.id, stream));
        }));

        const chzzkPromises = chzzkChannelIds.map(channelId =>
            fetchChzzkLive(channelId).then(stream => {
                if (stream) streams.set(stream.id, stream);
                else streams.delete(channelId);
            })
        );
        promises.push(...chzzkPromises);

        promises.push(fetchYouTubeLive(youtubeChannel.id).then(stream => {
            if (stream) streams.set(stream.id, stream);
            else streams.delete(youtubeChannel.id);
        }));

        Promise.allSettled(promises).then(() => {
            clearInterval(loadingInterval);
            updateStreamListDOM([...streams.values()]);
            console.log('Non-Kick Streams Loaded:', streams.size);
        });
    }

    async function updateKickList() {
        console.log('Opening Kick and Spotvnow list...');
        list.style.display = 'block';
        closeButton.style.display = 'block';
        kickButton.style.display = 'block';
        flowButton.style.display = 'block';
        modeToggleButton.style.display = 'block';
        list.innerHTML = '로딩 중<span id="loadingDots"></span>';

        const dots = document.getElementById('loadingDots');
        let dotCount = 0;
        const loadingInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            dots.textContent = '.'.repeat(dotCount);
        }, 500);

        const streams = new Map();

        const cachedStreams = Object.values(liveStatusCache)
            .filter(entry => isCacheValid(entry) && entry.data && (entry.data.from === 'kick' || entry.data.from === 'hls'));
        cachedStreams.forEach(entry => streams.set(entry.data.id, entry.data));

        if (cachedStreams.length > 0) {
            updateStreamListDOM([...streams.values()]);
        }

        const usernamesToFetch = kickUsernames.filter(username => !isCacheValid(liveStatusCache[username]) || !liveStatusCache[username]?.data);
        const kickPromises = usernamesToFetch.map(username =>
            fetchKickLive(username).then(stream => {
                if (stream) streams.set(stream.id, stream);
                else streams.delete(username);
            })
        );

        const spotvnowChannels = Array.from({ length: 40 }, (_, i) => i + 1);
        const channelsToFetch = spotvnowChannels.filter(ch => {
            const channelId = `lcspo${ch.toString().padStart(2, '0')}`;
            return !isCacheValid(liveStatusCache[channelId]) || !liveStatusCache[channelId]?.data;
        });
        const spotvnowPromises = channelsToFetch.map(channelNum =>
            fetchSpotvnowLive(channelNum).then(stream => {
                if (stream) streams.set(stream.id, stream);
                else streams.delete(`lcspo${channelNum.toString().padStart(2, '0')}`);
            })
        );

        const allPromises = [...kickPromises, ...spotvnowPromises];
        if (allPromises.length === 0) {
            clearInterval(loadingInterval);
            console.log('Kick and Spotvnow Streams Loaded (all from cache):', streams.size);
            return;
        }

        Promise.allSettled(allPromises).then(() => {
            clearInterval(loadingInterval);
            updateStreamListDOM([...streams.values()]);
            console.log('Kick and Spotvnow Streams Loaded:', streams.size);
        });
    }

    function toggleDarkMode() {
        isDarkMode = !isDarkMode;
        localStorage.setItem('lolcastDarkMode', isDarkMode);
        modeImg.src = isDarkMode ? 'https://cdn-icons-png.flaticon.com/512/581/581601.png' : 'https://cdn-icons-png.flaticon.com/512/3073/3073665.png';
        updateStyles();
    }

    function updateStyles() {
        const darkBackground = isDarkMode ? '#2a2a2a' : '#F8F8F8';
        const darkButtonBackground = isDarkMode ? '#3a3a3a' : '#F8F8F8';
        const textColor = isDarkMode ? '#ffffff' : '#000000';
        const itemBackground = isDarkMode ? 'rgba(80, 80, 80, 0.9)' : 'rgba(255, 255, 255, 0.9)';
        const hoverBackground = isDarkMode ? '#7a7a7a' : '#e9ecef';

        panel.style.background = darkBackground;
        panel.style.color = textColor;
        button.style.background = darkButtonBackground;
        kickButton.style.background = darkButtonBackground;
        kickButton.style.color = textColor;
        flowButton.style.background = darkButtonBackground;
        flowButton.style.color = textColor;
        modeToggleButton.style.background = darkButtonBackground;
        list.style.background = darkBackground;
        list.style.color = textColor;
        document.querySelectorAll('.streamItem').forEach(item => {
            item.style.background = itemBackground;
            item.style.color = textColor;
            item.onmouseover = () => { item.style.background = hoverBackground; };
            item.onmouseout = () => { item.style.background = itemBackground; };
        });
    }

    function adjustButtonPosition() {
        const panel = document.getElementById('lolcastPanel');
        const defaultTop = 0;
        const rightContainerWidthPercent = 17.5;
        const zoomLevel = window.devicePixelRatio || 1;

        panel.style.top = `${defaultTop / zoomLevel}px`;
        panel.style.right = `${rightContainerWidthPercent}%`;
    }

    button.addEventListener('click', () => {
        console.log('Button clicked!');
        updateStreamList();
    });

    kickButton.addEventListener('click', () => {
        console.log('Kick button clicked!');
        updateKickList();
    });

    closeButton.addEventListener('click', () => {
        console.log('Close button clicked!');
        list.style.display = 'none';
        closeButton.style.display = 'none';
        kickButton.style.display = 'none';
        flowButton.style.display = 'none';
        modeToggleButton.style.display = 'none';
    });

    flowButton.addEventListener('click', () => {
        console.log('Flow button clicked!');
        window.location.hash = '';
    });

    modeToggleButton.addEventListener('click', () => {
        console.log('Mode toggle clicked!');
        toggleDarkMode();
    });

    updateStyles();
    adjustButtonPosition();
    window.addEventListener('resize', adjustButtonPosition);
})();
