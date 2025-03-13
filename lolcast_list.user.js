// ==UserScript==
// @name         롤캐 리스트
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  롤캐 방송 목록 (속도 최적화, 중복 제거, 썸네일 문제 해결, 첫 로딩 개선, 오프라인 제외, X 버튼 이미지, Flow 버튼 이미지로 변경, 개선 적용)
// @author       lc2122
// @match        https://lolcast.kr/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    const styles = `
        #lolcastPanel { position: fixed; top: 55px; right: 293px; background: #E8E7E3; z-index: 10000; font-family: Arial, sans-serif; display: flex; flex-direction: column; border-radius: 3px; }
        #buttonContainer { display: flex; align-items: center; width: fit-content; height: 28px; }
        #lolcastButton { background: #E8E7E3; border: none; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
        #lolcastButton:hover { background: #0056b3; }
        #lolcastButton img { width: 24px; height: 24px; }
        #closeButton { position: fixed; top: 58px; right: 296px; background: #ff4d4d; border: none; cursor: pointer; width: 23px; height: 23px; display: none; padding: 0; border-radius: 50%; }
        #closeButton:hover { background: #cc0000; }
        #closeButton img { width: 11px; height: 11px; display: block; margin: auto; }
        #flowButton { background: #E8E7E3; border: none; cursor: pointer; width: 40px; height: 28px; display: none; padding: 0; }
        #flowButton img { width: 40px; height: 28px; display: block; margin: auto; }
        #streamList { background: #E8E7E3; margin-top: 0; display: none; max-height: 400px; overflow-y: auto; padding: 5px; width: 500px; border-radius: 0 0 3px 3px; }
        .streamItem { margin: 2px 0; padding: 5px; background: rgba(255, 255, 255, 0.9); border-radius: 3px; cursor: pointer; display: flex; align-items: center; }
        .streamItem:hover { background: #e9ecef; }
        .thumbnail { width: 50px; height: 28px; margin-right: 10px; object-fit: cover; }
    `;

    const excludedStreamers = ['riotgames', 'gamesdonequick', '호진LEE'];
    const chzzkChannelIds = ['181a3baebe508d3b5fa5d9fe4d6b5241', 'be243c7cbfb8d4e28777eedc43e28181', '26722002e8651b504a1abee300545fd8',
                             '447451c85ed61ab9abb2c7a1f3e255bd', 'ef86feb3dd91c1916bf1302297b68dec', '34a2bd4f5988e37693e94306f0bfe57f',
                             'b70ec4738c99441a62672fe4fb6edbe2', '60791fdee51b6885bc83793de93e899f', '0e3bf03cd3e8e13070f698a795167b36',
                             'd6c101790f8ce022be88307814b0d205', 'd88a21503d2b84545026aa502111abd7', '13bfa7b04126a4edf3f46d584e3d4e7f',
                             '0d027498b18371674fac3ed17247e6b8'];
    const youtubeChannel = { id: 'UCw1DsweY9b2AKGjV4kGJP1A', name: 'LCK', platform: 'youtube' };
    const channelNameCache = JSON.parse(localStorage.getItem('chzzkChannelNames') || '{}');
    const liveStatusCache = JSON.parse(localStorage.getItem('liveStatusCache') || '{}');
    const CACHE_EXPIRY = 5 * 60 * 1000;

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

    const flowButton = document.createElement('button');
    flowButton.id = 'flowButton';
    flowButton.title = 'Flow 플레이어로 이동';
    const flowImg = document.createElement('img');
    flowImg.src = 'https://i.imgur.com/NIaln4m.png';
    flowImg.alt = 'Flow';
    flowButton.appendChild(flowImg);
    buttonContainer.appendChild(flowButton);

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
                window.location.href = `https://lolcast.kr/#/player/${platform}/${streamerId}`;
            });
        });
    }

    function fetchWithTimeout(url, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const requestId = setTimeout(() => reject(new Error('Request timed out')), timeout);
            GM_xmlhttpRequest({
                method: "GET",
                url: url,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
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
            throw new Error('Invalid JSON');
        } catch (error) {
            console.error('Error fetching dostream:', error);
            return [];
        }
    }

    async function fetchChzzkLive(channelId) {

        const liveStatusUrl = `https://api.chzzk.naver.com/polling/v2/channels/${channelId}/live-status`;
        try {
            const text = await fetchWithTimeout(liveStatusUrl);
            const liveData = JSON.parse(text);
            console.log(`CHZZK API 응답 (${channelId}):`, liveData); 
            const live = liveData.content;
            if (!live || live.status !== 'OPEN') {
                liveStatusCache[channelId] = { data: null, timestamp: Date.now() };
                localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                return null;
            }

            const channelName = channelNameCache[channelId] || live.channelName || 'Unknown';
            if (!channelNameCache[channelId]) {
                channelNameCache[channelId] = channelName;
                localStorage.setItem('chzzkChannelNames', JSON.stringify(channelNameCache));
            }

            let thumbnailUrl = live.liveImageUrl;
            if (!thumbnailUrl) {
                const channelUrl = `https://api.chzzk.naver.com/service/v1/channels/${channelId}`;
                try {
                    const channelText = await fetchWithTimeout(channelUrl);
                    const channelData = JSON.parse(channelText);
                    thumbnailUrl = channelData.content?.channelImageUrl || 'https://via.placeholder.com/240x180';
                } catch (channelError) {
                    console.error(`Error fetching channel data for ${channelId}:`, channelError);
                    thumbnailUrl = 'https://via.placeholder.com/240x180';
                }
            }

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
                const channelName = channelNameCache[channelId] || text.match(/"channelName":"([^"]+)"/)?.[1] || 'Unknown YouTube Channel';

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

    async function updateStreamList() {
        console.log('Opening stream list...');
        list.style.display = 'block';
        closeButton.style.display = 'block';
        flowButton.style.display = 'block';
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
            .filter(entry => isCacheValid(entry) && entry.data)
            .forEach(entry => streams.set(entry.data.id, entry.data));

        promises.push(fetchStreamList().then(dostreamStreams => {
            dostreamStreams
                .filter(stream => !excludedStreamers.includes(stream.streamer))
                .forEach(stream => streams.set(stream.id, stream));
        }));

        chzzkChannelIds.forEach(channelId => {
            promises.push(fetchChzzkLive(channelId).then(stream => {
                if (stream) streams.set(stream.id, stream);
                else streams.delete(channelId);
            }));
        });

        promises.push(fetchYouTubeLive(youtubeChannel.id).then(stream => {
            if (stream) streams.set(stream.id, stream);
            else streams.delete(youtubeChannel.id);
        }));

        Promise.all(promises).then(() => {
            clearInterval(loadingInterval);
            const streamArray = [...streams.values()];
            updateStreamListDOM(streamArray);
            console.log('All Streams Loaded:', streamArray);
        }).catch(error => {
            clearInterval(loadingInterval);
            console.error('Error updating stream list:', error);
            list.innerHTML = '스트림 로드에 실패했습니다. 다시 시도해주세요.';
        });
    }

    button.addEventListener('click', () => {
        console.log('Button clicked!');
        updateStreamList();
    });

    closeButton.addEventListener('click', () => {
        console.log('Close button clicked!');
        list.style.display = 'none';
        closeButton.style.display = 'none';
        flowButton.style.display = 'none';
    });

    flowButton.addEventListener('click', () => {
        console.log('Flow button clicked!');
        window.location.hash = '#/player/flow';
    });
})();
