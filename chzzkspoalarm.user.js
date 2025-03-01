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
    GM_registerMenuCommand('설정 및 팔로우 리스트', async () => {
        console.log('CHIZZK.follow-notification :: Menu clicked, opening settings UI');
        await createSettingsUI();
    });
    console.log('CHIZZK.follow-notification :: Menu command registered successfully');

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
    `);

    // 설정 UI 생성 함수
    async function createSettingsUI() {
        // DOM이 로드될 때까지 대기
        if (document.readyState !== 'complete') {
            await new Promise(resolve => document.addEventListener('DOMContentLoaded', resolve));
        }

        // 기존 UI 제거
        const existingUI = document.getElementById('settingUI');
        if (existingUI) existingUI.remove();

        // UI 생성
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

        // 저장 버튼 이벤트 등록
        const saveButton = settingsContainer.querySelector('#saveSettings');
        saveButton.addEventListener('click', () => {
            settingBrowserNoti = document.getElementById('followsetting_browser_noti').checked;
            settingReferNoti = document.getElementById('followsetting_refer_noti').checked;
            GM_setValue('setBrowserNoti', settingBrowserNoti);
            GM_setValue('setReferNoti', settingReferNoti);
            console.log('CHIZZK.follow-notification :: Settings saved');
            settingsContainer.remove();
        });

        // 팔로우 리스트 로드 (간략화된 예시)
        const followListSection = settingsContainer.querySelector('#followListSection');
        followListSection.innerHTML = '<h3>팔로우 리스트</h3><p>여기에 팔로우 리스트가 표시됩니다.</p>';
    }

    // 초기 실행 시 설정 UI 표시
    if (!GM_getValue('isInstalled', false)) {
        await createSettingsUI();
        GM_setValue('isInstalled', true);
    }

    // 백그라운드 체크 (간략화)
    async function startBackgroundCheck() {
        console.log('CHIZZK.follow-notification :: Background check started');
        setInterval(() => console.log('CHIZZK.follow-notification :: Checking...'), heartbeatInterval);
    }
    await startBackgroundCheck();

    // 종료 시 플래그 해제
    window.addEventListener('unload', () => GM_setValue(runningKey, false));
})();
