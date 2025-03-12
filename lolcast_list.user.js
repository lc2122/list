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
                             'd6c101790f8ce022be88307814b0d205', 'd88a21503d2b84545026aa502111abd7', '13bfa7b04126a4edf3f46d584e3d4e7f',
                             '0d027498b18371674fac3ed17247e6b8'];

    // 하드코딩된 유튜브 채널 정보
    const youtubeChannel = {
        id: 'UCw1DsweY9b2AKGjV4kGJP1A',
        name: 'Unknown YouTube Channel',
        platform: 'youtube'
    };

    // 캐시 관리
    const channelNameCache = JSON.parse(localStorage.getItem('chzzkChannelNames') || '{}');
    const liveStatusCache = JSON.parse(localStorage.getItem('liveStatusCache') || '{}');
    const CACHE_EXPIRY = 60 * 1000; // 1분 캐시 유효 시간

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

    // 캐시 확인 및 업데이트
    function isCacheValid(cacheEntry) {
        return cacheEntry && Date.now() - cacheEntry.timestamp < CACHE_EXPIRY;
    }

    // 스트림 항목 추가 함수
    function addStreamItem(stream) {
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
    }

    // 기본 스트림 데이터 가져오기 (dostream)
    function fetchStreamList() {
        const apiUrl = 'https://www.dostream.com/dev/stream_list.php';
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: apiUrl,
                onload: function(response) {
                    const text = response.responseText;
                    if (text.trim().startsWith('[') || text.trim().startsWith('{')) {
                        const streams = JSON.parse(text);
                        const mappedStreams = streams.map(stream => ({
                            title: stream.title || '라이브 방송 중',
                            from: stream.from || 'afreeca',
                            image: stream.image || 'https://via.placeholder.com/240x180',
                            streamer: stream.streamer || 'Unknown',
                            viewers: stream.viewers || 'N/A',
                            url: stream.url || '',
                            id: stream.url ? stream.url.split('/')[2] : stream.streamer
                        }));
                        resolve(mappedStreams);
                    } else {
                        console.error('Invalid JSON response from dostream');
                        resolve([]);
                    }
                },
                onerror: () => {
                    console.error('Error fetching stream list from dostream');
                    resolve([]);
                }
            });
        });
    }

    // 치지직 라이브 데이터 가져오기 (GM_xmlhttpRequest)
    function fetchChzzkLive(channelId) {
        const cachedLive = liveStatusCache[channelId];
        if (isCacheValid(cachedLive) && cachedLive.data && cachedLive.data.image !== 'https://via.placeholder.com/240x180') {
            console.log(`Using cached data for ${channelId}:`, cachedLive.data);
            return Promise.resolve(cachedLive.data);
        }

        const liveStatusUrl = `https://api.chzzk.naver.com/polling/v2/channels/${channelId}/live-status`;
        let channelName = channelNameCache[channelId];

        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: "GET",
                url: liveStatusUrl,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                onload: function(response) {
                    try {
                        const liveData = JSON.parse(response.responseText);
                        console.log(`CHZZK Live-Status Raw Response for ${channelId}:`, liveData);

                        const live = liveData.content;
                        if (!live || live.status !== 'OPEN') {
                            console.log(`Channel ${channelId} is not live or no content (status: ${live?.status})`);
                            liveStatusCache[channelId] = { data: null, timestamp: Date.now() };
                            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                            resolve(null);
                            return;
                        }

                        if (!channelName) {
                            GM_xmlhttpRequest({
                                method: "GET",
                                url: `https://api.chzzk.naver.com/service/v1/channels/${channelId}`,
                                onload: function(channelResponse) {
                                    const channelData = JSON.parse(channelResponse.responseText);
                                    const channel = channelData.content;
                                    channelName = channel.channelName || 'Unknown';
                                    channelNameCache[channelId] = channelName;
                                    localStorage.setItem('chzzkChannelNames', JSON.stringify(channelNameCache));
                                    processStreamData(live, channelName, channelId, resolve);
                                },
                                onerror: () => {
                                    console.error(`Failed to fetch channel data for ${channelId}`);
                                    channelName = 'Unknown';
                                    processStreamData(live, channelName, channelId, resolve);
                                }
                            });
                        } else {
                            processStreamData(live, channelName, channelId, resolve);
                        }
                    } catch (error) {
                        console.error(`Error parsing CHZZK data for ${channelId}:`, error);
                        resolve(null);
                    }
                },
                onerror: () => {
                    console.error(`Error fetching CHZZK live status for ${channelId}`);
                    resolve(null);
                }
            });
        });

        function processStreamData(live, channelName, channelId, resolve) {
            let streamData = {
                title: live.liveTitle || '라이브 방송 중',
                from: 'chzzk',
                image: live.liveImageUrl || 'https://via.placeholder.com/240x180',
                streamer: channelName,
                viewers: live.concurrentUserCount ? live.concurrentUserCount.toString() : 'N/A',
                url: `/chzzk/${channelId}`,
                id: channelId
            };

            if (!live.liveImageUrl) {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: `https://api.chzzk.naver.com/service/v1/channels/${channelId}`,
                    onload: function(channelResponse) {
                        const channelData = JSON.parse(channelResponse.responseText);
                        const channel = channelData.content;
                        streamData.image = channel.channelImageUrl || 'https://via.placeholder.com/240x180';
                        finalizeStreamData(streamData, channelId, resolve);
                    },
                    onerror: () => {
                        finalizeStreamData(streamData, channelId, resolve);
                    }
                });
            } else {
                finalizeStreamData(streamData, channelId, resolve);
            }
        }

        function finalizeStreamData(streamData, channelId, resolve) {
            liveStatusCache[channelId] = { data: streamData, timestamp: Date.now() };
            localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
            console.log(`Processed stream data for ${channelId}:`, streamData);
            resolve(streamData);
        }
    }

    // 유튜브 라이브 영상 ID 가져오기 (GM_xmlhttpRequest)
    function fetchYouTubeLive(channelId) {
        const cachedLive = liveStatusCache[channelId];
        if (isCacheValid(cachedLive)) {
            console.log(`Using cached data for ${channelId}:`, cachedLive.data);
            return Promise.resolve(cachedLive.data);
        }

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
                        resolve(streamData);
                    } else {
                        liveStatusCache[channelId] = { data: null, timestamp: Date.now() };
                        localStorage.setItem('liveStatusCache', JSON.stringify(liveStatusCache));
                        resolve(null);
                    }
                },
                onerror: () => {
                    console.error(`Error fetching YouTube data for ${channelId}`);
                    resolve(null);
                }
            });
        });
    }

    // 스트림 목록 업데이트 함수 (프로그레시브 로딩)
    async function updateStreamList() {
        list.innerHTML = '로딩 중...';
        list.style.display = 'block';

        const streams = [];
        list.innerHTML = ''; // 초기화

        // dostream 데이터 먼저 표시
        fetchStreamList().then(dostreamStreams => {
            const filteredStreams = dostreamStreams.filter(stream => !excludedStreamers.includes(stream.streamer));
            filteredStreams.forEach(stream => {
                streams.push(stream);
                addStreamItem(stream);
            });
        }).catch(() => console.error('Failed to load dostream'));

        // 치지직 데이터 프로그레시브 로딩
        chzzkChannelIds.forEach(channelId => {
            fetchChzzkLive(channelId).then(stream => {
                if (stream) {
                    streams.push(stream);
                    addStreamItem(stream);
                }
            });
        });

        // 유튜브 데이터
        fetchYouTubeLive(youtubeChannel.id).then(stream => {
            if (stream) {
                streams.push(stream);
                addStreamItem(stream);
            }
        });

        // 모든 데이터 로드 후 확인
        Promise.all([
            fetchStreamList(),
            ...chzzkChannelIds.map(channelId => fetchChzzkLive(channelId)),
            fetchYouTubeLive(youtubeChannel.id)
        ]).then(() => {
            if (streams.length === 0) {
                list.innerHTML = '스트림 데이터를 가져올 수 없습니다. URL을 확인하세요.';
            }
            console.log('All Streams Loaded:', streams);
        });
    }

    // 버튼 클릭 이벤트
    button.addEventListener('click', () => {
        if (list.style.display === 'none') {
            updateStreamList();
        } else {
            list.style.display = 'none';
        }
    });

    // 캐시 강제 갱신 (최초 실행 시)
    localStorage.removeItem('liveStatusCache');
})();
