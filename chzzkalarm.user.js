// ==UserScript==
// @name         lolcast chzzk alarm
// @namespace    http://tampermonkey.net/
// @version      1.22
// @description  네이버 치지직 팔로우 방송알림 (페이지 접속 없이 백그라운드 동작, lolcast 링크 사용)
// @match        https://*.naver.com/*
// @match        https://lc2122.github.io/lolcast/*
// @match        https://lolcast.kr/*
// @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/chzzkalarm.user.js
// @updateURL    https://raw.githubusercontent.com/lc2122/list/main/chzzkalarm.user.js
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
    const allChannelsKey = 'chzzk_all_channels_cache'; // 캐시 키
    const heartbeatInterval = 60 * 1000; // 60초마다 체크
    const cacheTTL = 24 * 60 * 60 * 1000; // 캐시 유효 시간 (24시간)

    // 전역 변수 초기화
    let settingBrowserNoti = GM_getValue('setBrowserNoti', true);
    let settingReferNoti = GM_getValue('setReferNoti', false);
    let currentFollowingStatus = GM_getValue(statusKey, {});
    let cachedAllChannels = null;

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

    // API 호출 함수 (재시도 로직 추가)
    function fetchApi(url, retries = 2, delay = 1000) {
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
                    if (retries > 0) {
                        console.log(`Retrying API call (${retries} left)...`);
                        setTimeout(() => fetchApi(url, retries - 1, delay * 2).then(resolve, reject), delay);
                    } else {
                        console.error('CHIZZK.follow-notification - fetchApi error :: ', error);
                        reject(error);
                    }
                }
            });
        });
    }

    // 모든 팔로우 채널 가져오기 (캐시 활용)
    async function fetchAllFollowing(forceRefresh = false) {
        const cachedData = GM_getValue(allChannelsKey);
        if (!forceRefresh && cachedData && Date.now() - cachedData.timestamp < cacheTTL) {
            console.log('CHIZZK.follow-notification :: Using cached all channels');
            return cachedData.channels;
        }

        try {
            const apiUrl = 'https://api.chzzk.naver.com/service/v1/channels/followings';
            const data = await fetchApi(apiUrl);
            const allChannelIds = [];
            const followList = data.content?.data || data.content?.followingList || [];

            if (!followList.length) {
                console.warn('CHIZZK.follow-notification - fetchAllFollowing :: No channels found in response');
                return [];
            }

            console.log('CHIZZK.follow-notification - fetchAllFollowing :: Found all channels', followList.length);

            followList.forEach(channel => {
                const detailData = {
                    channelId: channel.channel?.channelId || channel.channelId,
                    channelName: channel.channel?.channelName || 'Unknown',
                    channelImageUrl: channel.channel?.channelImageUrl || null,
                    openLive: false
                };
                allChannelIds.push(detailData);
            });

            GM_setValue(allChannelsKey, { channels: allChannelIds, timestamp: Date.now() });
            return allChannelIds;
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchAllFollowing :: ', e);
            return [];
        }
    }

    // 방송 중인 팔로우 채널 가져오기 (시청자 수 포함)
    async function fetchLiveFollowing() {
        try {
            const apiUrl = 'https://api.chzzk.naver.com/service/v1/channels/followings/live';
            const data = await fetchApi(apiUrl);
            const liveChannelIds = [];

            if (!data.content || !data.content.followingList) {
                console.error('CHIZZK.follow-notification - fetchLiveFollowing :: Invalid API response', data);
                return [];
            }

            console.log('CHIZZK.follow-notification - fetchLiveFollowing :: Found live channels', data.content.followingList.length);

            data.content.followingList.forEach(channel => {
                const notificationSetting = channel.channel.personalData?.following?.notification;
                const detailData = {
                    channelId: channel.channelId,
                    channelName: channel.channel.channelName,
                    channelImageUrl: channel.channel.channelImageUrl,
                    openLive: channel.streamer.openLive,
                    liveTitle: channel.liveInfo.liveTitle,
                    viewerCount: channel.liveInfo?.concurrentUserCount || 0
                };

                if (settingReferNoti) {
                    if (notificationSetting === true) liveChannelIds.push(detailData);
                } else {
                    liveChannelIds.push(detailData);
                }
            });

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
            const channelId = data.channelId;
            const channelLink = `https://lolcast.kr/#/player/chzzk/${channelId}`;

            if (settingBrowserNoti) {
                GM_notification({
                    title: channelName,
                    image: channelImageUrl,
                    text: liveTitle,
                    timeout: 15000,
                    onclick: () => window.open(channelLink, '_self')
                });
            }
        } catch (e) {
            console.error('CHIZZK.follow-notification - onairNotificationPopup error :: ', e);
        }
    }

    // 방송 상태 체크 (최적화)
    async function fetchLiveStatus() {
        try {
            console.log('CHIZZK.follow-notification :: Checking live status...');
            const [liveChannels] = await Promise.all([
                fetchLiveFollowing(),
                cachedAllChannels ? Promise.resolve(cachedAllChannels) : fetchAllFollowing() // 캐시 있으면 재사용
            ]);
            const allChannels = cachedAllChannels || await fetchAllFollowing();
            cachedAllChannels = allChannels;

            console.log('CHIZZK.follow-notification :: All channels:', allChannels);
            console.log('CHIZZK.follow-notification :: Live channels:', liveChannels);

            const updatedStatus = {};
            allChannels.forEach(channel => {
                const prevOpenLive = currentFollowingStatus[channel.channelId]?.openLive || false;
                const wasNotified = currentFollowingStatus[channel.channelId]?.notified || false;
                updatedStatus[channel.channelId] = {
                    openLive: false,
                    notified: prevOpenLive ? wasNotified : false,
                    channelName: channel.channelName,
                    channelImageUrl: channel.channelImageUrl
                };
            });

            liveChannels.forEach(channel => {
                const prevOpenLive = currentFollowingStatus[channel.channelId]?.openLive || false;
                const wasNotified = currentFollowingStatus[channel.channelId]?.notified || false;
                if (prevOpenLive === false && channel.openLive) {
                    onairNotificationPopup(channel);
                    updatedStatus[channel.channelId] = { openLive: true, notified: true, channelName: channel.channelName, channelImageUrl: channel.channelImageUrl };
                } else {
                    updatedStatus[channel.channelId] = { openLive: true, notified: wasNotified, channelName: channel.channelName, channelImageUrl: channel.channelImageUrl };
                }
            });

            currentFollowingStatus = updatedStatus;
            GM_setValue(statusKey, currentFollowingStatus);
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchLiveStatus error :: ', e);
        }
    }

    // 설정 UI 생성 (시청자 수 표시 포함)
    async function createSettingsUI() {
        if (document.readyState !== 'complete') await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));

        const existingUI = document.getElementById('settingUI');
        if (existingUI) existingUI.remove();

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
            const allChannels = await fetchAllFollowing(true); // UI 새로고침 시 강제 업데이트
            const liveChannels = await fetchLiveFollowing();

            const liveChannelIds = new Set(liveChannels.map(ch => ch.channelId));
            followListSection.innerHTML = '<h3>팔로우 리스트</h3>';
            if (allChannels.length === 0) {
                followListSection.innerHTML += '<p>팔로우한 채널이 없습니다. 로그인 상태를 확인하세요.</p>';
            } else {
                allChannels.sort((a, b) => liveChannelIds.has(b.channelId) - liveChannelIds.has(a.channelId));
                allChannels.forEach(channel => {
                    const isLive = liveChannelIds.has(channel.channelId);
                    const liveChannel = liveChannels.find(ch => ch.channelId === channel.channelId);
                    const viewerCount = isLive ? (liveChannel?.viewerCount || '알 수 없음') : 'N/A';
                    const item = document.createElement('div');
                    item.className = `followItem ${isLive ? 'live' : ''}`;
                    item.innerHTML = `
                        <a href="https://lolcast.kr/#/player/chzzk/${channel.channelId}" target="_self">${channel.channelName}</a> - 
                        ${isLive ? '방송 중' : '방송 종료'} 
                        ${isLive ? `(시청자: ${viewerCount})` : ''}
                    `;
                    followListSection.appendChild(item);
                });
            }
        } catch (e) {
            console.error('CHIZZK.follow-notification :: Error loading follow list:', e);
            followListSection.innerHTML = '<p>팔로우 리스트를 불러오는 데 실패했습니다.</p>';
        }

        const saveButton = settingsContainer.querySelector('#saveSettings');
        saveButton.addEventListener('click', () => {
            settingBrowserNoti = document.getElementById('followsetting_browser_noti').checked;
            settingReferNoti = document.getElementById('followsetting_refer_noti').checked;
            GM_setValue('setBrowserNoti', settingBrowserNoti);
            GM_setValue('setReferNoti', settingReferNoti);
            settingsContainer.remove();
        });
    }

    // 주기적 실행
    async function startBackgroundCheck() {
        cachedAllChannels = await fetchAllFollowing(); // 최초 캐시 초기화
        await fetchLiveStatus();
        setInterval(fetchLiveStatus, heartbeatInterval);
    }

    // 메뉴 등록
    console.log('CHIZZK.follow-notification :: Attempting to register menu command');
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('설정 및 팔로우 리스트', createSettingsUI);
    }

    // 실행 중 여부 확인 (중복 방지)
    if (GM_getValue(runningKey, false)) {
        console.log('CHIZZK.follow-notification :: Already running in another instance, exiting');
        return;
    }
    GM_setValue(runningKey, true);

    // 초기화 및 실행
    console.log('CHIZZK.follow-notification (Background) :: Starting...');
    if (!GM_getValue('isInstalled', false)) {
        await createSettingsUI();
        GM_setValue('isInstalled', true);
    }
    await startBackgroundCheck();

    // 스크립트 종료 시 플래그 해제
    window.addEventListener('unload', () => GM_setValue(runningKey, false));
    window.addEventListener('beforeunload', () => GM_setValue(runningKey, false));
})();
