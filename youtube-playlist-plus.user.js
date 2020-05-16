// ==UserScript==
// @name         YouTube Playlist+
// @version      0.2.0
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
    // Default values for initializing global object

    const DEBUG = false; // Set to 'true' to enable console logging
    const CLICKS_PER_SECOND = 5; // Experiment with other speeds if you want
    const KEEP_THE_LAST = 0; // Set this number to keep the last N videos


    // CONSTANTS //////////////////////////////////////////////////////////////

    const SCRIPT_NAME = 'YouTube Playlist+';
    const SCRIPT_NAME_SHORT = 'YP+';
    const SCRIPT_NAME_SAFE = 'youtube-playlist-plus';
    const SCRIPT_NAME_SAFE_SHORT = 'ypp';

    const ID_REDIRECT_BUTTON =
        `${SCRIPT_NAME_SAFE_SHORT}-redirect-button`;
    const ID_BATCH_REMOVE_BUTTON =
        `${SCRIPT_NAME_SAFE_SHORT}-batch-remove-button`;

    const NAME_REDIRECT_BUTTON = 'Go to old layout';
    const NAME_BATCH_REMOVE_BUTTON = 'Batch remove videos';

    const TOOLTIP_REDIRECT_BUTTON =
        `Takes you to an older version of this page that has more ` +
        `controls, including our '${NAME_BATCH_REMOVE_BUTTON}' button for ` +
        `cleaning up enormous playlists.\n` +
        `- Added by ${SCRIPT_NAME}`;
    const TOOLTIP_BATCH_REMOVE_BUTTON =
        `Clicks all 'Remove' buttons for you when you're too lazy or just ` +
        `have too many of them.\n` +
        `- Added by ${SCRIPT_NAME}`;

    const QUERY_PARAM_OLD_PAGE = 'disable_polymer=true';

    const STYLE_NEW_PLAYLIST_PAGE_TEXT = `
        color: #606060;
        font-size: 1.4rem;
        font-weight: 400;
        lint-height: 2.1rem;
        cursor: default;  /* Avoid glitch on mouse enter */`;
    const CLASS_OLD_PLAYLIST_PAGE_BUTTON = `
        yt-uix-button
        yt-uix-button-default
        yt-uix-button-size-default`;

    const REGEX_PLAYLIST_URL =
        /https:\/\/www\.youtube\.com\/playlist\?list=.*/;


    // GLOBAL CONFIG //////////////////////////////////////////////////////////
    // Not logged() since logging decorator depends on global config

    /** Encapsulates runtime console access to script options */
    const defaultGlobalConfig = {
        debug: DEBUG,
        clicksPerSecond: CLICKS_PER_SECOND,
        keepTheLast: KEEP_THE_LAST
    }

    const warnGlobalNameTaken = (name) => {
        LOG.warn(
            `Could not add '${name}' property to 'window' object: ` +
            `name already taken`
        );
    }

    const addGlobal = (key, value) => {
        window[key] = value;
        return true;
    }

    const safeAddGlobalConfig = () => {
        if (window[SCRIPT_NAME_SAFE_SHORT]) {
            warnGlobalNameTaken(SCRIPT_NAME_SAFE_SHORT);
        } else {
            return addGlobal(SCRIPT_NAME_SAFE_SHORT, defaultGlobalConfig);
        }
    }

    const getConfig = () => {
        return window[SCRIPT_NAME_SAFE_SHORT];
    }


    // LOGGING ////////////////////////////////////////////////////////////////

    const LOG = {
        info: (msg) => {
            console.info(`[${SCRIPT_NAME_SAFE}] INFO - ${msg}`);
        },

        warn: (msg) => {
            console.warn(`[${SCRIPT_NAME_SAFE}] WARNING - ${msg}`);
        },

        error: (msg) => {
            console.error(`[${SCRIPT_NAME_SAFE}] ERROR - ${msg}`);
        }
    }

    const callWithLogging = (fun, args) => {
        LOG.info(`calling: ${fun.name}(${args.join(', ')})`);
        let result = fun(...args);
        LOG.info(`${fun.name} returned: ${result}`);
        return result;
    }

    const tryCallWithLogging = (fun, args) => {
        try {
            return callWithLogging(fun, args);
        } catch (ex) {
            LOG.error(ex);
        }
    }

    /** Return function decorated with before-after logging */
    const logged = (fun) => {
        return (...args) => {
            if (getConfig().debug) {
                return tryCallWithLogging(fun, args);
            } else {
                return fun(...args);
            }
        }
    }


    // LOAD MORE //////////////////////////////////////////////////////////////

    const selectLoadMoreButton = () => logged(function selectLoadMoreButton() {
        return document.querySelector(
            "#pl-video-list > " +
            "button.load-more-button.browse-items-load-more-button"
        );
    })()

    const allVideosLoaded = () => logged(function allVideosLoaded() {
        return selectRemoveButtons().length == getVideoCount();
    })()

    const didConfirmLoadMore = () => logged(function didConfirmLoadMore() {
        let input = prompt(
            `${SCRIPT_NAME} will now load all videos on the playlist. ` +
            `This might take a while.`
        );
        return input != null;
    })()

    const loadMoreVideos = () => logged(function loadMoreVideos() {
        selectLoadMoreButton().click();
    })()

    let loadMoreIntervalId;

    const loadMoreVideosOrClearIntervalAndGetToWork = () => logged(function loadMoreVideosOrClearIntervalAndGetToWork() {
        if (allVideosLoaded()) {
            clearInterval(loadMoreIntervalId);
            getToWork();
        } else {
            loadMoreVideos();
        }
    })()

    const doLoadAllVideosAndGetToWork = () => logged(function doLoadAllVideosAndGetToWork() {
        loadMoreIntervalId = setInterval(
            loadMoreVideosOrClearIntervalAndGetToWork,
            500
        );
    })()

    const loadAllVideosAndGetToWork = () => logged(function loadAllVideosAndGetToWork() {
        didConfirmLoadMore() && doLoadAllVideosAndGetToWork();
    })()

    const getVideoCount = () => logged(function getVideoCount() {
        let videoCountDisplay = document
            .querySelector('.pl-header-details li:nth-child(2)')
            .textContent
        let videoCount = videoCountDisplay.match(/^.*(?= videos?$)/)[0]
        return (videoCount === 'No') ? 0 : videoCount;
    })()

    const countVideosToRemove = () => logged(function countVideosToRemove() {
        return Math.max(
            getVideoCount() - getConfig().keepTheLast,
            0
        );
    })()


    // REMOVE SCRIPT //////////////////////////////////////////////////////////

    let buttonsClicked;

    const performBatchRemove = (nVideosToRemove) => logged(function performBatchRemove(nVideosToRemove) {
        buttonsClicked = 0;
        scheduleClicks(nVideosToRemove);
        scheduleSuccessNotifications();
    })(nVideosToRemove)

    const prepareAndPerformBatchRemove = () => logged(function prepareAndPerformBatchRemove() {
        let nVideosToRemove = countVideosToRemove();
        if (didConfirmBatchRemove(nVideosToRemove)) {
            performBatchRemove(nVideosToRemove);
        }
    })()

    const getToWork = () => logged(function getToWork() {
        if (allVideosLoaded()) {
            prepareAndPerformBatchRemove()
        } else {
            loadAllVideosAndGetToWork();
        }
    })()

    const selectRemoveButtons = () => logged(function selectRemoveButtons() {
        return document.querySelectorAll(
            ".pl-video-edit-remove, .pl-video-edit-remove-liked-video"
        );
    })()

    const didConfirmBatchRemove = (nVideosToRemove) => logged(function didConfirmBatchRemove(nVideosToRemove) {
        let answer = promptRemovalConfirmation(nVideosToRemove);
        return (answer && answer.trim() === "YES");
    })(nVideosToRemove)

    const scheduleClicks = (stop) => logged(function scheduleClicks(stop) {
        let buttons = selectRemoveButtons();
        let msPerClick = 1000 / getConfig().clicksPerSecond;
        for (let i = 0; i < stop; i++) {
            scheduleClick(buttons, i, msPerClick);
        }
    })(stop)

    const scheduleClick = (buttons, i, msPerClick) => logged(function scheduleClick(buttons, i, msPerClick) {
        setTimeout(
            () => clickAndIncrement(buttons, i),
            msPerClick * i
        );
    })(buttons, i, msPerClick)

    const clickAndIncrement = (buttons, i) => logged(function clickAndIncrement(buttons, i) {
        buttons[i].click();
        buttonsClicked++;
    })(buttons, i)

    const scheduleSuccessNotifications = () => logged(function scheduleSuccessNotifications() {
        setTimeout(notifySuccessIfDone, 500);
    })()

    const notifySuccessIfDone = () => logged(function notifySuccessIfDone() {
        if (isRemovalDone()) {
            alertSuccess();
        } else {
            setTimeout(notifySuccessIfDone, 500);
        }
    })()

    const isRemovalDone = () => logged(function isRemovalDone() {
        return (getVideoCount() <= getConfig().keepTheLast);
    })()

    const linkToOldLayout = () => logged(function linkToOldLayout() {
        return window.location.search + '&' + QUERY_PARAM_OLD_PAGE;
    })()

    const alertSuccess = () => logged(function alertSuccess() {
        alert(
            `${SCRIPT_NAME} clicked ${buttonsClicked} remove buttons ` +
            `for you.`
        );
    })()

    const promptRemovalConfirmation = (nVideosToRemove) => logged(function promptRemovalConfirmation(nVideosToRemove) {
        let totalDuration = nVideosToRemove / getConfig().clicksPerSecond;
        return prompt(
            `${SCRIPT_NAME} is about to remove ${nVideosToRemove} ` +
            `videos from your playlist. The whole thing should take about ` +
            `${totalDuration} seconds, during which you can browse other ` +
            `tabs if you like. This can not be undone. Enter "YES" ` +
            `to proceed, or do anything else to cancel.`
        );
    })(nVideosToRemove)


    // BUTTON STUFF ///////////////////////////////////////////////////////////

    // Redirect button

    const createSeparatorDot = () => logged(function createSeparatorDot() {
        let text = document.createTextNode('\u00A0•\u00A0\u00A0');

        let dot = document.createElement('span');
        dot.setAttribute('style', STYLE_NEW_PLAYLIST_PAGE_TEXT);

        dot.appendChild(text);
        return dot;
    })()

    const createRedirectButton = () => logged(function createRedirectButton() {
        let text = document.createTextNode(NAME_REDIRECT_BUTTON);

        let button = document.createElement('a');
        button.setAttribute('id', ID_REDIRECT_BUTTON);
        button.setAttribute('href', linkToOldLayout());
        button.setAttribute('title', TOOLTIP_REDIRECT_BUTTON);
        button.setAttribute('style', STYLE_NEW_PLAYLIST_PAGE_TEXT);

        button.appendChild(text);
        return button;
    })()

    const addRedirectButton = () => logged(function addRedirectButton() {
        let buttonContainer = document.querySelector("#stats");
        buttonContainer.appendChild(createSeparatorDot());
        buttonContainer.appendChild(createRedirectButton());
    })()

    const updateRedirectButton = () => logged(function updateRedirectButton() {
        selectRedirectButton().setAttribute('href', linkToOldLayout());
    })()

    const selectRedirectButton = () => logged(function selectRedirectButton() {
        return document.getElementById(ID_REDIRECT_BUTTON);
    })()

    const addOrUpdateRedirectButton = () => logged(function addOrUpdateRedirectButton() {
        selectRedirectButton() ? updateRedirectButton() : addRedirectButton();
    })()

    // Batch remove button

    const createBatchRemoveButton = () => logged(function createBatchRemoveButton() {
        let button = document.createElement('button');
        button.setAttribute('class', CLASS_OLD_PLAYLIST_PAGE_BUTTON);
        button.setAttribute('title', TOOLTIP_BATCH_REMOVE_BUTTON);
        button.setAttribute('type', 'button');
        button.setAttribute('id', ID_BATCH_REMOVE_BUTTON);
        button.addEventListener('click', getToWork);

        let span = document.createElement('span');
        span.setAttribute('class', 'yt-uix-button-content');

        let text = document.createTextNode(NAME_BATCH_REMOVE_BUTTON);

        span.appendChild(text);
        button.appendChild(span);

        return button;
    })()

    const isRemoveButtonPresent = () => logged(function isRemoveButtonPresent() {
        return !!document.getElementById(ID_BATCH_REMOVE_BUTTON);
    })()

    const addRemoveButtonIfNotPresent = () => logged(function addRemoveButtonIfNotPresent() {
        if (!isRemoveButtonPresent()) {
            let buttonContainer = document.querySelector('.playlist-actions');
            buttonContainer.appendChild(createBatchRemoveButton());
        }
    })()


    // PAGE STUFF /////////////////////////////////////////////////////////////

    const oldLayoutParamPresent = () => logged(function oldLayoutParamPresent() {
        let queryString = window.location.search;
        return queryString.includes(QUERY_PARAM_OLD_PAGE);
    })()

    const onPlaylistPage = () => logged(function onPlaylistPage() {
        let currentUrl = window.location.href;
        return REGEX_PLAYLIST_URL.test(currentUrl);
    })()

    const onOldPlaylistPage = () => logged(function onOldPlaylistPage() {
        return onPlaylistPage() && oldLayoutParamPresent();
    })()

    const onNewPlaylistPage = () => logged(function onNewPlaylistPage() {
        return onPlaylistPage() && !oldLayoutParamPresent();
    })()


    // INIT ///////////////////////////////////////////////////////////////////

    const init = () => logged(function init() {
        onNewPlaylistPage() && addOrUpdateRedirectButton()
        || onOldPlaylistPage() && addRemoveButtonIfNotPresent();
    })()

    const addInitEventListeners = () => logged(function addInitEventListeners() {
        window.addEventListener('load', init);
        window.addEventListener('yt-navigate-finish', init);
    })()

    const logInitFail = () => {
        LOG.error('Could not initialize');
    }


    // MAIN ///////////////////////////////////////////////////////////////////

    safeAddGlobalConfig() ? addInitEventListeners() : logInitFail();

})();
