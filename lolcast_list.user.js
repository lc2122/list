// ==UserScript==
// @name         롤캐 리스트
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  롤캐 방송 목록
// @author       lc2122
// @match        https://lolcast.kr/*
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function() {
    'use strict';

    // UI 스타일 정의
    const styles = `
        #lolcastPanel { position: fixed; top: 0px; right: 293px; background: rgba(255, 255, 255, 0.9); z-index: 10000; box-shadow: 0 0 10px rgba(0,0,0,0.5); font-family: Arial, sans-serif; }
        #lolcastButton { padding: 5px; background: #E8E7E3; border: none; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; }
        #lolcastButton:hover { background: #0056b3; }
        #lolcastButton img { width: 24px; height: 24px; }
        #streamList { margin-top: 10px; display: none; max-height: 400px; overflow-y: auto; }
        .streamItem { margin: 5px 0; padding: 5px; background: rgba(255, 255, 255, 0.9); border-radius: 3px; cursor: pointer; display: flex; align-items: center; }
        .streamItem:hover { background: #e9ecef; }
        .thumbnail { width: 50px; height: 28px; margin-right: 10px; object-fit: cover; }
    `;

    // 제외할 스트리머 목록
    const excludedStreamers = ['riotgames', 'gamesdonequick', '호진LEE'];

    // 하드코딩된 치지직 채널 ID 목록
    const chzzkChannelIds = ['181a3baebe508d3b5fa5d9fe4d6b5241', 'be243c7cbfb8d4e28777eedc43e28181', '26722002e8651b504a1abee300545fd8',
                             '447451c85ed61ab9abb2c7a1f3e255bd', 'ef86feb3dd91c1916bf1302297b68dec', '34a2bd4f5988e37693e94306f0bfe57f',
                             'b70ec4738c99441a62672fe4fb6edbe2', '60791fdee51b6885bc83793de93e899f', '0e3bf03cd3e8e13070f698a795167b36',
                             'd6c101790f8ce022be88307814b0d205', 'd88a21503d2b84545026aa502111abd7', '13bfa7b04126a4edf3f46d584e3d4e7f'];

    // 하드코딩된 유튜브 채널 정보
    const youtubeChannel = {
        id: 'UCw1DsweY9b2AKGjV4kGJP1A',
        name: 'Unknown YouTube Channel',
        platform: 'youtube'
    };

    // localStorage에서 캐시된 채널 이름 가져오기
    const channelNameCache = JSON.parse(localStorage.getItem('chzzkChannelNames') || '{}');

    // UI 요소 생성
    const panel = document.createElement('div');
    panel.id = 'lolcastPanel';
    document.body.appendChild(panel);

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);

    const button = document.createElement('button');
    button.id = 'lolcastButton';
    const buttonImg = document.createElement('img');
    buttonImg.src = 'https://images.icon-icons.com/3478/PNG/512/checklist_list_orderlist_order_icon_219982.png';
    buttonImg.alt = 'Stream List';
    button.appendChild(buttonImg);
    panel.appendChild(button);

    const list = document.createElement('div');
    list.id = 'streamList';
    panel.appendChild(list);

    // 기본 스트림 데이터 가져오기 (dostream)
    async function fetchStreamList() {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const apiUrl = 'https://www.dostream.com/dev/stream_list.php';
        try {
            const response = await fetch(proxyUrl + encodeURIComponent(apiUrl));
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const text = await response.text();
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
            } else {
                throw new Error('Invalid JSON response');
            }
        } catch (error) {
            console.error('Error fetching stream list:', error);
            return [];
        }
    }

    // 치지직 라이브 데이터 가져오기 (v2 live-status 사용)
    async function fetchChzzkLive(channelId) {
        const proxyUrl = 'https://api.allorigins.win/raw?url=';
        const liveStatusUrl = `https://api.chzzk.naver.com/polling/v2/channels/${channelId}/live-status`;
        let channelName = channelNameCache[channelId];

        try {
            const liveResponse = await fetch(proxyUrl + encodeURIComponent(liveStatusUrl));
            if (!liveResponse.ok) {
                console.error(`Failed to fetch live status for ${channelId}: HTTP ${liveResponse.status}`);
                return null;
            }
            const liveData = await liveResponse.json();
            console.log(`CHZZK Live-Status Raw Response for ${channelId}:`, liveData);

            const live = liveData.content;
            if (!live) {
                console.log(`No content in live-status response for ${channelId}`);
                return null;
            }

            if (live.status !== 'OPEN') {
                console.log(`Channel ${channelId} is not live (status: ${live.status})`);
                return null;
            }

            if (!channelName) {
                const channelUrl = `https://api.chzzk.naver.com/service/v1/channels/${channelId}`;
                const channelResponse = await fetch(proxyUrl + encodeURIComponent(channelUrl));
                if (!channelResponse.ok) {
                    console.error(`Failed to fetch channel data for ${channelId}: HTTP ${channelResponse.status}`);
                    channelName = 'Unknown';
                } else {
                    const channelData = await channelResponse.json();
                    const channel = channelData.content;
                    channelName = channel.channelName || 'Unknown';
                    channelNameCache[channelId] = channelName;
                    localStorage.setItem('chzzkChannelNames', JSON.stringify(channelNameCache));
                }
            }

            const streamData = {
                title: live.liveTitle || '라이브 방송 중',
                from: 'chzzk',
                image: 'https://via.placeholder.com/240x180',
                streamer: channelName,
                viewers: live.concurrentUserCount ? live.concurrentUserCount.toString() : 'N/A',
                url: `/chzzk/${channelId}`,
                id: channelId
            };

            const channelUrl = `https://api.chzzk.naver.com/service/v1/channels/${channelId}`;
            const channelResponse = await fetch(proxyUrl + encodeURIComponent(channelUrl));
            if (channelResponse.ok) {
                const channelData = await channelResponse.json();
                const channel = channelData.content;
                streamData.image = channel.channelImageUrl || streamData.image;
            }

            console.log(`Processed stream data for ${channelId}:`, streamData);
            return streamData;
        } catch (error) {
            console.error(`Error fetching CHZZK data for ${channelId}:`, error);
            return null;
        }
    }

    // 유튜브 라이브 영상 ID 가져오기
    async function fetchYouTubeLive(channelId) {
        const YOUTUBE_LIVE_URL = `https://www.youtube.com/channel/${channelId}/live`;
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: YOUTUBE_LIVE_URL,
                onload: function(response) {
                    const videoIdMatch = response.responseText.match(/"videoId":"([\w-]+)"/);
                    const isLiveNow = response.responseText.includes('"isLiveNow":true') || response.responseText.includes('"isLive":true');
                    const liveBroadcastContentMatch = response.responseText.match(/"liveBroadcastContent":"(\w+)"/);
                    const isLiveBroadcast = liveBroadcastContentMatch && liveBroadcastContentMatch[1] === 'live';
                    const titleMatch = response.responseText.match(/"title":"([^"]+)"/);
                    const thumbnailMatch = response.responseText.match(/"thumbnailUrl":"([^"]+)"/);

                    if (videoIdMatch && videoIdMatch[1] && (isLiveNow || isLiveBroadcast)) {
                        const videoId = videoIdMatch[1];
                        const title = titleMatch ? titleMatch[1] : '라이브 방송 중';
                        const thumbnail = thumbnailMatch ? thumbnailMatch[1] : 'https://i.imgur.com/bL3GZl6.png';

                        let channelName = channelNameCache[channelId];
                        if (!channelName) {
                            const channelNameMatch = response.responseText.match(/"channelName":"([^"]+)"/);
                            channelName = channelNameMatch ? channelNameMatch[1] : 'Unknown YouTube Channel';
                            channelNameCache[channelId] = channelName;
                            localStorage.setItem('chzzkChannelNames', JSON.stringify(channelNameCache));
                        }

                        resolve({
                            title: title,
                            from: 'youtube',
                            image: thumbnail,
                            streamer: channelName,
                            viewers: 'N/A',
                            url: `/youtube/${videoId}`,
                            id: videoId
                        });
                    } else {
                        resolve(null);
                    }
                },
                onerror: () => resolve(null)
            });
        });
    }

    // 스트림 목록 업데이트 함수 (병렬 처리)
    async function updateStreamList() {
        list.innerHTML = '로딩 중...';
        list.style.display = 'block';

        const dostreamPromise = fetchStreamList();
        const chzzkPromises = chzzkChannelIds.map(channelId => fetchChzzkLive(channelId));
        const youtubePromise = fetchYouTubeLive(youtubeChannel.id);

        const [dostreamStreams, ...chzzkAndYoutubeStreams] = await Promise.all([dostreamPromise, ...chzzkPromises, youtubePromise]);

        let streams = dostreamStreams.filter(stream => !excludedStreamers.includes(stream.streamer));
        const liveStreams = chzzkAndYoutubeStreams.filter(stream => stream !== null);
        streams = [...liveStreams, ...streams];

        console.log('All Streams:', streams);

        list.innerHTML = '';
        if (streams.length === 0) {
            list.innerHTML = '스트림 데이터를 가져올 수 없습니다. URL을 확인하세요.';
        } else {
            streams.forEach(stream => {
                if (!stream.id) {
                    console.error('Missing ID for stream:', stream);
                    return;
                }
                const item = document.createElement('div');
                item.className = 'streamItem';
                item.innerHTML = `
                    <img src="${stream.image}" class="thumbnail" alt="Thumbnail">
                    ${stream.streamer} (${stream.from}): ${stream.title} - ${stream.viewers}명
                `;
                item.addEventListener('click', () => {
                    const platform = stream.from;
                    const streamerId = stream.id;
                    window.location.href = `https://lolcast.kr/#/player/${platform}/${streamerId}`;
                });
                list.appendChild(item);
            });
        }
    }

    // 버튼 클릭 이벤트
    button.addEventListener('click', () => {
        if (list.style.display === 'none') {
            updateStreamList();
        } else {
            list.style.display = 'none';
        }
    });
})();
