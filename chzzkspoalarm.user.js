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

// 설정값을 전역적으로 선언
let settingBrowserNoti = GM_getValue('setBrowserNoti', true);
let settingReferNoti = GM_getValue('setReferNoti', false);

(async function() {
    'use strict';

    // 상태 저장 키
    const statusKey = 'chzzk_follow_notification_status';
    const runningKey = 'chzzk_follow_notification_running';
    const heartbeatInterval = 60 * 1000; // 60초마다 체크

    // 메뉴 등록 (항상 실행)
    console.log('CHIZZK.follow-notification :: Attempting to register menu command');
    if (typeof GM_registerMenuCommand === 'function') {
        GM_registerMenuCommand('설정 및 팔로우 리스트', () => {
            console.log('CHIZZK.follow-notification :: Menu clicked, opening settings UI');
            createSettingsUI();
        });
        console.log('CHIZZK.follow-notification :: Menu command registered successfully');
    } else {
        console.error('CHIZZK.follow-notification :: GM_registerMenuCommand is not available');
    }

    // 실행 중 여부 확인 (중복 방지 개선)
    if (GM_getValue(runningKey, false)) {
        console.log('CHIZZK.follow-notification :: Already running in another instance, exiting');
        return;
    }
    GM_setValue(runningKey, true);

    // 상태 초기화
    let currentFollowingStatus = GM_getValue(statusKey, {});
    
    // M3U8 채널 기본 정보
    const m3u8BaseUrl = 'https://ch${videoNumber}-nlivecdn.spotvnow.co.kr/ch${videoNumber}/decr/medialist_14173921312004482655_hls.m3u8';
    const m3u8ChannelRange = Array.from({ length: 40 }, (_, i) => i + 1); // 1부터 40까지 채널 번호

    // 스타일 추가 (Whale 호환성 강화)
    GM_addStyle(`
        #settingUI {
            position: fixed !important;
            top: 10px !important;
            left: 10px !important;
            background-color: white !important;
            padding: 20px !important;
            border: 2px solid #333 !important;
            z-index: 2147483647 !important; /* 최대 z-index */
            color: black !important;
            pointer-events: auto !important;
            display: block !important;
            box-shadow: 0 0 10px rgba(0,0,0,0.5) !important; /* 시각적 확인용 */
            opacity: 1 !important;
            visibility: visible !important;
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

    // API 호출 함수 (GM_xmlhttpRequest 사용)
    function fetchApi(url, isHead = false) {
        return new Promise((resolve, reject) => {
            console.log('CHIZZK.follow-notification :: Fetching URL from', url, 'isHead:', isHead);
            GM_xmlhttpRequest({
                method: isHead ? 'HEAD' : 'GET',
                url: url,
                headers: {
                    'Accept': 'application/json, text/html',
                    'Content-Type': 'application/json'
                },
                withCredentials: true,
                onload: function(response) {
                    try {
                        if (isHead) {
                            console.log('CHIZZK.follow-notification :: HEAD response status:', response.status);
                            resolve(response.status === 200);
                        } else {
                            console.log('CHIZZK.follow-notification :: Raw response:', response.responseText.substring(0, 500));
                            const data = JSON.parse(response.responseText);
                            console.log('CHIZZK.follow-notification - fetchApi response :: ', data);
                            resolve(data);
                        }
                    } catch (e) {
                        console.error('CHIZZK.follow-notification :: Failed to parse response', e);
                        reject(e);
                    }
                },
                onerror: function(error) {
                    console.error('CHIZZK.follow-notification - fetchApi error :: ', error);
                    resolve(false); // M3U8 체크에서 오류 시 비활성화로 처리
                }
            });
        });
    }

    // 모든 치지직 팔로우 채널 가져오기
    async function fetchAllFollowing() {
        try {
            const apiUrl = 'https://api.chzzk.naver.com/service/v1/channels/followings';
            const data = await fetchApi(apiUrl);
            const allChannelIds = [];

            const followList = data.content?.data || data.content?.followingList || [];
            console.log('CHIZZK.follow-notification - fetchAllFollowing :: Raw follow list:', followList);

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
                    openLive: false,
                    platform: 'chzzk'
                };
                allChannelIds.push(detailData);
            });

            return allChannelIds;
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchAllFollowing :: ', e);
            return [];
        }
    }

    // 치지직 방송 중인 팔로우 채널 가져오기
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

            return liveChannelIds;
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchLiveFollowing :: ', e);
            return [];
        }
    }

    // M3U8 채널 상태 체크 (1~40)
    async function fetchM3U8LiveStatus() {
        const liveChannelIds = [];
        for (let videoNumber = 1; videoNumber <= 40; videoNumber++) {
            const m3u8Url = `https://ch${videoNumber}-nlivecdn.spotvnow.co.kr/ch${videoNumber}/decr/medialist_14173921312004482655_hls.m3u8`;
            try {
                const isLive = await fetchApi(m3u8Url, true); // HEAD 요청으로 상태 확인
                console.log('CHIZZK.follow-notification - fetchM3U8LiveStatus :: Channel ch', videoNumber, 'isLive:', isLive);

                if (isLive) {
                    liveChannelIds.push({
                        channelId: `ch${videoNumber}`,
                        channelName: `SPOTV Channel ${videoNumber}`,
                        channelImageUrl: null,
                        openLive: true,
                        liveTitle: `SPOTV Live Channel ${videoNumber}`,
                        platform: 'm3u8',
                        m3u8Url: m3u8Url
                    });
                }
            } catch (e) {
                console.error('CHIZZK.follow-notification - fetchM3U8LiveStatus :: Error checking ch', videoNumber, e);
            }
        }
        return liveChannelIds;
    }

    // 방송 시작 알림
    function onairNotificationPopup(data) {
        try {
            if (!data) return;

            console.log('CHIZZK.follow-notification - onairNotificationPopup data :: ', data);

            const liveTitle = data.liveTitle ? data.liveTitle.substring(0, 28).concat('..') : '방송 중';
            const channelImageUrl = data.channelImageUrl || 'https://ssl.pstatic.net/cmstatic/nng/img/img_anonymous_square_gray_opacity2x.png?type=f120_120_na';
            const channelName = data.channelName;
            const channelId = data.channelId;
            const channelLink = data.platform === 'm3u8' 
                ? data.m3u8Url 
                : `https://lolcast.kr/#/player/chzzk/${channelId}`;

            if (settingBrowserNoti) {
                console.log('CHIZZK.follow-notification :: Triggering notification for', channelName);
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
                console.log('CHIZZK.follow-notification :: Notification triggered successfully for', channelName);
            } else {
                console.log('CHIZZK.follow-notification :: Browser notification disabled');
            }
        } catch (e) {
            console.error('CHIZZK.follow-notification - onairNotificationPopup error :: ', e);
        }
    }

    // 방송 상태 체크 (치지직 + M3U8)
    async function fetchLiveStatus() {
        try {
            console.log('CHIZZK.follow-notification :: Checking live status...');
            const allChzzkChannels = await fetchAllFollowing();
            const liveChzzkChannels = await fetchLiveFollowing();
            const liveM3U8Channels = await fetchM3U8LiveStatus();

            console.log('CHIZZK.follow-notification :: All Chzzk channels:', allChzzkChannels);
            console.log('CHIZZK.follow-notification :: Live Chzzk channels:', liveChzzkChannels);
            console.log('CHIZZK.follow-notification :: Live M3U8 channels:', liveM3U8Channels);

            const updatedStatus = {};
            allChzzkChannels.forEach(channel => {
                const prevOpenLive = currentFollowingStatus[channel.channelId]?.openLive || false;
                const wasNotified = currentFollowingStatus[channel.channelId]?.notified || false;
                updatedStatus[channel.channelId] = {
                    openLive: false,
                    notified: prevOpenLive ? wasNotified : false,
                    channelName: channel.channelName,
                    channelImageUrl: channel.channelImageUrl,
                    platform: 'chzzk'
                };
                console.log(`CHIZZK.follow-notification :: Initialized Chzzk Channel ${channel.channelId} - prevOpenLive: ${prevOpenLive}, openLive: false, notified: ${updatedStatus[channel.channelId].notified}`);
            });

            liveChzzkChannels.forEach(channel => {
                const prevOpenLive = currentFollowingStatus[channel.channelId]?.openLive || false;
                const wasNotified = currentFollowingStatus[channel.channelId]?.notified || false;
                console.log(`CHIZZK.follow-notification :: Updating Chzzk Channel ${channel.channelId} - prevOpenLive: ${prevOpenLive}, openLive: ${channel.openLive}, wasNotified: ${wasNotified}`);

                if (prevOpenLive === false && channel.openLive) {
                    console.log(`CHIZZK.follow-notification - 상태 변화 감지 (Chzzk): 채널ID ${channel.channelId}, openLive: ${prevOpenLive} ==> ${channel.openLive}`);
                    onairNotificationPopup(channel);
                    updatedStatus[channel.channelId] = { openLive: true, notified: true, channelName: channel.channelName, channelImageUrl: channel.channelImageUrl, platform: 'chzzk' };
                } else {
                    updatedStatus[channel.channelId] = { openLive: true, notified: wasNotified, channelName: channel.channelName, channelImageUrl: channel.channelImageUrl, platform: 'chzzk' };
                }
            });

            liveM3U8Channels.forEach(channel => {
                const prevOpenLive = currentFollowingStatus[channel.channelId]?.openLive || false;
                const wasNotified = currentFollowingStatus[channel.channelId]?.notified || false;
                console.log(`CHIZZK.follow-notification :: Updating M3U8 Channel ${channel.channelId} - prevOpenLive: ${prevOpenLive}, openLive: ${channel.openLive}, wasNotified: ${wasNotified}`);

                if (prevOpenLive === false && channel.openLive) {
                    console.log(`CHIZZK.follow-notification - 상태 변화 감지 (M3U8): 채널ID ${channel.channelId}, openLive: ${prevOpenLive} ==> ${channel.openLive}`);
                    onairNotificationPopup(channel);
                }
                updatedStatus[channel.channelId] = { 
                    openLive: true, 
                    notified: wasNotified || (prevOpenLive === false && channel.openLive), 
                    channelName: channel.channelName, 
                    channelImageUrl: channel.channelImageUrl, 
                    platform: 'm3u8', 
                    m3u8Url: channel.m3u8Url 
                };
            });

            currentFollowingStatus = updatedStatus;
            GM_setValue(statusKey, currentFollowingStatus);
        } catch (e) {
            console.error('CHIZZK.follow-notification - fetchLiveStatus error :: ', e);
        }
    }

    // 설정 UI (치지직 + M3U8 통합, Whale 호환성 강화)
    async function createSettingsUI() {
        console.log('CHIZZK.follow-notification :: createSettingsUI called');
        if (document.readyState !== 'complete') {
            console.log('CHIZZK.follow-notification :: Waiting for DOMContentLoaded');
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        const existingUI = document.getElementById('settingUI');
        if (existingUI) {
            console.log('CHIZZK.follow-notification :: Existing UI found, removing it');
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
        console.log('CHIZZK.follow-notification :: Settings container added to DOM');

        // 렌더링 강제 확인
        settingsContainer.style.display = 'block';
        console.log('CHIZZK.follow-notification :: Settings container visibility set to block');
        console.log('CHIZZK.follow-notification :: Container computed style:', window.getComputedStyle(settingsContainer).display);

        const followListSection = settingsContainer.querySelector('#followListSection');
        try {
            const allChzzkChannels = await fetchAllFollowing();
            const liveChzzkChannels = await fetchLiveFollowing();
            const liveM3U8Channels = await fetchM3U8LiveStatus();

            console.log('CHIZZK.follow-notification :: Follow list loaded for UI - All Chzzk channels:', allChzzkChannels);
            console.log('CHIZZK.follow-notification :: Follow list loaded for UI - Live Chzzk channels:', liveChzzkChannels);
            console.log('CHIZZK.follow-notification :: Follow list loaded for UI - Live M3U8 channels:', liveM3U8Channels);

            const liveChannelIds = new Set([...liveChzzkChannels.map(ch => ch.channelId), ...liveM3U8Channels.map(ch => ch.channelId)]);
            const allChannels = [
                ...allChzzkChannels,
                ...liveM3U8Channels // 라이브 중인 M3U8 채널만 리스트에 추가
            ];

            followListSection.innerHTML = '<h3>팔로우 리스트</h3>';
            if (allChannels.length === 0) {
                followListSection.innerHTML += '<p>팔로우한 채널이 없습니다. 로그인 상태를 확인하세요.</p>';
            } else {
                allChannels.sort((a, b) => {
                    const aIsLive = liveChannelIds.has(a.channelId);
                    const bIsLive = liveChannelIds.has(b.channelId);
                    return bIsLive - aIsLive; // 방송 중인 채널 맨 위로
                });

                allChannels.forEach(channel => {
                    const isLive = liveChannelIds.has(channel.channelId);
                    const item = document.createElement('div');
                    item.className = `followItem ${isLive ? 'live' : ''}`;
                    const linkUrl = channel.platform === 'm3u8' 
                        ? channel.m3u8Url 
                        : `https://lolcast.kr/#/player/chzzk/${channel.channelId}`;
                    item.innerHTML = `<a href="${linkUrl}" target="_blank">${channel.channelName} (${channel.platform === 'm3u8' ? 'M3U8' : 'Chzzk'})</a> - ${isLive ? '방송 중' : '방송 종료'}`;
                    followListSection.appendChild(item);
                });
            }
        } catch (e) {
            console.error('CHIZZK.follow-notification :: Error loading follow list:', e);
            followListSection.innerHTML = '<p>팔로우 리스트를 불러오는 데 실패했습니다.</p>';
        }

        const saveButton = settingsContainer.querySelector('#saveSettings');
        saveButton.addEventListener('click', saveSettingsHandler);

        function saveSettingsHandler() {
            settingBrowserNoti = document.getElementById('followsetting_browser_noti').checked;
            settingReferNoti = document.getElementById('followsetting_refer_noti').checked;
            GM_setValue('setBrowserNoti', settingBrowserNoti);
            GM_setValue('setReferNoti', settingReferNoti);
            console.log('CHIZZK.follow-notification - Settings saved:', { settingBrowserNoti, settingReferNoti });
            settingsContainer.remove();
        }
    }

    // 주기적 실행
    async function startBackgroundCheck() {
        await fetchLiveStatus();
        setInterval(fetchLiveStatus, heartbeatInterval);
    }

    // 초기화 및 실행
    console.log('CHIZZK.follow-notification (Background) :: Starting...');
    
    // 설치 후 즉시 설정 UI 호출 (최초 설치 시에만)
    if (!GM_getValue('isInstalled', false)) {
        console.log('CHIZZK.follow-notification :: First installation detected, opening settings UI');
        await createSettingsUI();
        GM_setValue('isInstalled', true); // 설치 플래그 설정
    }

    await startBackgroundCheck();

    // 스크립트 종료 시 실행 중 플래그 해제
    window.addEventListener('unload', () => {
        GM_setValue(runningKey, false);
        console.log('CHIZZK.follow-notification :: Running flag reset on unload');
    });

    window.addEventListener('beforeunload', () => {
        GM_setValue(runningKey, false);
        console.log('CHIZZK.follow-notification :: Running flag reset on beforeunload');
    });
})();
