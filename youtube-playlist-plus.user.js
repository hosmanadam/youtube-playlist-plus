// ==UserScript==
// @name         YouTube Playlist+
// @version      0.1.0
// @description  Extends YouTube's playlist interface with features it should've had already.
// @author       Adam Hosman
// @license      MIT
// @namespace    https://github.com/hosmanadam/
// @supportURL   https://github.com/hosmanadam/youtube-playlist-plus/issues
// @updateURL    https://raw.githubusercontent.com/hosmanadam/youtube-playlist-plus/master/youtube-playlist-plus.meta.js
// @downloadURL  https://raw.githubusercontent.com/hosmanadam/youtube-playlist-plus/master/youtube-playlist-plus.user.js
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';


    // OPTIONS ////////////////////////////////////////////////////////////////

    const CLICKS_PER_SECOND = 5; // Experiment with faster speeds if you want
    const KEEP_THE_LAST = 0; // Set this number to keep the last N videos


    // CONSTANTS //////////////////////////////////////////////////////////////

    const SCRIPT_NAME = 'YouTube Playlist+';
    const SCRIPT_NAME_SHORT = 'YP+';
    const SCRIPT_NAME_SAFE = 'YouTube Playlist Plus';
    const SCRIPT_NAME_SAFE_SHORT = 'ypp';

    const ID_REDIRECT_BUTTON = `${SCRIPT_NAME_SAFE_SHORT}` +
        `-redirect-button`;
    const ID_BATCH_REMOVE_BUTTON = `${SCRIPT_NAME_SAFE_SHORT}` +
        `-batch-remove-button`;

    const QUERY_PARAM_OLD_PAGE = 'disable_polymer=true';

    const NAME_BATCH_REMOVE_BUTTON = 'Batch remove videos';
    const NAME_REDIRECT_BUTTON = 'Go to old layout';

    const TOOLTIP_REMOVE_BUTTON =
        `Clicks all 'Remove' buttons for you when you're too lazy or just ` +
        `have too many of them.\n` +
        `- Added by ${SCRIPT_NAME}`
    ;
    const TOOLTIP_REDIRECT_BUTTON =
        `Takes you to an older version of this page that has more ` +
        `controls, including our '${NAME_BATCH_REMOVE_BUTTON}' button for ` +
        `cleaning up enormous playlists.\n` +
        `- Added by ${SCRIPT_NAME}`
    ;

    const STYLE_NEW_PLAYLIST_PAGE_TEXT = `
        color: #606060;
        font-size: 1.4rem;
        font-weight: 400;
        lint-height: 2.1rem;
        cursor: default;  /* Avoid glitch on mouse enter */
    `;
    const CLASS_OLD_PLAYLIST_PAGE_BUTTON = `
        yt-uix-button
        yt-uix-button-default
        yt-uix-button-size-default
    `;


    // LOAD MORE //////////////////////////////////////////////////////////////

    const selectLoadMoreButton = () => {
        return document.querySelector(
            "#pl-video-list > " +
            "button.load-more-button.browse-items-load-more-button"
        );
    }

    const allVideosLoaded = () => {
        return selectRemoveButtons().length == getVideoCount();
    }

    const didConfirmLoadMore = () => {
        let input = prompt(
            `${SCRIPT_NAME} will now load all videos on the playlist. ` +
            `This might take a while.`
        );
        return input != null;
    }

    const loadMoreVideos = () => {
        selectLoadMoreButton().click();
    }

    let loadMoreIntervalId;

    const loadMoreVideosOrClearIntervalAndGetToWork = () => {
        if (allVideosLoaded()) {
            clearInterval(loadMoreIntervalId);
            getToWork();
        } else {
            loadMoreVideos();
        }
    }

    const doLoadAllVideosAndGetToWork = () => {
        loadMoreIntervalId = setInterval(
            loadMoreVideosOrClearIntervalAndGetToWork,
            500
        );
    }

    const loadAllVideosAndGetToWork = () => {
        if (didConfirmLoadMore()) {
            doLoadAllVideosAndGetToWork();
        } else {
            logCancellation();
        }
    }

    const getVideoCount = () => {
        let videoCountDisplay = document
            .querySelector('.pl-header-details li:nth-child(2)')
            .textContent
        let videoCount = videoCountDisplay.match(/^.*(?= videos?$)/)[0]
        return (videoCount === 'No') ? 0 : videoCount;
    }

    const countVideosToRemove = () => {
        return Math.max(
            getVideoCount() - KEEP_THE_LAST,
            0
        );
    }


    // REMOVE SCRIPT //////////////////////////////////////////////////////////

    let buttonsClicked;

    const performBatchRemove = (nVideosToRemove) => {
        buttonsClicked = 0;
        logRemoval(nVideosToRemove);
        scheduleClicks(nVideosToRemove);
        scheduleSuccessNotifications();
    }

    const prepareAndPerformBatchRemove = () => {
        let nVideosToRemove = countVideosToRemove();
        if (didConfirmBatchRemove(nVideosToRemove)) {
            performBatchRemove(nVideosToRemove);
        } else {
            logCancellation();
        }
    }

    const getToWork = () => {
        if (allVideosLoaded()) {
            prepareAndPerformBatchRemove()
        } else {
            loadAllVideosAndGetToWork();
        }
    }

    const selectRemoveButtons = () => {
        return document.querySelectorAll(
            ".pl-video-edit-remove, .pl-video-edit-remove-liked-video"
        );
    }

    const didConfirmBatchRemove = (nVideosToRemove) => {
        let answer = promptRemovalConfirmation(nVideosToRemove);
        return (answer && answer.trim() === "YES");
    }

    const scheduleClicks = (stop) => {
        let buttons = selectRemoveButtons();
        let msPerClick = 1000 / CLICKS_PER_SECOND;
        for (let i = 0; i < stop; i++) {
            scheduleClick(buttons, i, msPerClick);
        }
    }

    const scheduleClick = (buttons, i, msPerClick) => {
        setTimeout(
            () => clickAndIncrement(buttons, i),
            msPerClick * i
        );
    }

    const clickAndIncrement = (buttons, i) => {
        buttons[i].click();
        buttonsClicked++;
    }

    const scheduleSuccessNotifications = () => {
        setTimeout(notifySuccessIfDone, 500);
    }

    const notifySuccessIfDone = () => {
        if (isRemovalDone()) {
            alertSuccess();
            logSuccess();
        } else {
            setTimeout(notifySuccessIfDone, 500);
        }
    }

    const isRemovalDone = () => {
        return (getVideoCount() <= KEEP_THE_LAST);
    }

    const linkToOldLayout = () => {
        return window.location.search + '&' + QUERY_PARAM_OLD_PAGE;
    }

    const alertSuccess = () => {
        alert(
            `${SCRIPT_NAME} clicked ${buttonsClicked} remove buttons ` +
            `for you.`
        );
    }

    const promptRemovalConfirmation = (nVideosToRemove) => {
        let totalDuration = nVideosToRemove / CLICKS_PER_SECOND;
        return prompt(
            `${SCRIPT_NAME} is about to remove ${nVideosToRemove} ` +
            `videos from your playlist. The whole thing should take about ` +
            `${totalDuration} seconds, during which you can browse other ` +
            `tabs if you like. This can not be undone. Enter "YES" ` +
            `to proceed, or do anything else to cancel.`
        );
    }

    const logRemoval = (nVideosToRemove) => {
        console.log(
            `${SCRIPT_NAME} is removing ${nVideosToRemove} videos...`
        );
    }

    const logCancellation = () => {
        console.log(
            `${SCRIPT_NAME} didn't remove any videos.`
        );
    }

    const logSuccess = () => {
        console.log(
            `${SCRIPT_NAME} clicked ${buttonsClicked} remove buttons.`
        );
    }


    // BUTTON STUFF ///////////////////////////////////////////////////////////

    // Redirect button

    const createSeparatorDot = () => {
        let text = document.createTextNode('\u00A0•\u00A0\u00A0');

        let dot = document.createElement('span');
        dot.setAttribute('style', STYLE_NEW_PLAYLIST_PAGE_TEXT);

        dot.appendChild(text);
        return dot;

    }

    const createRedirectButton = () => {
        let text = document.createTextNode(NAME_REDIRECT_BUTTON);

        let button = document.createElement('a');
        button.setAttribute('id', ID_REDIRECT_BUTTON);
        button.setAttribute('href', linkToOldLayout());
        button.setAttribute('title', TOOLTIP_REDIRECT_BUTTON);
        button.setAttribute('style', STYLE_NEW_PLAYLIST_PAGE_TEXT);

        button.appendChild(text);
        return button;
    }

    const addRedirectButton = () => {
        let buttonContainer = document.querySelector("#stats");
        buttonContainer.appendChild(createSeparatorDot());
        buttonContainer.appendChild(createRedirectButton());
    }

    const updateRedirectButton = () => {
        selectRedirectButton().setAttribute('href', linkToOldLayout());
    }

    const selectRedirectButton = () => {
        return document.getElementById(ID_REDIRECT_BUTTON);
    }

    const addOrUpdateRedirectButton = () => {
        selectRedirectButton() ? updateRedirectButton() : addRedirectButton();
    }

    // Batch remove button

    const createBatchRemoveButton = () => {
        let button = document.createElement('button');
        button.setAttribute('class', CLASS_OLD_PLAYLIST_PAGE_BUTTON);
        button.setAttribute('title', TOOLTIP_REMOVE_BUTTON);
        button.setAttribute('type', 'button');
        button.setAttribute('id', ID_BATCH_REMOVE_BUTTON);
        button.addEventListener('click', getToWork);

        let span = document.createElement('span');
        span.setAttribute('class', 'yt-uix-button-content');

        let text = document.createTextNode(NAME_BATCH_REMOVE_BUTTON);

        span.appendChild(text);
        button.appendChild(span);

        return button;
    }

    const isRemoveButtonPresent = () => {
        return !!document.getElementById(ID_BATCH_REMOVE_BUTTON);
    }

    const addRemoveButtonIfNotPresent = () => {
        if (!isRemoveButtonPresent()) {
            let buttonContainer = document.querySelector('.playlist-actions');
            buttonContainer.appendChild(createBatchRemoveButton());
        }
    }


    // PAGE STUFF /////////////////////////////////////////////////////////////

    const oldLayoutParamPresent = () => {
        let queryString = window.location.search;
        return queryString.includes(QUERY_PARAM_OLD_PAGE);
    }

    const onPlaylistPage = () => {
        let currentUrl = window.location.href;
        return currentUrl.match(
            /https:\/\/www\.youtube\.com\/playlist\?list=.*/
        );
    }

    const onOldPlaylistPage = () => {
        return onPlaylistPage() && oldLayoutParamPresent();
    }

    const onNewPlaylistPage = () => {
        return onPlaylistPage() && !oldLayoutParamPresent();
    }


    // MAIN ///////////////////////////////////////////////////////////////////

    const init = () => {
        onNewPlaylistPage() && addOrUpdateRedirectButton()
        || onOldPlaylistPage() && addRemoveButtonIfNotPresent();
    }

    window.addEventListener('load', init);
    window.addEventListener('yt-navigate-finish', init);

})();
