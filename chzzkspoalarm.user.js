// ==UserScript==
// @name         lolcast chzzkspo alarm
// @namespace    lolcast chzzkspo alarm
// @version      0.1
// @description  네이버 치지직 및 M3U8 채널 팔로우 방송알림 (페이지 접속 없이 백그라운드 동작, lolcast 링크 사용)
// @match        https://*.naver.com/* 
// @match        https://lc2122.github.io/lolcast/*
// @match        https://lolcast.kr/*
// @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/chzzkspoalarm.user.js
// @updateURL    https://raw.githubusercontent.com/lc2122/list/main/chzzkspoalarm.user.js
// @grant        GM_addStyle
// @grant        GM_notification
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_xmlhttpRequest
// @run-at       document-start
// ==/UserScript==

(async function() {
    'use strict';

    // 상태 저장 키
    const statusKey = 'chzzk_follow_notification_status';
    const runningKey = 'chzzk_follow_notification_running';
    const heartbeatInterval = 60 * 1000; // 60초마다 체크

    // 메뉴 등록
    console.log('CHIZZK.follow-notification :: Attempting to register menu command');
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('설정 및 팔로우 리스트', async () => {
            console.log('CHIZZK.follow-notification :: Menu clicked, opening settings UI');
            await createSettingsUI();
        });
        console.log('CHIZZK.follow-notification :: Menu command registered successfully');
    } else {
        console.error('CHIZZK.follow-notification :: GM_registerMenuCommand is not available');
    }

    // 실행 중 여부 확인
    if (GM_getValue(runningKey, false)) {
        console.log('CHIZZK.follow-notification :: Already running in another instance, exiting');
        return;
    }
    GM_setValue(runningKey, true);

    // 설정값 초기화
    let settingBrowserNoti = GM_getValue('setBrowserNoti', true);
    let settingReferNoti = GM_getValue('setReferNoti', false);
    let currentFollowingStatus = GM_getValue(statusKey, {});

    // 스타일 추가
    GM_addStyle(`
        #settingUI {
            position: fixed;
            top: 10px;
            left: 10px;
            background-color: white;
            padding: 20px;
            border: 1px solid #ddd;
            z-index: 99999;
            color: black;
            pointer-events: auto;
        }
        #followListSection {
            margin-top: 20px;
            max-height: 300px;
            overflow-y: auto;
            border-top: 1px solid #ddd;
            padding-top: 10px;
        }
        .followItem {
            padding: 5px;
            border-bottom: 1px solid #eee;
        }
        .followItem.live {
            background-color: #e0ffe0;
        }
        .followItem a {
            text-decoration: none;
            color: #007bff;
        }
        .followItem a:hover {
            text-decoration: underline;
        }
    `);

    // API 호출 함수
    function fetchApi(url) {
        return new Promise((resolve, reject) => {
            console.log('CHIZZK.follow-notification :: Fetching API from', url);
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                withCredentials: true,
                onload: function(response) {
                    try {
                        const data = JSON.parse(response.responseText);
                        console.log('CHIZZK.follow-notification - fetchApi response :: ', data);
                        resolve(data);
                    } catch (e) {
                        console.error('CHIZZK.follow-notification :: Failed to parse API response', e);
                        reject(e);
                    }
                },
                onerror: function(error) {
                    console.error('CHIZZK.follow-notification - fetchApi error :: ', error);
                    reject(error);
                }
            });
        });
    }

    // M3U8 라이브 상태 체크 함수
    function checkM3U8LiveStatus(videoNumber) {
        return new Promise((resolve) => {
            const m3u8Url = `https://ch${videoNumber}-nlivecdn.spotvnow.co.kr/ch${videoNumber}/decr/medialist_14173921312004482655_hls.m3u8`;
            console.log(`CHIZZK.follow-notification :: Checking M3U8 live status for channel ${videoNumber}`);
            GM_xmlhttpRequest({
                method: 'HEAD',
                url: m3u8Url,
                onload: function(response) {
                    resolve(response.status === 200);
                },
                onerror: function() {
                    resolve(false);
                }
            });
        });
    }

    // 모든 팔로우 채널 가져오기
    async function fetchAllFollowing() {
        try {
            const apiUrl = 'https://api.chzzk.naver.com/service/v1/channels/followings';
            const data = await fetchApi(apiUrl);
            const allChannelIds = [];
            const followList = data.content?.data || data.content?.followingList || [];
            console.log('CHIZZK.follow-notification - fetchAllFollowing :: Raw follow list:', followList);

            if (!followList.length) {
                console.warn('CHIZZK.follow-notification - fetchAllFollowing :: No channels found in response');
            }

            followList.forEach(channel => {
                allChannelIds.push({
                    channelId: channel.channel?.channelId || channel.channelId,
                    channelName: channel.channel?.channelName || 'Unknown',
                    channelImageUrl: channel.channel?.channelImageUrl || null,
                    openLive: false,
                    platform: 'chzzk'
                });
            });

            // M3U8 채널 추가 (1~40)
            for (let i = 1; i <= 40; i++) {
                allChannelIds.push({
                    channelId: `m3u8_${i}`,
                    channelName: `M3U8 Channel ${i}`,
                    channelImageUrl: null,
                    openLive: false,
                    platform: 'm3u8',
                    m3u8Url: `https://ch${i}-nlivecdn.spotvnow.co.kr/ch${i}/decr/medialist_14173921312004482655_hls.m3u8`
                });
            }

            return allChannelIds;
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchAllFollowing :: ', e);
            return [];
        }
    }

    // 방송 중인 채널 가져오기
    async function fetchLiveFollowing() {
        try {
            const apiUrl = 'https://api.chzzk.naver.com/service/v1/channels/followings/live';
            const data = await fetchApi(apiUrl);
            const liveChannelIds = [];

            if (!data.content || !data.content.followingList) {
                console.error('CHIZZK.follow-notification - fetchLiveFollowing :: Invalid API response', data);
            } else {
                data.content.followingList.forEach(channel => {
                    const notificationSetting = channel.channel.personalData?.following?.notification;
                    const detailData = {
                        channelId: channel.channelId,
                        channelName: channel.channel.channelName,
                        channelImageUrl: channel.channel.channelImageUrl,
                        openLive: channel.streamer.openLive,
                        liveTitle: channel.liveInfo.liveTitle,
                        platform: 'chzzk'
                    };
                    if (settingReferNoti) {
                        if (notificationSetting === true) {
                            liveChannelIds.push(detailData);
                        }
                    } else {
                        liveChannelIds.push(detailData);
                    }
                });
            }

            // M3U8 라이브 체크
            for (let i = 1; i <= 40; i++) {
                const isLive = await checkM3U8LiveStatus(i);
                if (isLive) {
                    liveChannelIds.push({
                        channelId: `m3u8_${i}`,
                        channelName: `M3U8 Channel ${i}`,
                        channelImageUrl: null,
                        openLive: true,
                        liveTitle: `M3U8 Live Channel ${i}`,
                        platform: 'm3u8',
                        m3u8Url: `https://ch${i}-nlivecdn.spotvnow.co.kr/ch${i}/decr/medialist_14173921312004482655_hls.m3u8`
                    });
                }
            }

            return liveChannelIds;
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchLiveFollowing :: ', e);
            return [];
        }
    }

    // 방송 시작 알림
    function onairNotificationPopup(data) {
        try {
            if (!data) return;

            const liveTitle = data.liveTitle ? data.liveTitle.substring(0, 28).concat('..') : '방송 중';
            const channelImageUrl = data.channelImageUrl || 'https://ssl.pstatic.net/cmstatic/nng/img/img_anonymous_square_gray_opacity2x.png?type=f120_120_na';
            const channelName = data.channelName;
            const channelLink = data.platform === 'm3u8' 
                ? data.m3u8Url 
                : `https://lolcast.kr/#/player/chzzk/${data.channelId}`;

            if (settingBrowserNoti) {
                GM_notification({
                    title: channelName,
                    image: channelImageUrl,
                    text: liveTitle,
                    timeout: 15000,
                    onclick: () => {
                        console.log('CHIZZK.follow-notification :: Notification clicked, opening', channelLink);
                        window.open(channelLink, '_blank');
                    }
                });
            }
        } catch (e) {
            console.error('CHIZZK.follow-notification - onairNotificationPopup error :: ', e);
        }
    }

    // 방송 상태 체크
    async function fetchLiveStatus() {
        try {
            console.log('CHIZZK.follow-notification :: Checking live status...');
            const allChannels = await fetchAllFollowing();
            const liveChannels = await fetchLiveFollowing();

            const updatedStatus = {};
            allChannels.forEach(channel => {
                const prevOpenLive = currentFollowingStatus[channel.channelId]?.openLive || false;
                const wasNotified = currentFollowingStatus[channel.channelId]?.notified || false;
                updatedStatus[channel.channelId] = {
                    openLive: false,
                    notified: prevOpenLive ? wasNotified : false,
                    channelName: channel.channelName,
                    channelImageUrl: channel.channelImageUrl,
                    platform: channel.platform
                };
                if (channel.platform === 'm3u8') {
                    updatedStatus[channel.channelId].m3u8Url = channel.m3u8Url;
                }
            });

            liveChannels.forEach(channel => {
                const prevOpenLive = currentFollowingStatus[channel.channelId]?.openLive || false;
                const wasNotified = currentFollowingStatus[channel.channelId]?.notified || false;
                if (prevOpenLive === false && channel.openLive) {
                    onairNotificationPopup(channel);
                    updatedStatus[channel.channelId] = {
                        openLive: true,
                        notified: true,
                        channelName: channel.channelName,
                        channelImageUrl: channel.channelImageUrl,
                        platform: channel.platform
                    };
                    if (channel.platform === 'm3u8') {
                        updatedStatus[channel.channelId].m3u8Url = channel.m3u8Url;
                    }
                } else {
                    updatedStatus[channel.channelId] = {
                        openLive: true,
                        notified: wasNotified,
                        channelName: channel.channelName,
                        channelImageUrl: channel.channelImageUrl,
                        platform: channel.platform
                    };
                    if (channel.platform === 'm3u8') {
                        updatedStatus[channel.channelId].m3u8Url = channel.m3u8Url;
                    }
                }
            });

            currentFollowingStatus = updatedStatus;
            GM_setValue(statusKey, currentFollowingStatus);
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchLiveStatus error :: ', e);
        }
    }

    // 설정 UI
    async function createSettingsUI() {
        if (document.readyState !== 'complete') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        const existingUI = document.getElementById('settingUI');
        if (existingUI) {
            existingUI.remove();
        }

        const settingsContainer = document.createElement('div');
        settingsContainer.id = 'settingUI';
        settingsContainer.innerHTML = `
            <div>
                <input type="checkbox" id="followsetting_browser_noti" ${settingBrowserNoti ? 'checked' : ''}>
                <label for="followsetting_browser_noti">브라우저 알림기능 사용</label>
            </div>
            <div>
                <input type="checkbox" id="followsetting_refer_noti" ${settingReferNoti ? 'checked' : ''}>
                <label for="followsetting_refer_noti">치지직 자체 알림설정을 켠 채널만 알림받기</label>
            </div>
            <button id="saveSettings" style="margin-top: 10px;">저장</button>
            <div id="followListSection">
                <h3>팔로우 리스트</h3>
                <p>로딩 중...</p>
            </div>
        `;
        document.body.appendChild(settingsContainer);

        const followListSection = settingsContainer.querySelector('#followListSection');
        try {
            const allChannels = await fetchAllFollowing();
            const liveChannels = await fetchLiveFollowing();
            const liveChannelIds = new Set(liveChannels.map(ch => ch.channelId));

            followListSection.innerHTML = '<h3>팔로우 리스트</h3>';
            if (allChannels.length === 0) {
                followListSection.innerHTML += '<p>팔로우한 채널이 없습니다. 로그인 상태를 확인하세요.</p>';
            } else {
                // 치지직과 M3U8 채널 분리
                const chzzkChannels = allChannels.filter(ch => ch.platform === 'chzzk');
                const m3u8LiveChannels = liveChannels.filter(ch => ch.platform === 'm3u8');

                // 치지직 채널 정렬 (라이브 우선)
                chzzkChannels.sort((a, b) => liveChannelIds.has(b.channelId) - liveChannelIds.has(a.channelId));

                // M3U8는 라이브 채널만 표시
                const sortedChannels = [...m3u8LiveChannels, ...chzzkChannels];

                sortedChannels.forEach(channel => {
                    const isLive = liveChannelIds.has(channel.channelId);
                    const linkUrl = channel.platform === 'm3u8' 
                        ? channel.m3u8Url 
                        : `https://lolcast.kr/#/player/chzzk/${channel.channelId}`;
                    const target = channel.platform === 'm3u8' ? '_blank' : '_self';
                    if (channel.platform === 'm3u8' || isLive || !channel.platform) { // M3U8는 라이브만, 치지직은 모두 표시
                        const item = document.createElement('div');
                        item.className = `followItem ${isLive ? 'live' : ''}`;
                        item.innerHTML = `<a href="${linkUrl}" target="${target}">${channel.channelName}</a> - ${isLive ? '방송 중' : '방송 종료'}`;
                        followListSection.appendChild(item);
                    }
                });
            }
        } catch (e) {
            console.error('CHIZZK.follow-notification :: Error loading follow list:', e);
            followListSection.innerHTML = '<p>팔로우 리스트를 불러오는 데 실패했습니다.</p>';
        }

        settingsContainer.querySelector('#saveSettings').addEventListener('click', () => {
            settingBrowserNoti = document.getElementById('followsetting_browser_noti').checked;
            settingReferNoti = document.getElementById('followsetting_refer_noti').checked;
            GM_setValue('setBrowserNoti', settingBrowserNoti);
            GM_setValue('setReferNoti', settingReferNoti);
            settingsContainer.remove();
        });
    }

    // 주기적 실행
    async function startBackgroundCheck() {
        await fetchLiveStatus();
        setInterval(fetchLiveStatus, heartbeatInterval);
    }

    // 초기화 및 실행
    console.log('CHIZZK.follow-notification (Background) :: Starting...');
    if (!GM_getValue('isInstalled', false)) {
        await createSettingsUI();
        GM_setValue('isInstalled', true);
    }
    await startBackgroundCheck();

    // 종료 시 플래그 해제
    window.addEventListener('unload', () => GM_setValue(runningKey, false));
    window.addEventListener('beforeunload', () => GM_setValue(runningKey, false));
})();
