// ==UserScript==
// @name         lolcast chzzk alarm
// @namespace    http://tampermonkey.net/
// @version      1.20
// @description  네이버 치지직 팔로우 방송알림 (페이지 접속 없이 백그라운드 동작, lolcast 링크 사용)
// @match        https://*.naver.com/*
// @downloadURL  https://raw.githubusercontent.com/lc2122/list/main/chzzkalarm2.user.js
// @updateURL    https://raw.githubusercontent.com/lc2122/list/main/chzzkalarm2.user.js
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

    // 기존 코드 생략 (변경 없는 부분)

    // 스타일 추가 (더 강력한 스타일 적용)
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

    // 설정 UI (수정된 부분)
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
            const allChannels = await fetchAllFollowing();
            const liveChannels = await fetchLiveFollowing();
            console.log('CHIZZK.follow-notification :: Follow list loaded for UI - All channels:', allChannels);
            console.log('CHIZZK.follow-notification :: Follow list loaded for UI - Live channels:', liveChannels);

            const liveChannelIds = new Set(liveChannels.map(ch => ch.channelId));
            followListSection.innerHTML = '<h3>팔로우 리스트</h3>';
            if (allChannels.length === 0) {
                followListSection.innerHTML += '<p>팔로우한 채널이 없습니다. 로그인 상태를 확인하세요.</p>';
            } else {
                allChannels.sort((a, b) => {
                    const aIsLive = liveChannelIds.has(a.channelId);
                    const bIsLive = liveChannelIds.has(b.channelId);
                    return bIsLive - aIsLive;
                });

                allChannels.forEach(channel => {
                    const isLive = liveChannelIds.has(channel.channelId);
                    const item = document.createElement('div');
                    item.className = `followItem ${isLive ? 'live' : ''}`;
                    item.innerHTML = `<a href="https://lolcast.kr/#/player/chzzk/${channel.channelId}" target="_self">${channel.channelName}</a> - ${isLive ? '방송 중' : '방송 종료'}`;
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
