/* ==========================================
GENERAL MUSIC AI V1.0
COMPLETE APPLICATION CONTROLLER
MUSIC LIBRARY + GLOBAL AUDIO PLAYER
========================================== */

"use strict";

/* ==========================================
APPLICATION STATE
========================================== */

const app = document.querySelector(".main");

if (!app) {
throw new Error("GENERAL MUSIC AI: Main container not found.");
}

const originalDashboard = app.innerHTML;

let currentPage = "dashboard";
let uploadedAudio = null;
let nowPlayingReturnPage = "music";
let nowPlayingReturnScrollY = 0;

const pageHistory = [];

const pageTitles = {
    dashboard: "DASHBOARD",
    create: "CREATE MUSIC",
    lyrics: "LYRICS STUDIO",
    drums: "DRUM SEPARATION",
    stems: "STEM SEPARATION",
    music: "MY MUSIC",
    library: "MUSIC LIBRARY",
    settings: "SETTINGS",
    nowplaying: "NOW PLAYING"
};

const PLAYBACK_MODE_KEY = "gtp_music_playback_mode_v1";
const SHUFFLE_KEY = "gtp_music_shuffle_v1";
let repeatMode = localStorage.getItem(PLAYBACK_MODE_KEY) || "off";
if (!["off", "all", "one"].includes(repeatMode)) repeatMode = "off";
let shuffleEnabled = localStorage.getItem(SHUFFLE_KEY) === "true";

const STORAGE_KEY = "gtp_music_tasks";
const DOWNLOAD_KEY = "gtp_music_downloads";
const PLAYER_VOLUME_KEY = "gtp_music_volume";
const AUTOPLAY_NEXT_KEY = "gtp_music_autoplay_next";

const MAX_AUDIO_SIZE = 7 * 1024 * 1024;

const SUPPORTED_AUDIO_FORMATS = ["mp3", "m4a"];

const audioElement = document.getElementById("globalAudio");

let currentTrackId = null;
let playerPlaylist = [];
let currentTrackIndex = -1;
const PLAYBACK_QUEUE_KEY = "gtp_music_playback_queue_v1";
let playbackQueueIds = null;
try {
    const savedQueue = JSON.parse(localStorage.getItem(PLAYBACK_QUEUE_KEY) || "null");
    if (Array.isArray(savedQueue)) playbackQueueIds = savedQueue.map(String);
} catch (error) { playbackQueueIds = null; }

function savePlaybackQueue() {
    try {
        if (Array.isArray(playbackQueueIds)) localStorage.setItem(PLAYBACK_QUEUE_KEY, JSON.stringify(playbackQueueIds));
        else localStorage.removeItem(PLAYBACK_QUEUE_KEY);
    } catch (error) { console.warn("Unable to save playback queue:", error); }
}
function renderPlaybackQueue() {
    let panel = document.getElementById("playbackQueuePanel");
    if (!panel) {
        panel = document.createElement("section");
        panel.id = "playbackQueuePanel";
        panel.className = "playback-queue-panel";
        panel.hidden = true;
        panel.setAttribute("aria-label", "Playback queue");
        document.body.appendChild(panel);
    }
    refreshPlaylist();
    const tracks = playerPlaylist;
    const currentIndex = tracks.findIndex(track => String(track.id) === String(currentTrackId));
    const upcoming = tracks.filter(track => String(track.id) !== String(currentTrackId));
    panel.innerHTML = `
        <div class="playback-queue-head">
            <div><span class="queue-kicker">GENERAL MUSIC AI</span><h3>PLAYBACK QUEUE <small>${upcoming.length} UPCOMING</small></h3></div>
            <button type="button" class="queue-close" data-queue-close aria-label="Close queue">✕</button>
        </div>
        <div class="queue-current"><span class="queue-current-label">NOW PLAYING</span><strong>${escapeHTML((tracks.find(track => String(track.id) === String(currentTrackId)) || {}).title || "Nothing playing")}</strong></div>
        <div class="queue-list">
        ${upcoming.length ? upcoming.map((track,index) => {
            const id=String(track.id), actualIndex=tracks.findIndex(item=>String(item.id)===id);
            return `<article class="queue-track-row">
                <span class="queue-position">${index+1}</span>
                <button type="button" class="queue-track-play" data-queue-play="${escapeHTML(id)}" aria-label="Play track">▶</button>
                <div class="queue-track-copy"><strong>${escapeHTML(track.title||"Untitled Song")}</strong><small>${escapeHTML(track.artistName||"Unknown artist")}</small></div>
                <div class="queue-row-actions">
                    <button type="button" data-queue-up="${escapeHTML(id)}" ${actualIndex <= (currentIndex>=0?currentIndex+1:0)?"disabled":""} aria-label="Move up">↑</button>
                    <button type="button" data-queue-down="${escapeHTML(id)}" ${actualIndex>=tracks.length-1?"disabled":""} aria-label="Move down">↓</button>
                    <button type="button" data-queue-remove="${escapeHTML(id)}" aria-label="Remove from queue">✕</button>
                </div></article>`;
        }).join("") : '<p class="queue-empty">No upcoming songs. Add tracks from MY MUSIC.</p>'}
        </div>
        <section class="sleep-timer-box" aria-label="Sleep timer">
            <div class="sleep-timer-heading"><strong>🌙 SLEEP TIMER</strong><span id="sleepTimerStatus" aria-live="polite">OFF</span></div>
            <div class="sleep-timer-options">
                <button type="button" data-sleep-minutes="15">15 MIN</button>
                <button type="button" data-sleep-minutes="30">30 MIN</button>
                <button type="button" data-sleep-minutes="45">45 MIN</button>
                <button type="button" data-sleep-minutes="60">60 MIN</button>
                <button type="button" data-sleep-custom>CUSTOM</button>
            </div>
            <button type="button" class="sleep-timer-cancel" data-sleep-cancel disabled>TURN TIMER OFF</button>
        </section>
        <div class="queue-footer"><button type="button" class="queue-clear" data-queue-clear>CLEAR UPCOMING</button></div>`;
    const badge=document.getElementById("queueToggle");
    if(badge) badge.dataset.count=String(upcoming.length);
    return panel;
}
function openPlaybackQueue(){const panel=renderPlaybackQueue();panel.hidden=false;panel.classList.add("is-open");}
function closePlaybackQueue(){const panel=document.getElementById("playbackQueuePanel");if(panel){panel.classList.remove("is-open");panel.hidden=true;}}
function addTrackToQueue(trackId, playNext=false){
    const id=String(trackId), playable=getSavedTasks().filter(hasPlayableAudio).map(track=>String(track.id));
    if(!playable.includes(id)) return false;
    let queue=Array.isArray(playbackQueueIds)?playbackQueueIds.filter(item=>playable.includes(String(item))):playable;
    queue=queue.filter(item=>String(item)!==id);
    if(playNext){const index=queue.findIndex(item=>String(item)===String(currentTrackId));queue.splice(index>=0?index+1:0,0,id);}
    else queue.push(id);
    playbackQueueIds=queue;savePlaybackQueue();refreshPlaylist();renderPlaybackQueue();return true;
}
let sleepTimerDeadline = 0;
let sleepTimerInterval = null;
function updateSleepTimerDisplay() {
    const status = document.getElementById("sleepTimerStatus");
    const cancel = document.querySelector("[data-sleep-cancel]");
    const remaining = Math.max(0, Math.ceil((sleepTimerDeadline - Date.now()) / 1000));
    if (status) status.textContent = sleepTimerDeadline
        ? String(Math.floor(remaining / 60)).padStart(2, "0") + ":" + String(remaining % 60).padStart(2, "0") + " LEFT"
        : "OFF";
    if (cancel) cancel.disabled = !sleepTimerDeadline;
}
function stopSleepTimer() {
    sleepTimerDeadline = 0;
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    sleepTimerInterval = null;
    updateSleepTimerDisplay();
}
function startSleepTimer(minutes) {
    const value = Number(minutes);
    if (!Number.isFinite(value) || value <= 0 || value > 720) {
        alert("Choose a timer between 1 and 720 minutes.");
        return;
    }
    sleepTimerDeadline = Date.now() + value * 60000;
    if (sleepTimerInterval) clearInterval(sleepTimerInterval);
    updateSleepTimerDisplay();
    sleepTimerInterval = setInterval(() => {
        if (Date.now() >= sleepTimerDeadline) {
            stopSleepTimer();
            if (audioElement && !audioElement.paused) audioElement.pause();
            return;
        }
        updateSleepTimerDisplay();
    }, 1000);
}

function moveQueueTrack(trackId,direction){
    refreshPlaylist();const queue=playerPlaylist.map(track=>String(track.id));
    const index=queue.indexOf(String(trackId)),target=index+direction,currentIndex=queue.indexOf(String(currentTrackId));
    if(index<0||target<0||target>=queue.length||String(trackId)===String(currentTrackId)||(direction<0&&currentIndex>=0&&target<=currentIndex))return;
    [queue[index],queue[target]]=[queue[target],queue[index]];
    playbackQueueIds=queue;savePlaybackQueue();renderPlaybackQueue();
}

/* ==========================================
SAFE STORAGE HELPERS
========================================== */

function getSavedTasks() {
try {
const saved = JSON.parse(
localStorage.getItem(STORAGE_KEY) || "[]"
);

    return Array.isArray(saved) ? saved : [];

} catch (error) {
    console.error("Music storage error:", error);
    return [];
}

}

function saveTasks(tasks) {
try {
localStorage.setItem(
STORAGE_KEY,
JSON.stringify(tasks)
);

    return true;

} catch (error) {
    console.error("Unable to save music:", error);
    return false;
}

}

function saveTask(task) {
const tasks = getSavedTasks();

const existingIndex = tasks.findIndex(
    item => item.id === task.id
);

if (existingIndex >= 0) {
    tasks[existingIndex] = {
        ...tasks[existingIndex],
        ...task,
        createdAt: tasks[existingIndex].createdAt || task.createdAt || new Date().toISOString()
    };
} else {
    tasks.unshift({ ...task, createdAt: task.createdAt || new Date().toISOString() });
}

saveTasks(tasks);

}

/* ==========================================
SECURITY HELPERS
========================================== */

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[character]
    );
}

function safeAudioURL(value) {
if (typeof value !== "string" || !value.trim()) {
return "";
}

try {
    const url = new URL(value, window.location.origin);

    if (
        url.protocol !== "https:" &&
        url.protocol !== "http:"
    ) {
        return "";
    }

    return url.href;

} catch (error) {
    return "";
}

}

/* ==========================================
API RESPONSE HELPER
========================================== */

async function readAPIResponse(response) {
try {
return await response.json();
} catch (error) {
throw new Error(
"The server returned an invalid response."
);
}
}

/* ==========================================
AUDIO PLAYER ELEMENTS
========================================== */

const playerElements = {
title: document.getElementById("playerTitle"),
artist: document.getElementById("playerArtist"),
cover: document.getElementById("playerCover"),
play: document.getElementById("playPauseBtn"),
previous: document.getElementById("previousTrack"),
next: document.getElementById("nextTrack"),
progress: document.getElementById("playerProgress"),
currentTime: document.getElementById("currentTime"),
duration: document.getElementById("totalDuration"),
volume: document.getElementById("playerVolume")
};

/* ==========================================
PLAYER UTILITIES
========================================== */

function formatTime(seconds) {
if (!Number.isFinite(seconds) || seconds < 0) {
return "00:00";
}

const minutes = Math.floor(seconds / 60);
const remainingSeconds = Math.floor(seconds % 60);

return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remainingSeconds).padStart(2, "0")
);

}

function updatePlayButton() {
if (!playerElements.play || !audioElement) return;

const playing = !audioElement.paused;

playerElements.play.textContent = playing ? "❚❚" : "▶";

playerElements.play.title = playing ? "Pause" : "Play";

playerElements.play.setAttribute(
    "aria-label",
    playing ? "Pause" : "Play"
);
document.querySelectorAll("[data-play-music]").forEach(button => {
    const isCurrent = String(button.dataset.playMusic) === String(currentTrackId);
    button.textContent = isCurrent && playing ? "Ⅱ" : "▶";
    button.title = isCurrent && playing ? "Pause" : "Play";
    button.setAttribute("aria-label", isCurrent && playing ? "Pause" : "Play");
});
document.querySelectorAll("[data-pause-music]").forEach(button => {
    button.textContent = playing ? "Ⅱ" : "▶";
    button.title = playing ? "Pause" : "Play";
    button.setAttribute("aria-label", playing ? "Pause" : "Play");
});
document.querySelectorAll("[data-full-toggle]").forEach(button => { button.textContent = playing ? "Ⅱ" : "▶"; button.setAttribute("aria-label", playing ? "Pause" : "Play"); });

}

function updatePlayerProgress() {
if (!audioElement) return;

const current = audioElement.currentTime || 0;
const duration = audioElement.duration || 0;

if (playerElements.currentTime) {
    playerElements.currentTime.textContent =
        formatTime(current);
}

if (playerElements.duration) {
    playerElements.duration.textContent =
        formatTime(duration);
}

if (playerElements.progress) {
    playerElements.progress.value =
        duration > 0 ? (current / duration) * 100 : 0;
}

document.querySelectorAll("[data-inline-progress]").forEach(element => {
    element.value = duration > 0 ? (current / duration) * 100 : 0;
});
document.querySelectorAll("[data-inline-current]").forEach(element => {
    element.textContent = formatTime(current);
});
document.querySelectorAll("[data-inline-duration]").forEach(element => {
    element.textContent = formatTime(duration);
});
document.querySelectorAll("[data-full-progress]").forEach(element => { element.value = duration > 0 ? (current / duration) * 100 : 0; });
document.querySelectorAll("[data-full-current]").forEach(element => { element.textContent = formatTime(current); });
document.querySelectorAll("[data-full-duration]").forEach(element => { element.textContent = formatTime(duration); });

}

function updatePlayerInformation(track) {
if (!track) return;

if (playerElements.title) {
    playerElements.title.textContent =
        track.title || "Untitled Song";
}

if (playerElements.artist) {
    playerElements.artist.textContent = track.artistName || (track.type === "instrumental"
        ? "GENERAL MUSIC AI · INSTRUMENTAL"
        : "GENERAL MUSIC AI · AI SONG");
}

if (playerElements.cover) {
    if (track.coverImage) {
        playerElements.cover.textContent = "";
        playerElements.cover.style.backgroundImage = 'url("' + track.coverImage + '")';
        playerElements.cover.classList.add("has-artwork");
    } else {
        playerElements.cover.style.backgroundImage = "";
        playerElements.cover.textContent = track.type === "instrumental" ? "🎹" : "🎵";
        playerElements.cover.classList.remove("has-artwork");
    }
}

}

/* LOCAL MUSIC IMPORT STORAGE (audio blobs stay out of localStorage) */
const LOCAL_AUDIO_DB = "general_music_ai_audio_v1";
const LOCAL_AUDIO_STORE = "tracks";
const localAudioURLs = new Map();
function openLocalAudioDB() { return new Promise((resolve, reject) => {
 if (!("indexedDB" in window)) return reject(new Error("This browser does not support local music storage."));
 const request = indexedDB.open(LOCAL_AUDIO_DB, 1);
 request.onupgradeneeded = () => { const db = request.result; if (!db.objectStoreNames.contains(LOCAL_AUDIO_STORE)) db.createObjectStore(LOCAL_AUDIO_STORE, { keyPath: 'id' }); };
 request.onsuccess = () => resolve(request.result);
 request.onerror = () => reject(new Error("Unable to open local music storage."));
}); }
async function saveLocalAudio(id, file) { const db = await openLocalAudioDB(); return new Promise((resolve, reject) => {
 const tx = db.transaction(LOCAL_AUDIO_STORE, 'readwrite');
 tx.objectStore(LOCAL_AUDIO_STORE).put({ id: String(id), blob: file, name: file.name, type: file.type || 'audio/mpeg' });
 tx.oncomplete = () => { db.close(); resolve(true); };
 tx.onerror = () => { db.close(); reject(new Error("Unable to save this audio file on your device.")); };
 tx.onabort = () => { db.close(); reject(new Error("Audio import was cancelled by browser storage.")); };
}); }
async function getLocalAudio(id) { const db = await openLocalAudioDB(); return new Promise((resolve, reject) => {
 const tx = db.transaction(LOCAL_AUDIO_STORE, 'readonly'); const request = tx.objectStore(LOCAL_AUDIO_STORE).get(String(id));
 request.onsuccess = () => { const value = request.result; db.close(); resolve(value || null); };
 request.onerror = () => { db.close(); reject(new Error("Unable to read the imported audio file.")); };
}); }
async function deleteLocalAudio(id) { const db = await openLocalAudioDB(); return new Promise((resolve, reject) => {
 const tx = db.transaction(LOCAL_AUDIO_STORE, 'readwrite'); tx.objectStore(LOCAL_AUDIO_STORE).delete(String(id));
 tx.oncomplete = () => { db.close(); resolve(); };
 tx.onerror = () => { db.close(); reject(new Error("Unable to remove the imported audio file.")); };
}); }
function hasPlayableAudio(track) { return Boolean(track && (safeAudioURL(track.audioUrl) || track.audioBlobId)); }
async function resolveTrackAudioURL(track) {
 const remoteURL = safeAudioURL(track && track.audioUrl); if (remoteURL) return remoteURL;
 if (!track || !track.audioBlobId) return '';
 const id = String(track.audioBlobId); if (localAudioURLs.has(id)) return localAudioURLs.get(id);
 const saved = await getLocalAudio(id); if (!saved || !saved.blob) return '';
 const url = URL.createObjectURL(saved.blob); localAudioURLs.set(id, url); return url;
}
function refreshPlaylist() {
const playableTasks = getSavedTasks().filter(hasPlayableAudio);
if (Array.isArray(playbackQueueIds)) {
    const byId = new Map(playableTasks.map(task => [String(task.id), task]));
    playerPlaylist = playbackQueueIds.map(id => byId.get(String(id))).filter(Boolean);
} else {
    playerPlaylist = playableTasks;
}

if (currentTrackId) {
    currentTrackIndex = playerPlaylist.findIndex(task => String(task.id) === String(currentTrackId));
}
return playerPlaylist;
}

/* ==========================================
PLAY A TRACK
========================================== */

async function playTrack(trackId) {
if (!audioElement) {
console.error("Global audio element not found.");
return;
}

refreshPlaylist();

const index = playerPlaylist.findIndex(
    task => String(task.id) === String(trackId)
);

if (index < 0) {
    alert("This track does not have a playable audio file yet.");
    return;
}

const track = playerPlaylist[index];
// Use an already-prepared local Blob URL synchronously on mobile taps.
// This keeps audioElement.play() inside the original user gesture.
const cachedLocalURL = track.audioBlobId
    ? localAudioURLs.get(String(track.audioBlobId))
    : "";
const audioURL = cachedLocalURL || safeAudioURL(track.audioUrl) || await resolveTrackAudioURL(track);

if (!audioURL) {
    alert("This track audio file could not be found on this device.");
    return;
}

currentTrackId = track.id;
currentTrackIndex = index;
renderPlaybackQueue();

if (currentPage === "nowplaying") renderNowPlayingPage();
updatePlayerInformation(track);
detectTrackDuration(track.id, audioURL);

if (audioElement.src !== audioURL) {
    audioElement.pause();
    audioElement.src = audioURL;
    audioElement.load();
}

try {
    await audioElement.play();
    updatePlayButton();

} catch (error) {
    console.error("Playback error:", error);

    updatePlayButton();

    alert(
        "Unable to play this track. Please check your internet connection or audio file."
    );
}

}

/* ==========================================
PLAY / PAUSE
========================================== */

async function togglePlayback() {
if (!audioElement) return;

if (!audioElement.src) {
    refreshPlaylist();

    if (playerPlaylist.length > 0) {
        await playTrack(playerPlaylist[0].id);
    } else {
        alert("Your music library has no playable tracks yet.");
    }

    return;
}

if (audioElement.paused) {
    try {
        await audioElement.play();
    } catch (error) {
        console.error("Playback error:", error);
    }
} else {
    audioElement.pause();
}

updatePlayButton();

}

/* ==========================================
NEXT TRACK
========================================== */

async function playNextTrack() {
    refreshPlaylist();
    if (!playerPlaylist.length) return;

    if (repeatMode === "one" && audioElement && audioElement.ended) {
        audioElement.currentTime = 0;
        await audioElement.play();
        return;
    }

    const currentIndex = playerPlaylist.findIndex(
        track => String(track.id) === String(currentTrackId)
    );
    let nextIndex;
    if (shuffleEnabled && playerPlaylist.length > 1) {
        const choices = playerPlaylist.map((_, index) => index).filter(index => index !== currentIndex);
        nextIndex = choices[Math.floor(Math.random() * choices.length)];
    } else if (currentIndex < 0) {
        nextIndex = 0;
    } else if (currentIndex + 1 < playerPlaylist.length) {
        nextIndex = currentIndex + 1;
    } else if (repeatMode === "all") {
        nextIndex = 0;
    } else {
        if (audioElement && !audioElement.ended) audioElement.pause();
        return;
    }
    await playTrack(playerPlaylist[nextIndex].id);
}

/* ==========================================
PREVIOUS TRACK
========================================== */

async function playPreviousTrack() {
    if (!audioElement) return;

    if (audioElement.currentTime > 3) {
        audioElement.currentTime = 0;
        return;
    }

    refreshPlaylist();
    if (!playerPlaylist.length) return;

    const currentIndex = playerPlaylist.findIndex(
        track => String(track.id) === String(currentTrackId)
    );
    const previousIndex = currentIndex < 0
        ? playerPlaylist.length - 1
        : (currentIndex - 1 + playerPlaylist.length) % playerPlaylist.length;

    await playTrack(playerPlaylist[previousIndex].id);
}

/* ==========================================
INITIALIZE GLOBAL AUDIO PLAYER
========================================== */

function initializeGlobalPlayer() {
if (!audioElement) {
console.warn("Global audio player is unavailable.");
return;
}

const storedVolume = localStorage.getItem(PLAYER_VOLUME_KEY);
const savedVolume = storedVolume === null ? 0.8 : Number(storedVolume);

const initialVolume = Number.isFinite(savedVolume)
    ? Math.max(0, Math.min(1, savedVolume))
    : 0.8;

audioElement.volume = initialVolume;

if (playerElements.volume) {
    playerElements.volume.value = initialVolume;

    playerElements.volume.addEventListener("input", () => {
        const volume = Number(playerElements.volume.value);

        audioElement.volume = volume;

        localStorage.setItem(
            PLAYER_VOLUME_KEY,
            String(volume)
        );
    });
}

const shuffleControl = document.getElementById("shuffleToggle");
const repeatControl = document.getElementById("repeatToggle");
function updatePlaybackModeControls() {
    if (shuffleControl) {
        shuffleControl.classList.toggle("is-active", shuffleEnabled);
        shuffleControl.setAttribute("aria-pressed", String(shuffleEnabled));
        shuffleControl.title = shuffleEnabled ? "Shuffle on" : "Shuffle off";
    }
    if (repeatControl) {
        repeatControl.classList.toggle("is-active", repeatMode !== "off");
        repeatControl.textContent = repeatMode === "one" ? "🔂" : "🔁";
        repeatControl.setAttribute("aria-pressed", String(repeatMode !== "off"));
        repeatControl.title = repeatMode === "off" ? "Repeat off" : repeatMode === "all" ? "Repeat all" : "Repeat one";
    }
}
if (shuffleControl) shuffleControl.addEventListener("click", () => {
    shuffleEnabled = !shuffleEnabled;
    localStorage.setItem(SHUFFLE_KEY, String(shuffleEnabled));
    updatePlaybackModeControls();
});
if (repeatControl) repeatControl.addEventListener("click", () => {
    repeatMode = repeatMode === "off" ? "all" : repeatMode === "all" ? "one" : "off";
    localStorage.setItem(PLAYBACK_MODE_KEY, repeatMode);
    updatePlaybackModeControls();
});
updatePlaybackModeControls();

if (playerElements.play) {
    playerElements.play.addEventListener(
        "click",
        togglePlayback
    );
}

if (playerElements.next) {
    playerElements.next.addEventListener(
        "click",
        playNextTrack
    );
}

if (playerElements.previous) {
    playerElements.previous.addEventListener(
        "click",
        playPreviousTrack
    );
}

if (playerElements.progress) {
    playerElements.progress.addEventListener("input", () => {
        if (
            Number.isFinite(audioElement.duration) &&
            audioElement.duration > 0
        ) {
            audioElement.currentTime =
                (Number(playerElements.progress.value) / 100) *
                audioElement.duration;
        }
    });
}

audioElement.addEventListener("timeupdate", updatePlayerProgress);

audioElement.addEventListener(
    "loadedmetadata",
    updatePlayerProgress
);

audioElement.addEventListener(
    "durationchange",
    updatePlayerProgress
);

audioElement.addEventListener("play", updatePlayButton);

audioElement.addEventListener("pause", updatePlayButton);

audioElement.addEventListener("ended", () => {
    if (repeatMode === "one") {
        audioElement.currentTime = 0;
        audioElement.play().catch(error => console.error("Repeat playback error:", error));
        return;
    }
    if (repeatMode === "all" || playerPlaylist.findIndex(track => String(track.id) === String(currentTrackId)) < playerPlaylist.length - 1) {
        playNextTrack();
    } else {
        updatePlayButton();
    }
});

audioElement.addEventListener("error", () => {
    updatePlayButton();

    if (audioElement.error) {
        console.error(
            "Audio playback error:",
            audioElement.error.message
        );
    }
});

refreshPlaylist();
updatePlayerProgress();
updatePlayButton();

}

/* ==========================================
DOWNLOAD STATISTICS
========================================== */

function getDownloadCount() {
try {
return Number(
localStorage.getItem(DOWNLOAD_KEY) || 0
) || 0;
} catch (error) {
return 0;
}
}

function recordDownload() {
try {
localStorage.setItem(
DOWNLOAD_KEY,
String(getDownloadCount() + 1)
);

    updateDashboardStatistics();
} catch (error) {
    console.error("Download counter error:", error);
}

}

/* ==========================================
DASHBOARD STATISTICS
========================================== */

function updateDashboardStatistics() {
const tasks = getSavedTasks();

const songs = tasks.filter(task => {
    return task.type === "song" ||
        task.type === "instrumental";
});

const separations = tasks.filter(task => {
    return task.type === "separation" ||
        task.type === "stems" ||
        task.type === "drums";
});

const totalSongs = document.getElementById("totalSongs");
const totalSeparations = document.getElementById("totalSeparations");
const totalDownloads = document.getElementById("totalDownloads");

if (totalSongs) {
    totalSongs.textContent = songs.length;
}

if (totalSeparations) {
    totalSeparations.textContent = separations.length;
}

if (totalDownloads) {
    totalDownloads.textContent = getDownloadCount();
}

}

/* ==========================================
PAGE TEMPLATES
========================================== */

const pages = {

dashboard: originalDashboard,

nowplaying: `<section class="full-now-playing-page" id="fullNowPlaying"><div class="now-playing-empty">Choose a song from MY MUSIC to start playing.</div></section>`,

/* ======================================
   AI MUSIC GENERATOR
====================================== */

create: `

<section class="library generator-page">

    <div class="generator-panel">

        <h2>🎵 MUSIC</h2>

        <form id="musicForm">

            <label>Song Title</label>

            <input
                id="songTitle"
                type="text"
                maxlength="150"
                placeholder="Enter your song title"
                required
            >

            <label>Describe Your Music</label>

            <textarea
                id="musicPrompt"
                maxlength="1024"
                placeholder="Describe the sound, mood and instruments..."
                required
            ></textarea>

            <label>Write or Paste Your Lyrics</label>

            <textarea
                id="songLyrics"
                placeholder="Enter your original song lyrics here..."
                required
            ></textarea>

            <div class="form-row">

                <div>
                    <label>Music Genre</label>

                    <select id="genre">
                        <option value="Afrobeats">Afrobeats</option>
                        <option value="Hip-Hop">Hip-Hop</option>
                        <option value="R&B">R&amp;B</option>
                        <option value="Blues">Blues</option>
                        <option value="Gospel">Gospel</option>
                        <option value="Amapiano">Amapiano</option>
                        <option value="Afro-fusion">Afro-fusion</option>
                        <option value="Highlife">Highlife</option>
                        <option value="Reggae">Reggae</option>
                        <option value="Dancehall">Dancehall</option>
                        <option value="Soul">Soul</option>
                        <option value="Jazz">Jazz</option>
                        <option value="Pop">Pop</option>
                        <option value="Rock">Rock</option>
                        <option value="Country">Country</option>
                        <option value="Electronic">Electronic</option>
                        <option value="Drill">Drill</option>
                        <option value="Trap">Trap</option>
                    </select>
                </div>

                <div>
                    <label>Vocal Style</label>

                    <select id="vocal">
                        <option value="male">Male Vocals</option>
                        <option value="female">Female Vocals</option>
                    </select>
                </div>
            </div>

            <div class="form-row smart-controls">
                <div>
                    <label for="songMood">Song Mood</label>
                    <select id="songMood">
                        <option value="uplifting and energetic">Uplifting</option>
                        <option value="romantic and emotional">Romantic</option>
                        <option value="inspirational and motivational">Inspirational</option>
                        <option value="dark and intense">Dark</option>
                        <option value="chill and relaxing">Chill</option>
                        <option value="party-ready and vibrant">Party</option>
                        <option value="soulful and reflective">Soulful</option>
                    </select>
                </div>
                <div>
                    <label for="songTempo">Tempo</label>
                    <select id="songTempo">
                        <option value="mid-tempo">Mid-tempo</option>
                        <option value="slow">Slow</option>
                        <option value="upbeat">Upbeat</option>
                        <option value="fast">Fast</option>
                    </select>
                </div>
            </div>

            <label for="songInstruments">Preferred Bass / Rhythm (optional)</label>
            <select id="songInstruments">
                <option value="">No preference</option>
                <option value="log drum">Log drum</option>
                <option value="808 bass">808 bass</option>
                <option value="log drum and 808 bass">Log drum + 808 bass</option>
            </select>
                </div>

            </div>

            <label>AI Music Model</label>

            <select id="musicModel">
                <option value="auto">Automatic</option>
                <option value="mureka-7.6">Mureka 7.6</option>
                <option value="mureka-o2">Mureka O2</option>
                <option value="mureka-8">Mureka 8</option>
                <option value="mureka-9">Mureka 9</option>
                <option value="mureka-9.5">Mureka 9.5</option>
            </select>

            <button class="primary-btn" type="submit">
                ✨ GENERATE MUSIC
            </button>

        </form>

        <div id="generationStatus"></div>

    </div>


    <div class="generator-panel">

        <h2>🎹 INSTRUMENTAL</h2>

        <form id="instrumentalForm">

            <label for="instrumentalTitle">Instrumental Title</label>
            <input
                id="instrumentalTitle"
                type="text"
                maxlength="150"
                placeholder="Give your beat a name (e.g. Midnight Bounce)"
            >

            <label for="instrumentalPrompt">Describe Your Instrumental</label>

            <textarea
                id="instrumentalPrompt"
                maxlength="700"
                placeholder="Describe the beat you want, its energy, sound and musical direction..."
                required
            ></textarea>

            <div class="form-row smart-controls">
                <div>
                    <label for="instrumentalGenre">Beat Genre</label>
                    <select id="instrumentalGenre">
                        <option value="Afrobeats">Afrobeats</option>
                        <option value="Hip-Hop">Hip-Hop</option>
                        <option value="R&B">R&amp;B</option>
                        <option value="Blues">Blues</option>
                        <option value="Gospel">Gospel</option>
                        <option value="Amapiano">Amapiano</option>
                        <option value="Afro-fusion">Afro-fusion</option>
                        <option value="Highlife">Highlife</option>
                        <option value="Reggae">Reggae</option>
                        <option value="Dancehall">Dancehall</option>
                        <option value="Soul">Soul</option>
                        <option value="Jazz">Jazz</option>
                        <option value="Pop">Pop</option>
                        <option value="Drill">Drill</option>
                        <option value="Trap">Trap</option>
                        <option value="Electronic">Electronic</option>
                    </select>
                </div>
                <div>
                    <label for="instrumentalMood">Beat Mood</label>
                    <select id="instrumentalMood">
                        <option value="energetic and uplifting">Energetic</option>
                        <option value="dark and hard-hitting">Dark / Hard</option>
                        <option value="romantic and emotional">Romantic</option>
                        <option value="chill and relaxing">Chill</option>
                        <option value="inspirational and soulful">Inspirational</option>
                        <option value="party-ready and vibrant">Party</option>
                        <option value="smooth and soulful">Smooth</option>
                    </select>
                </div>
            </div>

            <div class="form-row smart-controls">
                <div>
                    <label for="instrumentalTempo">Tempo</label>
                    <select id="instrumentalTempo">
                        <option value="mid-tempo">Mid-tempo</option>
                        <option value="slow">Slow</option>
                        <option value="upbeat">Upbeat</option>
                        <option value="fast">Fast</option>
                    </select>
                </div>
                <div>
                    <label for="instrumentalInstruments">Bass / Rhythm</label>
                    <select id="instrumentalInstruments">
                        <option value="">No preference</option>
                        <option value="log drum">Log drum</option>
                        <option value="808 bass">808 bass</option>
                        <option value="log drum and 808 bass">Log drum + 808 bass</option>
                        <option value="deep sub bass">Deep sub bass</option>
                        <option value="live drums and percussion">Live drums / percussion</option>
                        <option value="piano and guitar">Piano / guitar</option>
                    </select>
                </div>
            </div>

            <label>AI Music Model</label>

            <select id="instrumentalModel">
                <option value="auto">Automatic</option>
                <option value="mureka-7.6">Mureka 7.6</option>
                <option value="mureka-8">Mureka 8</option>
                <option value="mureka-9">Mureka 9</option>
                <option value="mureka-9.5">Mureka 9.5</option>
            </select>

            <button class="primary-btn" type="submit">
                🎹 GENERATE INSTRUMENTAL
            </button>

        </form>

        <div id="instrumentalStatus"></div>

    </div>

</section>

`,


/* ======================================
   LYRICS STUDIO
====================================== */

lyrics: `

<section class="library lyrics-page">

    <h2>✍️ LYRICS STUDIO</h2>

    <div class="generator-panel">

        <form id="lyricsForm">

            <label>Song Theme</label>

            <textarea
                id="lyricsTheme"
                placeholder="What should your song be about?"
                required
            ></textarea>

            <label>Music Style</label>

            <select id="lyricsGenre">
                <option>Afrobeats</option>
                <option>Gospel</option>
                <option>Hip-Hop</option>
                <option>R&B</option>
                <option>Amapiano</option>
                <option>Reggae</option>
                <option>Highlife</option>
                <option>Pop</option>
            </select>

            <button class="primary-btn" type="submit">
                🎵 GENERATE LYRICS
            </button>

        </form>

    </div>

    <div id="lyricsResult"></div>

    <div class="tool-card lyrics-editor-card">

        <h3>📝 SONGWRITING WORKSPACE</h3>
        <p class="lyrics-workspace-note">Build your song section by section. Your draft is saved automatically on this device.</p>

        <div class="lyrics-structure-tools">
            <label for="lyricsStructure">Song Structure</label>
            <select id="lyricsStructure">
                <option value="Intro, Verse 1, Chorus, Verse 2, Chorus, Bridge, Final Chorus, Outro">Full song</option>
                <option value="Intro, Chorus, Verse 1, Chorus, Verse 2, Chorus, Outro">Hook-first</option>
                <option value="Verse 1, Chorus, Verse 2, Chorus">Short song</option>
                <option value="Verse 1, Verse 2, Verse 3">Rap verses</option>
                <option value="Intro, Verse 1, Pre-Chorus, Chorus, Verse 2, Pre-Chorus, Chorus, Bridge, Final Chorus, Outro">Pop structure</option>
            </select>
            <button class="primary-btn lyrics-action-btn" id="insertStructure" type="button">＋ INSERT FULL STRUCTURE</button>
        </div>

        <div class="lyrics-section-tools">
            <span>ADD SECTION:</span>
            <button type="button" data-lyrics-section="Intro">Intro</button>
            <button type="button" data-lyrics-section="Verse 1">Verse</button>
            <button type="button" data-lyrics-section="Pre-Chorus">Pre-Chorus</button>
            <button type="button" data-lyrics-section="Chorus">Chorus</button>
            <button type="button" data-lyrics-section="Bridge">Bridge</button>
            <button type="button" data-lyrics-section="Outro">Outro</button>
        </div>

        <textarea
            id="lyricsEditor"
            rows="14"
            placeholder="[INTRO]\nWrite your opening lines here...\n\n[VERSE 1]\n..."
        ></textarea>
        <div class="lyrics-editor-meta">
            <span id="lyricsWordCount">0 words · 0 characters</span>
            <span id="lyricsSaveStatus">Draft ready</span>
        </div>

        <div class="lyrics-actions">

            <button
                class="primary-btn lyrics-action-btn"
                id="copyLyrics"
                type="button"
            >
                📋 COPY LYRICS
            </button>

            <button
                class="primary-btn lyrics-action-btn"
                id="downloadLyrics"
                type="button"
            >
                ⬇️ DOWNLOAD LYRICS
            </button>

            <button
                class="primary-btn lyrics-action-btn"
                id="clearLyrics"
                type="button"
            >
                🗑️ CLEAR LYRICS
            </button>

        </div>

        <div id="lyricsEditorStatus"></div>

    </div>

</section>

`,


/* ======================================
   DRUM SEPARATION
====================================== */

drums: `

    <section class="library">

        <h2>🥁 DRUM SEPARATION STUDIO</h2>

        <p>
            Extract individual drum components from your music.
        </p>

        <div class="empty-state">

            <div>🥁</div>

            <h3>Upload Your Audio</h3>

            <p>Supported formats: MP3, M4A</p>

            <input
                type="file"
                id="drumUpload"
                accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a"
            >

            <div id="drumStatus"></div>

        </div>

        <div class="tools">

            <div class="tool-card">🥁<h3>Kick</h3></div>
            <div class="tool-card">🔊<h3>Snare</h3></div>
            <div class="tool-card">🎵<h3>Hi-hats</h3></div>
            <div class="tool-card">👏<h3>Claps</h3></div>
            <div class="tool-card">🎚️<h3>Toms</h3></div>
            <div class="tool-card">✨<h3>Cymbals</h3></div>
            <div class="tool-card">🎼<h3>Percussion</h3></div>

        </div>

        <button
            class="primary-btn"
            id="separateDrums"
            type="button"
        >
            SEPARATE ALL DRUMS
        </button>

        <div id="separationStatus"></div>

    </section>

`,


/* ======================================
   FULL STEM SEPARATION
====================================== */

stems: `

    <section class="library">

        <h2>🎚️ FULL STEM SEPARATION</h2>

        <p>
            Separate your music into individual audio tracks.
        </p>

        <div class="empty-state">

            <div>🎧</div>

            <h3>Upload an Audio File</h3>

            <p>Maximum upload size: 7 MB</p>

            <input
                type="file"
                id="stemUpload"
                accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a"
            >

            <div id="stemStatus"></div>

        </div>

        <div class="tools">

            <div class="tool-card">🎤<h3>Vocals</h3></div>
            <div class="tool-card">🥁<h3>Drums</h3></div>
            <div class="tool-card">🎸<h3>Bass</h3></div>
            <div class="tool-card">🎹<h3>Other Instruments</h3></div>

        </div>

        <button
            class="primary-btn"
            id="separateStems"
            type="button"
        >
            SEPARATE AUDIO STEMS
        </button>

        <div id="stemSeparationResult"></div>

    </section>

`,


/* ======================================
   MY MUSIC
====================================== */

music: `

    <section class="library music-library-page">

        <h2>📁 MY MUSIC</h2>

        <p>Your personal music collection.</p>

        <div id="musicCollection"></div>

    </section>

`,


/* ======================================
   MUSIC LIBRARY
====================================== */

library: `

    <section class="library music-library-page">

        <h2>▶️ MUSIC LIBRARY</h2>

        <p>Manage and play your music.</p>

        <div id="musicCollection"></div>

    </section>

`,


/* ======================================
   SETTINGS
====================================== */

settings: `

    <section class="library">
        <h2>⚙️ SETTINGS</h2>
        <div class="tool-card">
            <h3>Application</h3>
            <p>GENERAL MUSIC AI V1.0</p>
            <p>Manage your playback preferences below.</p>
        </div>
        <div class="tool-card">
            <h3>🔊 Default Playback Volume</h3>
            <label for="settingsVolume">Player volume</label>
            <input id="settingsVolume" type="range" min="0" max="1" step="0.01" value="0.8">
            <p id="settingsVolumeValue" aria-live="polite">80%</p>
        </div>
        <div class="tool-card">
            <h3>⏭️ Playback</h3>
            <label><input id="settingsAutoplayNext" type="checkbox" checked> Automatically play the next saved track</label>
            <p>When disabled, playback stops at the end of the current track.</p>
        </div>
        <div class="tool-card">
            <h3>💾 Your Music</h3>
            <p id="settingsMusicCount" aria-live="polite">Checking saved tracks...</p>
            <p>Your saved music is stored in this browser on this device.</p>
        </div>
        <div id="settingsStatus" role="status" aria-live="polite"></div>
    </section>

`

};

/* ==========================================
MUSIC COLLECTION: FAVORITES + PLAYLISTS
========================================== */

const FAVORITES_KEY = "gtp_music_favorites_v1";
const PLAYLISTS_KEY = "gtp_music_playlists_v1";
const RECENT_KEY = "gtp_music_recent_v1";
let collectionMode = "all";
let activePlaylistId = null;

function readCollectionData(key, fallback) {
    try {
        const value = JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
        return Array.isArray(value) ? value : fallback;
    } catch (error) {
        console.warn("Music collection storage error:", error);
        return fallback;
    }
}

function getFavorites() {
    return readCollectionData(FAVORITES_KEY, []);
}

function saveFavorites(items) {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify([...new Set(items.map(String))]));
}

function getCustomPlaylists() {
    return readCollectionData(PLAYLISTS_KEY, []);
}

function saveCustomPlaylists(items) {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(items));
}

const ALBUMS_KEY = "gtp_music_albums_v1";
let activeAlbumId = null;
function getMusicAlbums() {
    return readCollectionData(ALBUMS_KEY, []).map(album => ({ ...album, trackIds: Array.isArray(album.trackIds) ? album.trackIds : [] }));
}
function saveMusicAlbums(albums) {
    localStorage.setItem(ALBUMS_KEY, JSON.stringify(albums));
}


function getRecentlyPlayed() {
    return readCollectionData(RECENT_KEY, []);
}

function recordRecentlyPlayed(trackId) {
    const recent = getRecentlyPlayed().filter(id => String(id) !== String(trackId));
    recent.unshift(String(trackId));
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, 30)));
}

function isFavorite(trackId) {
    return getFavorites().includes(String(trackId));
}

function sortedTrackIdsForInlinePlayer(currentId) {
    const saved = getSavedTasks();
    let rows = saved;
    if (collectionMode === "favorites") rows = saved.filter(track => getFavorites().includes(String(track.id)));
    else if (collectionMode === "recent") rows = getRecentlyPlayed().map(id => saved.find(track => String(track.id) === String(id))).filter(Boolean);
    else if (collectionMode === "playlist") {
        const list = getCustomPlaylists().find(item => String(item.id) === String(activePlaylistId));
        rows = list ? list.trackIds.map(id => saved.find(track => String(track.id) === String(id))).filter(Boolean) : [];
    } else if (collectionMode === "album") {
        const album = getMusicAlbums().find(item => String(item.id) === String(activeAlbumId));
        rows = album ? album.trackIds.map(id => saved.find(track => String(track.id) === String(id))).filter(Boolean) : [];
    }
    return rows.filter(hasPlayableAudio).map(track => String(track.id));
}

function renderMusicCollection() {
    const collection = document.getElementById("musicCollection");
    if (!collection) return;

    const savedTasks = getSavedTasks();
    const playlists = getCustomPlaylists();
    const favorites = getFavorites();
    const recent = getRecentlyPlayed();
    const searchInput = document.getElementById("globalSearch");
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : "";

    let visibleTasks = savedTasks;
    if (collectionMode === "favorites") {
        visibleTasks = savedTasks.filter(song => favorites.includes(String(song.id)));
    } else if (collectionMode === "recent") {
        visibleTasks = recent.map(id => savedTasks.find(song => String(song.id) === String(id))).filter(Boolean);
    } else if (collectionMode === "playlist") {
        const playlist = playlists.find(item => String(item.id) === String(activePlaylistId));
        visibleTasks = playlist ? playlist.trackIds.map(id => savedTasks.find(song => String(song.id) === String(id))).filter(Boolean) : [];
    } else if (collectionMode === "album") {
        const album = getMusicAlbums().find(item => String(item.id) === String(activeAlbumId));
        visibleTasks = album ? album.trackIds.map(id => savedTasks.find(song => String(song.id) === String(id))).filter(Boolean) : [];
    }

    const filteredTasks = visibleTasks.filter(song => {
        const searchable = [song.title, song.type, song.artistName, song.albumName, song.genre, song.musicStyle].join(" ").toLowerCase();
        return searchable.includes(searchTerm);
    });
    const sortInput = document.getElementById("musicSort");
    const sortMode = sortInput ? sortInput.value : "newest";
    const sortedTasks = collectionMode === "album" ? [...filteredTasks] : [...filteredTasks].sort((a, b) => {
        const av = String(a[sortMode === "newest" || sortMode === "oldest" ? "createdAt" : sortMode] || "").toLowerCase();
        const bv = String(b[sortMode === "newest" || sortMode === "oldest" ? "createdAt" : sortMode] || "").toLowerCase();
        if (sortMode === "newest") return (Date.parse(bv) || 0) - (Date.parse(av) || 0);
        if (sortMode === "oldest") return (Date.parse(av) || 0) - (Date.parse(bv) || 0);
        return av.localeCompare(bv);
    });

    const playlistOptions = playlists.map(item =>
        '<option value="' + escapeHTML(item.id) + '">' + escapeHTML(item.name) + '</option>'
    ).join("");

    const tabs = [
        ["all", "ALL TRACKS"],
        ["favorites", "♥ FAVORITES"],
        ["recent", "RECENTLY PLAYED"],
        ["playlists", "PLAYLISTS"],
        ["albums", "💿 ALBUMS"]
    ];

    const toolbar = `
        <div class="collection-toolbar">
            <div class="collection-tabs">
                ${tabs.map(([mode, label]) => `
                    <button type="button" class="collection-tab ${collectionMode === mode || (mode === "playlists" && collectionMode === "playlist") ? "active" : ""}" data-collection-mode="${mode}">${label}</button>
                `).join("")}
            </div>
            <div class="collection-playlist-actions">
                <label class="primary-btn import-music-label" for="importMusicFiles">⬆️ IMPORT MUSIC</label>
                <input id="importMusicFiles" class="music-import-input" type="file" accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a" multiple>
                <button type="button" class="primary-btn" data-create-playlist>＋ CREATE PLAYLIST</button>
                <button type="button" class="primary-btn" data-create-album>＋ CREATE ALBUM</button>
            </div>
            ${collectionMode === "playlists" || collectionMode === "playlist" ? `
                <div class="collection-playlist-list">
                    ${playlists.length ? playlists.map(item => `
                        <div class="collection-playlist-item">
                            <button type="button" class="collection-playlist-chip ${String(item.id) === String(activePlaylistId) && collectionMode === "playlist" ? "active" : ""}" data-open-playlist="${escapeHTML(item.id)}">${item.coverImage ? '<span class="playlist-chip-cover" style="background-image:url(&quot;' + escapeHTML(item.coverImage) + '&quot; )"></span>' : '<span class="playlist-chip-cover playlist-chip-placeholder">♫</span>'}<span>${escapeHTML(item.name)} <small>${item.trackIds.length} tracks</small></span></button>
                            <button type="button" class="collection-action-btn" data-play-playlist="${escapeHTML(item.id)}">▶ PLAY</button>
                            <button type="button" class="collection-action-btn" data-shuffle-playlist="${escapeHTML(item.id)}">🔀 SHUFFLE</button>
                            <button type="button" class="collection-action-btn" data-rename-playlist="${escapeHTML(item.id)}">✏️ RENAME</button>
                            <button type="button" class="collection-action-btn" data-delete-playlist="${escapeHTML(item.id)}">🗑️ DELETE</button>
                        </div>
                    `).join("") : '<p class="collection-muted">Create a playlist to organise your music.</p>'}
                </div>            ` : ""}
            ${collectionMode === "albums" || collectionMode === "album" ? '<div class="album-library-grid">' + getMusicAlbums().map(album => '<div class="album-library-card">' +
                '<button type="button" class="album-open-button" data-open-album="' + escapeHTML(album.id) + '">' +
                (album.coverImage ? '<span class="album-mini-cover" style="background-image:url(&quot;' + escapeHTML(album.coverImage) + '&quot;)"></span>' : '<span class="album-mini-cover album-placeholder">💿</span>') +
                '<strong>' + escapeHTML(album.name) + '</strong><small>' + escapeHTML(album.artistName || "Various artists") + ' · ' + album.trackIds.length + ' tracks</small></button>' +
                '<div class="album-card-actions"><button type="button" class="collection-action-btn" data-play-album="' + escapeHTML(album.id) + '">▶ PLAY</button>' +
                '<label class="collection-action-btn album-cover-label" for="albumCover_' + escapeHTML(album.id) + '">🖼️ COVER</label>' +
                '<input class="music-cover-input" id="albumCover_' + escapeHTML(album.id) + '" type="file" accept="image/jpeg,image/png,image/webp" data-album-cover="' + escapeHTML(album.id) + '">' +
                '<button type="button" class="collection-action-btn" data-rename-album="' + escapeHTML(album.id) + '">✏️ EDIT</button>' +
                '<button type="button" class="collection-action-btn" data-delete-album="' + escapeHTML(album.id) + '">🗑️ DELETE</button></div></div>').join("") +
                (getMusicAlbums().length ? "" : '<p class="collection-muted">Create your first album to organise your tracks.</p>') + '</div>' : ""}
        </div>
    `;

    if (collectionMode === "albums" && !activeAlbumId) {
        collection.innerHTML = toolbar;
        return;
    }
    let playlistHeaderMarkup = "";
    if (collectionMode === "playlist") {
        const playlist = playlists.find(item => String(item.id) === String(activePlaylistId));
        if (!playlist) { collectionMode = "playlists"; activePlaylistId = null; renderMusicCollection(); return; }
        playlistHeaderMarkup = '<section class="playlist-detail-header">' + (playlist.coverImage ? '<div class="playlist-detail-cover" style="background-image:url(&quot;' + escapeHTML(playlist.coverImage) + '&quot;)"></div>' : '<div class="playlist-detail-cover playlist-chip-placeholder">♫</div>') + '<div class="playlist-detail-copy"><span class="album-kicker">PLAYLIST COLLECTION</span><h2>' + escapeHTML(playlist.name) + '</h2><p>' + playlist.trackIds.length + ' tracks · Your personal mix</p><div class="album-playback-actions"><button type="button" class="primary-btn" data-play-playlist="' + escapeHTML(playlist.id) + '">▶ PLAY PLAYLIST</button><button type="button" class="collection-action-btn" data-shuffle-playlist="' + escapeHTML(playlist.id) + '">🔀 SHUFFLE</button><label class="collection-action-btn playlist-cover-label" for="playlistCover_' + escapeHTML(playlist.id) + '">🖼️ CHANGE COVER</label><input class="music-cover-input" id="playlistCover_' + escapeHTML(playlist.id) + '" type="file" accept="image/jpeg,image/png,image/webp" data-playlist-cover="' + escapeHTML(playlist.id) + '"><button type="button" class="collection-action-btn" data-playlist-back>← ALL PLAYLISTS</button></div></div></section>';
    }

    let albumHeaderMarkup = "";
    if (collectionMode === "album") {
        const album = getMusicAlbums().find(item => String(item.id) === String(activeAlbumId));
        if (!album) { collectionMode = "albums"; activeAlbumId = null; renderMusicCollection(); return; }
        albumHeaderMarkup = '<section class="album-detail-header">' +
            (album.coverImage ? '<div class="album-detail-cover" style="background-image:url(&quot;' + escapeHTML(album.coverImage) + '&quot;)"></div>' : '<div class="album-detail-cover album-placeholder">💿</div>') +
            '<div class="album-detail-copy"><span class="album-kicker">ALBUM COLLECTION</span><h2>' + escapeHTML(album.name) + '</h2><p>' + escapeHTML(album.artistName || "Various artists") + ' · ' + album.trackIds.length + ' tracks</p>' +
            '<div class="album-playback-actions"><button type="button" class="primary-btn" data-play-album="' + escapeHTML(album.id) + '">▶ PLAY ALBUM</button><button type="button" class="collection-action-btn" data-shuffle-album="' + escapeHTML(album.id) + '">🔀 SHUFFLE</button><button type="button" class="collection-action-btn" data-edit-album="' + escapeHTML(album.id) + '">✏️ EDIT DETAILS</button><button type="button" class="collection-action-btn" data-album-back>← ALL ALBUMS</button></div></div></section>';
    }

    if (collectionMode === "playlists" && !activePlaylistId) {
        collection.innerHTML = toolbar + (playlists.length
            ? '<div class="collection-muted">Choose a playlist above to view its tracks.</div>'
            : '<div class="empty-state"><div>🎧</div><h3>No playlists yet</h3><p>Create your first playlist to organise your songs.</p></div>');
        return;
    }

    const sortToolbar = `<div class="music-sort-row"><label for="musicSort">SORT TRACKS</label><select id="musicSort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="title">Title</option><option value="artistName">Artist</option><option value="albumName">Album</option><option value="genre">Genre</option></select></div>`;

    if (sortedTasks.length === 0) {
        collection.innerHTML = toolbar + sortToolbar + `
            <div class="empty-state">
                <div>🎼</div>
                <h3>${savedTasks.length ? "No music found in this view" : "Your music collection is empty"}</h3>
                <p>${savedTasks.length ? "Try another collection tab or search." : "Your generated songs will appear here."}</p>
            </div>`;
        return;
    }

    const cards = sortedTasks.map(song => {
        const title = escapeHTML(song.title || "Untitled Song");
        const id = escapeHTML(song.id);
        const status = escapeHTML(song.status || "preparing");
        const isLocalAudio = Boolean(song.audioBlobId);
        const localAudioURL = isLocalAudio ? (localAudioURLs.get(String(song.audioBlobId)) || "") : "";
        const playableURL = safeAudioURL(song.audioUrl) || localAudioURL;
        const localAudioReady = !isLocalAudio || Boolean(localAudioURL);
        const favorite = favorites.includes(String(song.id));
        const isCurrentTrack = String(currentTrackId) === String(song.id);
        const isExpandedPlayer = false; // Keep the music list in its normal compact layout; full player opens on demand.
        const playableIds = sortedTasks.filter(track => hasPlayableAudio(track)).map(track => String(track.id));
        const currentQueueIndex = playableIds.indexOf(String(song.id));
        const previousId = currentQueueIndex > 0 ? playableIds[currentQueueIndex - 1] : (playableIds.length > 1 ? playableIds[playableIds.length - 1] : "");
        const nextId = currentQueueIndex >= 0 && playableIds.length > 1 ? playableIds[(currentQueueIndex + 1) % playableIds.length] : "";
        const downloadControl = playableURL
            ? `<a class="track-icon-btn" href="${escapeHTML(playableURL)}" download="${escapeHTML(song.importedFileName || (song.title || "music") + ".mp3")}" data-download-music="${id}" title="Download" aria-label="Download">⇩</a>`
            : `<button class="track-icon-btn" type="button" disabled title="Preparing download" aria-label="Preparing download">⇩</button>`;
        const controls = (safeAudioURL(song.audioUrl) || isLocalAudio) ? `
            <div class="music-card-controls compact-track-controls">
                ${isExpandedPlayer ? '<span class="inline-playing-badge">NOW PLAYING</span>' : `
                    <button class="track-icon-btn track-play-btn" type="button" data-play-music="${id}" ${localAudioReady ? "" : "disabled"} title="Play" aria-label="Play">${localAudioReady ? (isCurrentTrack && audioElement && !audioElement.paused ? "Ⅱ" : "▶") : "… "}</button>
                    ${downloadControl}
                `}
            </div>` : '<span class="track-unavailable">Audio not ready</span>';

        const coverMarkup = song.coverImage
            ? '<span class="compact-track-cover has-image" style="background-image:url(&quot;' + escapeHTML(song.coverImage) + '&quot;)"></span>'
            : '<span class="compact-track-cover">' + (song.type === "instrumental" ? "♫" : "♪") + '</span>';

        return `
            <article class="music-track-card compact-music-track">
                ${coverMarkup}
                <div class="compact-track-info" data-open-current-track="${isCurrentTrack ? id : ""}" role="${isCurrentTrack ? "button" : "group"}" tabindex="${isCurrentTrack ? "0" : "-1"}">
                    <strong class="compact-track-title">${title}</strong>
                    <span class="compact-track-subtitle">${escapeHTML(song.artistName || "Unknown artist")} · ${escapeHTML(song.genre || song.musicStyle || (song.type === "instrumental" ? "Instrumental" : "Music"))}</span>
                </div>
                ${controls}
                ${isExpandedPlayer ? `
                    <section class="inline-now-playing" aria-label="Now playing controls">
                        <div class="inline-now-playing-heading"><span>NOW PLAYING</span><span class="inline-playing-indicator">● LIVE</span></div>
                        <div class="inline-now-playing-track">${coverMarkup}<div><strong>${title}</strong><small>${escapeHTML(song.artistName || "Unknown artist")}</small></div></div>
                        <input class="inline-player-progress" type="range" min="0" max="100" step="0.1" value="${audioElement && audioElement.duration > 0 ? (audioElement.currentTime / audioElement.duration) * 100 : 0}" data-inline-progress aria-label="Seek through track">
                        <div class="inline-player-times"><span data-inline-current>${formatTime(audioElement ? audioElement.currentTime : 0)}</span><span data-inline-duration>${formatTime(audioElement ? audioElement.duration : 0)}</span></div>
                        <div class="inline-player-main-controls">
                            <button type="button" class="track-icon-btn" data-prev-music="${id}" title="Previous" aria-label="Previous">⏮</button>
                            <button type="button" class="inline-player-play" data-pause-music="${id}" title="${audioElement && !audioElement.paused ? "Pause" : "Play"}" aria-label="${audioElement && !audioElement.paused ? "Pause" : "Play"}">${audioElement && !audioElement.paused ? "Ⅱ" : "▶"}</button>
                            <button type="button" class="track-icon-btn" data-next-music="${id}" title="Next" aria-label="Next">⏭</button>
                            ${downloadControl}
                        </div>
                    </section>` : ""}
                <details class="compact-track-more" name="music-track-details">
                    <summary title="Track options" aria-label="Track options">•••</summary>
                    <div class="compact-track-options">
                        <span class="music-track-type">${song.type === "imported" ? "IMPORTED AUDIO" : song.type === "instrumental" ? "AI INSTRUMENTAL" : "FULL AI SONG"} · ${escapeHTML(status)}</span>
                        <p>Album: ${escapeHTML(song.albumName || "Single")} · Duration: <span data-track-duration="${id}">${song.durationSeconds ? formatTime(song.durationSeconds) : "—"}</span></p>
                        <details class="track-metadata-editor">
                            <summary>Edit track details</summary>
                            <label>Artist name<input type="text" maxlength="80" data-meta-field="artistName" value="${escapeHTML(song.artistName || "")}" placeholder="Artist / producer name"></label>
                            <label>Album name<input type="text" maxlength="100" data-meta-field="albumName" value="${escapeHTML(song.albumName || "")}" placeholder="Album or project name"></label>
                            <label>Genre / music style<input type="text" maxlength="60" data-meta-field="genre" value="${escapeHTML(song.genre || song.musicStyle || "")}" placeholder="e.g. Hip-Hop, R&B, Gospel"></label>
                            <button type="button" class="collection-action-btn" data-save-metadata="${id}">Save details</button>
                        </details>
                        <div class="music-card-actions">
                            <label class="collection-action-btn cover-upload-label" for="coverUpload_${id}">${song.coverImage ? "Change cover" : "Upload cover"}</label>
                            <input class="music-cover-input" id="coverUpload_${id}" type="file" accept="image/jpeg,image/png,image/webp" data-cover-upload="${id}">
                            <button type="button" class="collection-action-btn ${favorite ? "is-favorite" : ""}" data-toggle-favorite="${id}">${favorite ? "♥ Favorited" : "♡ Add to favorites"}</button>
                            <button type="button" class="collection-action-btn" data-queue-add="${id}">＋ Add to queue</button>
                            <button type="button" class="collection-action-btn" data-queue-next="${id}">⏭ Play next</button>
                            <button type="button" class="collection-action-btn" data-add-to-playlist="${id}">＋ Add to playlist</button>
                            ${collectionMode === "playlist" ? '<button type="button" class="collection-action-btn" data-remove-from-playlist="' + id + '">Remove from playlist</button><button type="button" class="collection-action-btn" data-playlist-move-up="' + id + '">↑ Move up</button><button type="button" class="collection-action-btn" data-playlist-move-down="' + id + '">↓ Move down</button>' : ""}
                            <button type="button" class="collection-action-btn" data-add-to-album="${id}">＋ Add to album</button>
                            ${collectionMode === "album" ? '<button type="button" class="collection-action-btn" data-remove-from-album="' + id + '">Remove from album</button><button type="button" class="collection-action-btn" data-album-move-up="' + id + '">↑ Move up</button><button type="button" class="collection-action-btn" data-album-move-down="' + id + '">↓ Move down</button>' : ""}
                            <button type="button" class="collection-action-btn" data-delete-music="${id}">Delete track</button>
                        </div>
                    </div>
                </details>
            </article>
        `;
    }).join("");

    collection.innerHTML = toolbar + playlistHeaderMarkup + albumHeaderMarkup + sortToolbar + '<div class="music-collection-grid">' + cards + '</div>';
}

/* IMPORT MP3 / M4A FILES INTO THE LOCAL MUSIC LIBRARY */
document.addEventListener("change", async event => {
 const input = event.target.closest("#importMusicFiles");
 if (!input || !input.files || !input.files.length) return;
 const files = Array.from(input.files); input.disabled = true; let imported = 0;
 try {
  for (const file of files) {
   const extension = (file.name.split(".").pop() || "").toLowerCase();
   if (!["mp3", "m4a"].includes(extension)) throw new Error(file.name + ": choose an MP3 or M4A file.");
   if (file.size > 20 * 1024 * 1024) throw new Error(file.name + ": file is larger than 20 MB.");
   if (!file.size) throw new Error(file.name + ": this file is empty.");
   const id = "local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
   await saveLocalAudio(id, file);
   const track = { id, title: file.name.replace(/\.(mp3|m4a)$/i, "").slice(0, 100) || "Imported Song", type: "imported", status: "ready", audioUrl: "", audioBlobId: id, importedFileName: file.name, artistName: "Imported Artist", albumName: "", genre: "", createdAt: new Date().toISOString() };
   const tasks = getSavedTasks(); tasks.unshift(track);
   if (!saveTasks(tasks)) { await deleteLocalAudio(id); throw new Error("Your browser music list is full. Remove unused tracks and try again."); }
   const url = await resolveTrackAudioURL(track); if (url) detectTrackDuration(id, url);
   imported++;
  }
  collectionMode = "all"; activeAlbumId = null; activePlaylistId = null; renderMusicCollection();
  alert(imported + (imported === 1 ? " song was" : " songs were") + " imported into MY MUSIC.");
 } catch (error) { alert(error.message || "Unable to import music."); renderMusicCollection(); }
 finally { input.disabled = false; input.value = ""; }
});

/* DOWNLOAD A LOCALLY IMPORTED TRACK */
document.addEventListener("click", async event => {
 const button = event.target.closest("[data-download-local]"); if (!button) return;
 button.disabled = true;
 try {
  const track = getSavedTasks().find(item => String(item.id) === String(button.dataset.downloadLocal));
  const saved = track && track.audioBlobId ? await getLocalAudio(track.audioBlobId) : null;
  if (!saved || !saved.blob) throw new Error("The imported audio file is no longer available.");
  const url = URL.createObjectURL(saved.blob); const link = document.createElement("a");
  link.href = url; link.download = saved.name || ((track.title || "music") + ".mp3");
  document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
 } catch (error) { alert(error.message || "Unable to download this track."); }
 finally { button.disabled = false; }
});
/* TRACK SORTING */
document.addEventListener("change", event => {
    if (event.target && event.target.id === "musicSort") renderMusicCollection();
});

/* AUTOMATIC TRACK DURATION DETECTION */
const durationChecks = new Set();
function detectTrackDuration(trackId, audioURL) {
    if (!trackId || !audioURL || durationChecks.has(String(trackId))) return;
    durationChecks.add(String(trackId));
    const probe = new Audio();
    probe.preload = "metadata";
    probe.addEventListener("loadedmetadata", () => {
        if (!Number.isFinite(probe.duration) || probe.duration <= 0) return;
        const tasks = getSavedTasks();
        const track = tasks.find(item => String(item.id) === String(trackId));
        if (track && !track.durationSeconds) {
            track.durationSeconds = Math.round(probe.duration);
            saveTasks(tasks);
            // Update only the duration label. Re-rendering the whole collection
            // here was rebuilding the tapped button/card while audio metadata loaded.
            const durationLabel = document.querySelector(
                '[data-track-duration="' + String(trackId).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"]'
            );
            if (durationLabel) durationLabel.textContent = formatTime(track.durationSeconds);
        }
        probe.src = "";
    }, { once: true });
    probe.addEventListener("error", () => durationChecks.delete(String(trackId)), { once: true });
    probe.src = audioURL;
}
document.addEventListener("DOMContentLoaded", () => {
    getSavedTasks().forEach(track => {
        const url = safeAudioURL(track.audioUrl);
        if (url && !track.durationSeconds) detectTrackDuration(track.id, url);
    });
});

/* ALBUM COVER UPLOAD */
document.addEventListener("change", async event => {
    const input = event.target.closest("[data-album-cover]");
    if (!input || !input.files || !input.files[0]) return;
    input.disabled = true;
    try {
        const coverImage = await compressCoverImage(input.files[0]);
        const albums = getMusicAlbums(), album = albums.find(item => String(item.id) === String(input.dataset.albumCover));
        if (!album) throw new Error("Album not found.");
        album.coverImage = coverImage; saveMusicAlbums(albums); renderMusicCollection();
    } catch (error) { alert(error.message || "Unable to save album artwork."); input.disabled = false; }
});

/* PLAYLIST COVER ARTWORK */
document.addEventListener("change", async event => {
    const input = event.target.closest("[data-playlist-cover]");
    if (!input || !input.files || !input.files[0]) return;
    input.disabled = true;
    try {
        const coverImage = await compressCoverImage(input.files[0]);
        const playlists = getCustomPlaylists();
        const playlist = playlists.find(item => String(item.id) === String(input.dataset.playlistCover));
        if (!playlist) throw new Error("Playlist not found.");
        playlist.coverImage = coverImage;
        saveCustomPlaylists(playlists);
        renderMusicCollection();
    } catch (error) {
        alert(error.message || "Unable to save playlist artwork.");
        input.disabled = false;
    }
});

/* TRACK COVER ARTWORK */
async function compressCoverImage(file) {
    if (!file || !/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Choose a JPG, PNG or WebP image.");
    if (file.size > 5 * 1024 * 1024) throw new Error("Please choose an image smaller than 5 MB.");
    const sourceURL = URL.createObjectURL(file);
    try {
        const image = new Image(); image.src = sourceURL;
        await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("This image could not be opened.")); });
        const canvas = document.createElement("canvas");
        const scale = Math.min(512 / image.width, 512 / image.height, 1);
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.78);
    } finally { URL.revokeObjectURL(sourceURL); }
}
document.addEventListener("change", async event => {
    const input = event.target.closest("[data-cover-upload]");
    if (!input || !input.files || !input.files[0]) return;
    const trackId = String(input.dataset.coverUpload);
    input.disabled = true;
    try {
        const coverImage = await compressCoverImage(input.files[0]);
        const tasks = getSavedTasks();
        const track = tasks.find(item => String(item.id) === trackId);
        if (!track) throw new Error("This music track could not be found.");
        track.coverImage = coverImage;
        if (!saveTasks(tasks)) throw new Error("Your browser could not save this cover. Try a smaller image.");
        if (String(currentTrackId) === trackId) updatePlayerInformation(track);
        renderMusicCollection();
    } catch (error) { alert(error.message || "Unable to save this cover image."); input.disabled = false; }
});

/* ==========================================
GLOBAL SEARCH
========================================== */

function initializeGlobalSearch() {
const searchInput = document.getElementById("globalSearch");

if (!searchInput) return;

searchInput.addEventListener("input", () => {
    if (currentPage === "music" || currentPage === "library") {
        renderMusicCollection();
    }
});

}

/* ==========================================
PLAY / DELETE / DOWNLOAD EVENTS
========================================== */

document.addEventListener("input", event => {
    const fullSeek = event.target.closest("[data-full-progress]");
    if (fullSeek && audioElement && Number.isFinite(audioElement.duration) && audioElement.duration > 0) { audioElement.currentTime = (Number(fullSeek.value) / 100) * audioElement.duration; return; }
    const seek = event.target.closest("[data-inline-progress]");
    if (!seek || !audioElement || !Number.isFinite(audioElement.duration) || audioElement.duration <= 0) return;
    audioElement.currentTime = (Number(seek.value) / 100) * audioElement.duration;
});

document.addEventListener("click", async event => {

if(event.target.closest("#queueToggle")){event.preventDefault();openPlaybackQueue();updateSleepTimerDisplay();return;}
const sleepPreset=event.target.closest("[data-sleep-minutes]");
if(sleepPreset){event.preventDefault();startSleepTimer(sleepPreset.dataset.sleepMinutes);return;}
if(event.target.closest("[data-sleep-custom]")){event.preventDefault();const entered=prompt("Stop playback after how many minutes? (1–720)","20");if(entered!==null&&entered.trim()!=="")startSleepTimer(entered);return;}
if(event.target.closest("[data-sleep-cancel]")){event.preventDefault();stopSleepTimer();return;}
if(event.target.closest("[data-queue-close]")){closePlaybackQueue();return;}
const qAdd=event.target.closest("[data-queue-add]");
if(qAdd){event.preventDefault();addTrackToQueue(qAdd.dataset.queueAdd,false);qAdd.textContent="✓ Added to queue";return;}
const qNext=event.target.closest("[data-queue-next]");
if(qNext){event.preventDefault();addTrackToQueue(qNext.dataset.queueNext,true);qNext.textContent="✓ Playing next";return;}
const qPlay=event.target.closest("[data-queue-play]");
if(qPlay){event.preventDefault();await playTrack(qPlay.dataset.queuePlay);renderPlaybackQueue();updatePlayButton();return;}
const qUp=event.target.closest("[data-queue-up]");
if(qUp){event.preventDefault();moveQueueTrack(qUp.dataset.queueUp,-1);return;}
const qDown=event.target.closest("[data-queue-down]");
if(qDown){event.preventDefault();moveQueueTrack(qDown.dataset.queueDown,1);return;}
const qRemove=event.target.closest("[data-queue-remove]");
if(qRemove){event.preventDefault();if(String(qRemove.dataset.queueRemove)===String(currentTrackId))return;refreshPlaylist();playbackQueueIds=playerPlaylist.map(t=>String(t.id)).filter(id=>id!==String(qRemove.dataset.queueRemove));savePlaybackQueue();renderPlaybackQueue();return;}
if(event.target.closest("[data-queue-clear]")){playbackQueueIds=currentTrackId?[String(currentTrackId)]:[];savePlaybackQueue();refreshPlaylist();renderPlaybackQueue();return;}

const miniPlayer = event.target.closest(".player .now-playing");
if (miniPlayer && currentTrackId) { event.preventDefault(); if (currentPage !== "nowplaying") { nowPlayingReturnPage = currentPage; nowPlayingReturnScrollY = window.scrollY || window.pageYOffset || 0; } navigate("nowplaying"); return; }
const fullPlayerArtwork = event.target.closest(".full-player-art");
if (fullPlayerArtwork && currentPage === "nowplaying") { event.preventDefault(); navigate(nowPlayingReturnPage || "music"); requestAnimationFrame(() => window.scrollTo(0, nowPlayingReturnScrollY)); return; }
const fullPlayerSurface = event.target.closest(".full-player-content");
if (fullPlayerSurface && currentPage === "nowplaying" && !event.target.closest("button,a,input")) { event.preventDefault(); navigate(nowPlayingReturnPage || "music"); requestAnimationFrame(() => window.scrollTo(0, nowPlayingReturnScrollY)); return; }
const openCurrentTrack = event.target.closest("[data-open-current-track]");
if (openCurrentTrack && currentTrackId && String(openCurrentTrack.dataset.openCurrentTrack) === String(currentTrackId)) {
    event.preventDefault(); if (currentPage !== "nowplaying") { nowPlayingReturnPage = currentPage; nowPlayingReturnScrollY = window.scrollY || window.pageYOffset || 0; } navigate("nowplaying"); return;
}
if (event.target.closest("[data-full-toggle]")) { event.preventDefault(); await togglePlayback(); renderNowPlayingPage(); return; }
if (event.target.closest("[data-full-next]")) { event.preventDefault(); await playNextTrack(); renderNowPlayingPage(); return; }
if (event.target.closest("[data-full-previous]")) { event.preventDefault(); await playPreviousTrack(); renderNowPlayingPage(); return; }
const metadataButton = event.target.closest("[data-save-metadata]");
if (metadataButton) {
    const card = metadataButton.closest(".music-track-card");
    const trackId = String(metadataButton.dataset.saveMetadata);
    const fields = card ? card.querySelectorAll("[data-meta-field]") : [];
    const tasks = getSavedTasks();
    const track = tasks.find(item => String(item.id) === trackId);
    if (!track) { alert("This track could not be found."); return; }
    fields.forEach(field => { track[field.dataset.metaField] = field.value.trim(); });
    track.metadataUpdatedAt = new Date().toISOString();
    if (!saveTasks(tasks)) { alert("Unable to save track details. Your browser storage may be full."); return; }
    renderMusicCollection();
    return;
}

const playButton = event.target.closest("[data-play-music]");

if (playButton) {
    event.preventDefault();
    event.stopPropagation();

    if (collectionMode === "album" && activeAlbumId) {
        const album = getMusicAlbums().find(item => String(item.id) === String(activeAlbumId));
        playbackQueueIds = album ? [...album.trackIds].map(String) : null;
        savePlaybackQueue();
    } else if (collectionMode === "playlist" && activePlaylistId) {
        const playlist = getCustomPlaylists().find(item => String(item.id) === String(activePlaylistId));
        playbackQueueIds = playlist ? [...playlist.trackIds].map(String) : null;
        savePlaybackQueue();
    } else {
        playbackQueueIds = null;
    }

    const trackId = String(playButton.dataset.playMusic);

    // The compact row is a true Play/Pause toggle for the currently loaded song.
    if (String(currentTrackId) === trackId && audioElement) {
        if (audioElement.paused) {
            try { await audioElement.play(); }
            catch (error) { console.error("Playback error:", error); }
        } else {
            audioElement.pause();
        }
    } else {
        recordRecentlyPlayed(trackId);
        await playTrack(trackId);
    }

    // Refresh the compact row icon to match the real audio playback state.
    renderMusicCollection();
    updatePlayerPlayState();
    return;
}

const pauseInlineButton = event.target.closest("[data-pause-music]");
if (pauseInlineButton) {
    event.preventDefault();
    if (audioElement && String(currentTrackId) === String(pauseInlineButton.dataset.pauseMusic)) {
        if (audioElement.paused) {
            try { await audioElement.play(); } catch (error) { console.error("Playback error:", error); }
        } else {
            audioElement.pause();
        }
        renderMusicCollection();
    }
    return;
}

const previousInlineButton = event.target.closest("[data-prev-music]");
if (previousInlineButton) {
    event.preventDefault();
    const id = String(previousInlineButton.dataset.prevMusic);
    const visibleIds = sortedTrackIdsForInlinePlayer(id);
    if (visibleIds.length) {
        playbackQueueIds = visibleIds.map(String);
        savePlaybackQueue();
        refreshPlaylist();
        await playPreviousTrack();
        renderMusicCollection();
    }
    return;
}

const nextInlineButton = event.target.closest("[data-next-music]");
if (nextInlineButton) {
    event.preventDefault();
    const id = String(nextInlineButton.dataset.nextMusic);
    const visibleIds = sortedTrackIdsForInlinePlayer(id);
    if (visibleIds.length) {
        playbackQueueIds = visibleIds.map(String);
        savePlaybackQueue();
        refreshPlaylist();
        await playNextTrack();
        renderMusicCollection();
    }
    return;
}

const playAlbumButton = event.target.closest("[data-play-album]");
const shuffleAlbumButton = event.target.closest("[data-shuffle-album]");
if (playAlbumButton || shuffleAlbumButton) {
    const button = playAlbumButton || shuffleAlbumButton;
    const album = getMusicAlbums().find(item => String(item.id) === String(button.dataset.playAlbum || button.dataset.shuffleAlbum));
    if (!album) return;
    const playableIds = album.trackIds.filter(id => getSavedTasks().some(track => String(track.id) === String(id) && hasPlayableAudio(track)));
    if (!playableIds.length) {
        alert("This album has no playable tracks yet.");
        return;
    }
    if (shuffleAlbumButton) {
        for (let i = playableIds.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [playableIds[i], playableIds[j]] = [playableIds[j], playableIds[i]];
        }
    }
    playbackQueueIds = playableIds.map(String);
    savePlaybackQueue();
    await playTrack(playableIds[0]);
    renderMusicCollection();
    return;
}

const modeButton = event.target.closest("[data-collection-mode]");
if (modeButton) {
    collectionMode = modeButton.dataset.collectionMode;
    activePlaylistId = null;
    activeAlbumId = null;
    renderMusicCollection();
    return;
}

const playlistButton = event.target.closest("[data-open-playlist]");
if (playlistButton) {
    activePlaylistId = playlistButton.dataset.openPlaylist;
    collectionMode = "playlist";
    renderMusicCollection();
    return;
}

const openAlbum = event.target.closest("[data-open-album]");
if (openAlbum) { activeAlbumId = openAlbum.dataset.openAlbum; collectionMode = "album"; renderMusicCollection(); return; }

const createAlbum = event.target.closest("[data-create-album]");
if (createAlbum) {
    const name = prompt("Enter an album name:");
    if (name && name.trim()) {
        const artistName = prompt("Artist name (optional):", "");
        const albums = getMusicAlbums();
        albums.unshift({ id: "album_" + Date.now(), name: name.trim().slice(0,80), artistName: artistName === null ? "" : artistName.trim().slice(0,80), coverImage: "", trackIds: [], createdAt: new Date().toISOString() });
        saveMusicAlbums(albums); collectionMode = "albums"; activeAlbumId = null; renderMusicCollection();
    }
    return;
}

const albumBackButton = event.target.closest("[data-album-back]");
if (albumBackButton) { activeAlbumId = null; collectionMode = "albums"; renderMusicCollection(); return; }

const editAlbumButton = event.target.closest("[data-edit-album]");
if (editAlbumButton) {
    const albums = getMusicAlbums();
    const album = albums.find(item => String(item.id) === String(editAlbumButton.dataset.editAlbum));
    if (album) {
        const name = prompt("Album name:", album.name);
        if (name && name.trim()) {
            const artistName = prompt("Artist name (optional):", album.artistName || "");
            album.name = name.trim().slice(0, 80);
            if (artistName !== null) album.artistName = artistName.trim().slice(0, 80);
            saveMusicAlbums(albums);
            renderMusicCollection();
        }
    }
    return;
}

const renameAlbum = event.target.closest("[data-rename-album]");
if (renameAlbum) {
    const albums = getMusicAlbums(), album = albums.find(item => String(item.id) === String(renameAlbum.dataset.renameAlbum));
    if (album) { const name = prompt("Edit album name:", album.name); if (name && name.trim()) { album.name = name.trim().slice(0,80); saveMusicAlbums(albums); renderMusicCollection(); } }
    return;
}

const deleteAlbum = event.target.closest("[data-delete-album]");
if (deleteAlbum) {
    if (confirm("Delete this album? Your tracks will remain in My Music.")) {
        saveMusicAlbums(getMusicAlbums().filter(item => String(item.id) !== String(deleteAlbum.dataset.deleteAlbum)));
        if (String(activeAlbumId) === String(deleteAlbum.dataset.deleteAlbum)) { activeAlbumId = null; collectionMode = "albums"; }
        renderMusicCollection();
    }
    return;
}

const addToAlbum = event.target.closest("[data-add-to-album]");
if (addToAlbum) {
    const albums = getMusicAlbums();
    if (!albums.length) { alert("Create an album first."); return; }
    const answer = prompt("Choose album number:\n" + albums.map((a,i) => (i+1) + ". " + a.name).join("\n"));
    const index = Number(answer) - 1;
    if (answer !== null && Number.isInteger(index) && albums[index]) {
        const ids = albums[index].trackIds;
        if (!ids.some(id => String(id) === String(addToAlbum.dataset.addToAlbum))) ids.push(String(addToAlbum.dataset.addToAlbum));
        saveMusicAlbums(albums); renderMusicCollection();
    }
    return;
}

const removeAlbumTrack = event.target.closest("[data-remove-from-album]");
if (removeAlbumTrack) {
    const albums = getMusicAlbums(), album = albums.find(item => String(item.id) === String(activeAlbumId));
    if (album) { album.trackIds = album.trackIds.filter(id => String(id) !== String(removeAlbumTrack.dataset.removeFromAlbum)); saveMusicAlbums(albums); renderMusicCollection(); }
    return;
}

const moveAlbumUp = event.target.closest("[data-album-move-up]");
const moveAlbumDown = event.target.closest("[data-album-move-down]");
if (moveAlbumUp || moveAlbumDown) {
    const button = moveAlbumUp || moveAlbumDown, albums = getMusicAlbums();
    const album = albums.find(item => String(item.id) === String(activeAlbumId));
    if (album) {
        const trackId = button.dataset.albumMoveUp || button.dataset.albumMoveDown;
        const index = album.trackIds.findIndex(id => String(id) === String(trackId));
        const target = index + (moveAlbumUp ? -1 : 1);
        if (index >= 0 && target >= 0 && target < album.trackIds.length) {
            [album.trackIds[index], album.trackIds[target]] = [album.trackIds[target], album.trackIds[index]];
            saveMusicAlbums(albums); renderMusicCollection();
        }
    }
    return;
}

const movePlaylistUp = event.target.closest("[data-playlist-move-up]");
const movePlaylistDown = event.target.closest("[data-playlist-move-down]");
if (movePlaylistUp || movePlaylistDown) {
    const button = movePlaylistUp || movePlaylistDown;
    const playlists = getCustomPlaylists();
    const playlist = playlists.find(item => String(item.id) === String(activePlaylistId));
    if (playlist) {
        playlist.trackIds = Array.isArray(playlist.trackIds) ? playlist.trackIds : [];
        const trackId = button.dataset.playlistMoveUp || button.dataset.playlistMoveDown;
        const index = playlist.trackIds.findIndex(id => String(id) === String(trackId));
        const target = index + (movePlaylistUp ? -1 : 1);
        if (index >= 0 && target >= 0 && target < playlist.trackIds.length) {
            [playlist.trackIds[index], playlist.trackIds[target]] = [playlist.trackIds[target], playlist.trackIds[index]];
            saveCustomPlaylists(playlists);
            playbackQueueIds = [...playlist.trackIds];
            renderMusicCollection();
        }
    }
    return;
}

const createPlaylistButton = event.target.closest("[data-create-playlist]");
if (createPlaylistButton) {
    const name = prompt("Enter a name for your new playlist:");
    if (name && name.trim()) {
        const playlists = getCustomPlaylists();
        playlists.push({ id: "playlist_" + Date.now(), name: name.trim().slice(0, 50), coverImage: "", trackIds: [], createdAt: new Date().toISOString() });
        saveCustomPlaylists(playlists);
        collectionMode = "playlists";
        activePlaylistId = null;
        renderMusicCollection();
    }
    return;
}

const playPlaylistButton = event.target.closest("[data-play-playlist]");
const shufflePlaylistButton = event.target.closest("[data-shuffle-playlist]");
if (playPlaylistButton || shufflePlaylistButton) {
    const button = playPlaylistButton || shufflePlaylistButton;
    const playlist = getCustomPlaylists().find(item => String(item.id) === String(button.dataset.playPlaylist || button.dataset.shufflePlaylist));
    let playableIds = playlist ? (playlist.trackIds || []).filter(id => getSavedTasks().some(track => String(track.id) === String(id) && hasPlayableAudio(track))) : [];
    if (!playableIds.length) { alert("This playlist has no playable tracks yet."); return; }
    if (shufflePlaylistButton) playableIds = playableIds.slice().sort(() => Math.random() - 0.5);
    playbackQueueIds = playableIds.map(String);
    savePlaybackQueue();
    recordRecentlyPlayed(playableIds[0]);
    await playTrack(playableIds[0]);
    return;
}

const playlistBackButton = event.target.closest("[data-playlist-back]");
if (playlistBackButton) { activePlaylistId = null; collectionMode = "playlists"; renderMusicCollection(); return; }
const renamePlaylistButton = event.target.closest("[data-rename-playlist]");
if (renamePlaylistButton) {
    const playlists = getCustomPlaylists();
    const playlist = playlists.find(item => String(item.id) === String(renamePlaylistButton.dataset.renamePlaylist));
    if (playlist) {
        const name = prompt("Enter a new playlist name:", playlist.name);
        if (name && name.trim()) { playlist.name = name.trim().slice(0, 50); saveCustomPlaylists(playlists); renderMusicCollection(); }
    }
    return;
}

const deletePlaylistButton = event.target.closest("[data-delete-playlist]");
if (deletePlaylistButton) {
    const id = String(deletePlaylistButton.dataset.deletePlaylist);
    const playlist = getCustomPlaylists().find(item => String(item.id) === id);
    if (playlist && confirm('Delete the playlist "' + playlist.name + '"? Your original music tracks will remain in MY MUSIC.')) {
        saveCustomPlaylists(getCustomPlaylists().filter(item => String(item.id) !== id));
        if (String(activePlaylistId) === id) { activePlaylistId = null; collectionMode = "playlists"; }
        playbackQueueIds = null;
        renderMusicCollection();
    }
    return;
}

const favoriteButton = event.target.closest("[data-toggle-favorite]");
if (favoriteButton) {
    const id = String(favoriteButton.dataset.toggleFavorite);
    const favorites = getFavorites();
    saveFavorites(favorites.includes(id) ? favorites.filter(item => item !== id) : [...favorites, id]);
    renderMusicCollection();
    return;
}

const addToPlaylistButton = event.target.closest("[data-add-to-playlist]");
if (addToPlaylistButton) {
    const playlists = getCustomPlaylists();
    if (!playlists.length) {
        alert("Create a playlist first, then add tracks to it.");
        return;
    }
    const choices = playlists.map((item, index) => (index + 1) + ". " + item.name).join("\\n");
    const answer = prompt("Choose a playlist number:\\n" + choices);
    const index = Number(answer) - 1;
    if (answer !== null && Number.isInteger(index) && playlists[index]) {
        const ids = playlists[index].trackIds || [];
        if (!ids.some(item => String(item) === String(addToPlaylistButton.dataset.addToPlaylist))) {
            ids.push(String(addToPlaylistButton.dataset.addToPlaylist));
        }
        playlists[index].trackIds = ids;
        saveCustomPlaylists(playlists);
        renderMusicCollection();
    }
    return;
}

const removeFromPlaylistButton = event.target.closest("[data-remove-from-playlist]");
if (removeFromPlaylistButton) {
    const playlists = getCustomPlaylists();
    const playlist = playlists.find(item => String(item.id) === String(activePlaylistId));
    if (playlist) {
        playlist.trackIds = playlist.trackIds.filter(id => String(id) !== String(removeFromPlaylistButton.dataset.removeFromPlaylist));
        saveCustomPlaylists(playlists);
        if (String(activePlaylistId) === String(playlist.id)) playbackQueueIds = [...playlist.trackIds];
        renderMusicCollection();
    }
    return;
}

const downloadLink = event.target.closest("[data-download-music]");

if (downloadLink) {
    recordDownload();
    return;
}

const deleteButton = event.target.closest("[data-delete-music]");

if (!deleteButton) return;

const id = deleteButton.dataset.deleteMusic;

if (!confirm("Are you sure you want to delete this track?")) {
    return;
}

if (String(currentTrackId) === String(id)) {
    if (audioElement) {
        audioElement.pause();
        audioElement.removeAttribute("src");
        audioElement.load();
    }

    currentTrackId = null;
    currentTrackIndex = -1;

    if (playerElements.title) {
        playerElements.title.textContent = "No song playing";
    }

    if (playerElements.artist) {
        playerElements.artist.textContent = "GENERAL MUSIC AI";
    }

    if (playerElements.cover) {
        playerElements.cover.textContent = "🎵";
    }

    updatePlayerProgress();
    updatePlayButton();
}

saveFavorites(getFavorites().filter(item => item !== String(id)));
const recentTracks = getRecentlyPlayed().filter(item => item !== String(id));
localStorage.setItem(RECENT_KEY, JSON.stringify(recentTracks));
const deletedTrack = getSavedTasks().find(item => String(item.id) === String(id));
if (deletedTrack && deletedTrack.audioBlobId) {
    const blobId = String(deletedTrack.audioBlobId);
    deleteLocalAudio(blobId).catch(error => console.warn("Local audio cleanup:", error));
    const cachedURL = localAudioURLs.get(blobId);
    if (cachedURL) { URL.revokeObjectURL(cachedURL); localAudioURLs.delete(blobId); }
}
const playlistsAfterDelete = getCustomPlaylists().map(item => ({
    ...item,
    trackIds: (item.trackIds || []).filter(trackId => String(trackId) !== String(id))
}));
saveCustomPlaylists(playlistsAfterDelete);
saveMusicAlbums(getMusicAlbums().map(album => ({ ...album, trackIds: album.trackIds.filter(trackId => String(trackId) !== String(id)) })));

const tasks = getSavedTasks().filter(
    song => String(song.id) !== String(id)
);

saveTasks(tasks);

refreshPlaylist();

renderMusicCollection();

updateDashboardStatistics();

});

/* ==========================================
AUDIO URL EXTRACTION
========================================== */

function getTaskAudioURL(task) {
if (
!task ||
!Array.isArray(task.choices) ||
task.choices.length === 0
) {
return "";
}

const choice = task.choices[0];

const possibleURLs = [
    choice.wav_url,
    choice.mp3_url,
    choice.audio_url,
    choice.url
];

for (const value of possibleURLs) {
    const safeURL = safeAudioURL(value);

    if (safeURL) return safeURL;
}

return "";

}

/* ==========================================
MUSIC TASK STATUS CHECKER
========================================== */

async function checkMusicTask(
taskId,
statusElement,
title,
type = "song"
) {
const terminalStatuses = [
"succeeded",
"failed",
"timeouted",
"cancelled"
];

const maxAttempts = 60;

let attempts = 0;

while (attempts < maxAttempts) {
    attempts++;

    try {
        const response = await fetch(
            `/api/music/task/${encodeURIComponent(type)}/${encodeURIComponent(taskId)}`
        );

        const result = await readAPIResponse(response);

        if (!response.ok) {
            throw new Error(
                result.message || "Unable to check task status."
            );
        }

        const task = result.task || result;

        const taskStatus = String(
            task.status || "processing"
        ).toLowerCase();

        const audioUrl = taskStatus === "succeeded"
            ? getTaskAudioURL(task)
            : "";

        const updatedTasks = getSavedTasks().map(item => {
            if (String(item.id) !== String(taskId)) {
                return item;
            }

            return {
                ...item,
                status: taskStatus,
                ...(audioUrl ? { audioUrl } : {})
            };
        });

        saveTasks(updatedTasks);

        refreshPlaylist();

        if (
            currentPage === "music" ||
            currentPage === "library"
        ) {
            renderMusicCollection();
        }

        if (
            statusElement &&
            statusElement.isConnected
        ) {
            statusElement.innerHTML = `

                <div class="tool-card">

                    <h3>🎵 ${escapeHTML(title)}</h3>

                    <p>
                        Generation status:
                        ${escapeHTML(taskStatus)}
                    </p>

                    <p>
                        Check ${attempts} of ${maxAttempts}
                    </p>

                </div>

            `;
        }

        if (terminalStatuses.includes(taskStatus)) {
            if (
                statusElement &&
                statusElement.isConnected
            ) {
                statusElement.innerHTML = `

                    <div class="tool-card">

                        <h3>
                            ${taskStatus === "succeeded"
                                ? "✅ GENERATION COMPLETED"
                                : "⚠️ GENERATION ENDED"
                            }
                        </h3>

                        <p>${escapeHTML(title)}</p>

                        <p>
                            Status:
                            ${escapeHTML(taskStatus)}
                        </p>

                        ${audioUrl
                            ? "<p>🎧 Your audio is ready. Open My Music to play it.</p>"
                            : taskStatus === "succeeded"
                                ? "<p>The audio link was not found in the returned result.</p>"
                                : ""
                        }

                    </div>

                `;
            }

            return;
        }

    } catch (error) {
        if (
            statusElement &&
            statusElement.isConnected
        ) {
            statusElement.innerHTML = `

                <div class="tool-card">

                    <h3>⚠️ STATUS CHECK ERROR</h3>

                    <p>${escapeHTML(error.message)}</p>

                </div>

            `;
        }

        console.error("Music task error:", error);

        return;
    }

    await new Promise(resolve => setTimeout(resolve, 10000));
}

if (
    statusElement &&
    statusElement.isConnected
) {
    statusElement.innerHTML = `

        <div class="tool-card">

            <h3>⏳ STILL PROCESSING</h3>

            <p>
                The task has not finished checking yet.
            </p>

            <p>
                You can check your music library later.
            </p>

        </div>

    `;
}

}

/* ==========================================
AUDIO UPLOAD HANDLER
========================================== */

function handleAudioUpload(inputId, statusId) {
const input = document.getElementById(inputId);
const status = document.getElementById(statusId);

if (!input || !status) return;

input.addEventListener("change", () => {
    const file = input.files[0];

    if (!file) {
        uploadedAudio = null;
        return;
    }

    const extension = file.name
        .split(".")
        .pop()
        .toLowerCase();

    if (!SUPPORTED_AUDIO_FORMATS.includes(extension)) {
        status.textContent =
            "Please select an MP3 or M4A audio file.";

        input.value = "";
        uploadedAudio = null;
        return;
    }

    if (file.size > MAX_AUDIO_SIZE) {
        status.textContent =
            "File is too large. Maximum upload size is 7 MB.";

        input.value = "";
        uploadedAudio = null;
        return;
    }

    if (file.size === 0) {
        status.textContent =
            "The selected audio file is empty.";

        input.value = "";
        uploadedAudio = null;
        return;
    }

    uploadedAudio = file;

    status.innerHTML = `

        <div class="tool-card">

            <h3>✅ AUDIO UPLOADED</h3>

            <p>${escapeHTML(file.name)}</p>

            <p>
                ${(file.size / 1024 / 1024).toFixed(2)} MB
            </p>

        </div>

    `;
});

}

/* ==========================================
GENERATE FULL AI SONG
========================================== */

function initializeSongGenerator() {
const form = document.getElementById("musicForm");

if (!form) return;

form.addEventListener("submit", async event => {
    event.preventDefault();

    const title = document.getElementById("songTitle").value.trim();
    const basePrompt = document.getElementById("musicPrompt").value.trim();
    const lyrics = document.getElementById("songLyrics").value.trim();
    const genre = document.getElementById("genre").value;
    const mood = document.getElementById("songMood")?.value || "uplifting and energetic";
    const tempo = document.getElementById("songTempo")?.value || "mid-tempo";
    const instruments = document.getElementById("songInstruments")?.value.trim();
    const gender = document.getElementById("vocal").value;
    const model = document.getElementById("musicModel").value;
    const prompt = [
        basePrompt,
        "Genre: " + genre + ".",
        "Mood: " + mood + ".",
        "Tempo: " + tempo + ".",
        instruments ? "Preferred instruments: " + instruments + "." : ""
    ].filter(Boolean).join(" ");

    const status = document.getElementById("generationStatus");

    const button = form.querySelector('button[type="submit"]');

    if (!title || !prompt || !lyrics) {
        status.textContent =
            "Please complete all required fields.";
        return;
    }

    button.disabled = true;
    button.textContent = "⏳ CONNECTING...";

    status.innerHTML = `

        <div class="tool-card">

            <h3>⏳ CONNECTING TO MUSIC SERVER</h3>

            <p>Please wait...</p>

        </div>

    `;

    try {
        const response = await fetch(
            "/api/music/generate-song",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    title,
                    lyrics,
                    prompt,
                    gender,
                    model
                })
            }
        );

        const result = await readAPIResponse(response);

        if (!response.ok) {
            if (response.status === 503) {
                status.innerHTML = `

                    <div class="tool-card">

                        <h3>🔐 BACKEND CONNECTION SUCCESSFUL</h3>

                        <p>Your request reached our server.</p>

                        <p>
                            ${escapeHTML(
                                result.message ||
                                "Music generation is temporarily paused."
                            )}
                        </p>

                        <p>
                            ✅ No Mureka generation was started.
                        </p>

                    </div>

                `;

                return;
            }

            throw new Error(
                result.message || "Song generation request failed."
            );
        }

        const task = result.task;

        const taskId = task && (task.id || task.task_id);

        if (!taskId) {
            throw new Error(
                "No task ID was returned by the server."
            );
        }

        saveTask({
            id: String(taskId),
            title,
            type: "song",
            status: task.status || "preparing",
            createdAt: new Date().toISOString()
        });

        updateDashboardStatistics();

        status.innerHTML = `

            <div class="tool-card">

                <h3>✅ SONG TASK CREATED</h3>

                <p>Title: ${escapeHTML(title)}</p>

                <p>Task ID: ${escapeHTML(taskId)}</p>

                <p>Your request has been recorded.</p>

            </div>

        `;

        checkMusicTask(
            String(taskId),
            status,
            title,
            "song"
        );

    } catch (error) {
        status.innerHTML = `

            <div class="tool-card">

                <h3>❌ CONNECTION ERROR</h3>

                <p>${escapeHTML(error.message)}</p>

            </div>

        `;
    } finally {
        button.disabled = false;
        button.textContent = "✨ GENERATE MUSIC";
    }
});

}

/* ==========================================
GENERATE INSTRUMENTAL
========================================== */

function initializeInstrumentalGenerator() {
const form = document.getElementById("instrumentalForm");

if (!form) return;

form.addEventListener("submit", async event => {
    event.preventDefault();

    const description = document
        .getElementById("instrumentalPrompt")
        .value.trim();

    const titleInput = document.getElementById("instrumentalTitle");
    const instrumentalTitle = titleInput?.value.trim() || "AI Instrumental";

    const genre = document.getElementById("instrumentalGenre")?.value || "Afrobeats";
    const mood = document.getElementById("instrumentalMood")?.value || "energetic and uplifting";
    const tempo = document.getElementById("instrumentalTempo")?.value || "mid-tempo";
    const instruments = document.getElementById("instrumentalInstruments")?.value || "";
    const prompt = [
        description,
        "Genre: " + genre + ".",
        "Mood: " + mood + ".",
        "Tempo: " + tempo + ".",
        instruments ? "Preferred bass and rhythm: " + instruments + "." : ""
    ].filter(Boolean).join(" ").slice(0, 1024);

    const model = document
        .getElementById("instrumentalModel")
        .value;

    const status = document.getElementById("instrumentalStatus");

    const button = form.querySelector('button[type="submit"]');

    if (!prompt) {
        status.textContent =
            "Please describe your instrumental.";
        return;
    }

    button.disabled = true;
    button.textContent = "⏳ PROCESSING...";

    status.innerHTML = `

        <div class="tool-card">

            <h3>⏳ CONNECTING TO SERVER</h3>

            <p>Please wait...</p>

        </div>

    `;

    try {
        const response = await fetch(
            "/api/music/generate-instrumental",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt,
                    model
                })
            }
        );

        const result = await readAPIResponse(response);

        if (!response.ok) {
            status.innerHTML = `

                <div class="tool-card">

                    <h3>🔐 INSTRUMENTAL GENERATION PAUSED</h3>

                    <p>
                        ${escapeHTML(
                            result.message ||
                            "Generation is currently unavailable."
                        )}
                    </p>

                    <p>
                        ✅ No Mureka credits have been used.
                    </p>

                </div>

            `;

            return;
        }

        const task = result.task;

        const taskId = task && (task.id || task.task_id);

        if (!taskId) {
            throw new Error(
                "No task ID returned by the server."
            );
        }

        saveTask({
            id: String(taskId),
            title: instrumentalTitle,
            type: "instrumental",
            status: task.status || "preparing",
            createdAt: new Date().toISOString()
        });

        updateDashboardStatistics();

        checkMusicTask(
            String(taskId),
            status,
            instrumentalTitle,
            "instrumental"
        );

    } catch (error) {
        status.innerHTML = `

            <div class="tool-card">

                <h3>⚠️ CONNECTION ERROR</h3>

                <p>${escapeHTML(error.message)}</p>

            </div>

        `;
    } finally {
        button.disabled = false;
        button.textContent = "🎹 GENERATE INSTRUMENTAL";
    }
});

}

/* ==========================================
LYRICS GENERATOR
========================================== */

function initializeLyricsGenerator() {
const form = document.getElementById("lyricsForm");

if (!form) return;

const generateButton = form.querySelector(
    'button[type="submit"]'
);

const resultBox = document.getElementById("lyricsResult");

const lyricsEditor = document.getElementById("lyricsEditor");

form.addEventListener("submit", async event => {
    event.preventDefault();

    const theme = document
        .getElementById("lyricsTheme")
        .value.trim();

    const genre = document
        .getElementById("lyricsGenre")
        .value;

    if (!theme) {
        resultBox.textContent =
            "Please describe your song theme.";
        return;
    }

    generateButton.disabled = true;
    generateButton.textContent = "⏳ PROCESSING...";

    resultBox.innerHTML = `

        <div class="tool-card">

            <h3>⏳ PREPARING LYRICS</h3>

            <p>
                Connecting to GENERAL MUSIC AI server...
            </p>

        </div>

    `;

    try {
        const response = await fetch(
            "/api/music/generate-lyrics",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    prompt:
                        `Write original ${genre} song lyrics about: ${theme}`
                })
            }
        );

        const data = await readAPIResponse(response);

        if (!response.ok) {
            resultBox.innerHTML = `

                <div class="tool-card">

                    <h3>🔐 LYRICS GENERATION PAUSED</h3>

                    <p>
                        ${escapeHTML(
                            data.message ||
                            "Lyrics generation is currently unavailable."
                        )}
                    </p>

                    <p>
                        ✅ No Mureka credits have been used.
                    </p>

                </div>

            `;

            return;
        }

        const lyrics = data.lyrics;

        if (!lyrics) {
            throw new Error(
                "The server did not return any lyrics."
            );
        }

        const lyricsText = typeof lyrics === "string"
            ? lyrics
            : JSON.stringify(lyrics, null, 2);

        lyricsEditor.value = lyricsText;
        lyricsEditor.dispatchEvent(new Event("input", { bubbles: true }));

        resultBox.innerHTML = `

            <div class="tool-card">

                <h3>🎵 YOUR GENERATED LYRICS</h3>

                <div style="white-space:pre-wrap;line-height:1.8;">
                    ${escapeHTML(lyricsText)}
                </div>

            </div>

        `;

        const editorStatus = document.getElementById(
            "lyricsEditorStatus"
        );

        editorStatus.textContent =
            "✅ Generated lyrics added to your editor.";

    } catch (error) {
        resultBox.innerHTML = `

            <div class="tool-card">

                <h3>⚠️ CONNECTION ERROR</h3>

                <p>${escapeHTML(error.message)}</p>

            </div>

        `;
    } finally {
        generateButton.disabled = false;
        generateButton.textContent = "🎵 GENERATE LYRICS";
    }
});

}

/* ==========================================
LYRICS EDITOR CONTROLS
========================================== */

function initializeLyricsEditor() {
const editor = document.getElementById("lyricsEditor");
const status = document.getElementById("lyricsEditorStatus");

const copyButton = document.getElementById("copyLyrics");
const downloadButton = document.getElementById("downloadLyrics");
const clearButton = document.getElementById("clearLyrics");
const structureSelect = document.getElementById("lyricsStructure");
const insertStructureButton = document.getElementById("insertStructure");
const wordCount = document.getElementById("lyricsWordCount");
const saveStatus = document.getElementById("lyricsSaveStatus");
const draftKey = "gtp_music_lyrics_draft_v1";

if (
    !editor ||
    !status ||
    !copyButton ||
    !downloadButton ||
    !clearButton
) {
    return;
}

function updateLyricsMeta() {
    const value = editor.value || "";
    const words = value.trim() ? value.trim().split(/\s+/).length : 0;
    if (wordCount) wordCount.textContent = words + " words · " + value.length + " characters";
}

function saveLyricsDraft() {
    try {
        localStorage.setItem(draftKey, editor.value);
        if (saveStatus) saveStatus.textContent = "✓ Draft saved on this device";
    } catch (error) {
        if (saveStatus) saveStatus.textContent = "Draft could not be saved";
    }
}

try {
    const savedDraft = localStorage.getItem(draftKey);
    if (!editor.value.trim() && savedDraft) editor.value = savedDraft;
} catch (error) {
    console.warn("Lyrics draft restore unavailable:", error);
}
updateLyricsMeta();

editor.addEventListener("input", () => {
    updateLyricsMeta();
    saveLyricsDraft();
});

document.querySelectorAll("[data-lyrics-section]").forEach(button => {
    button.addEventListener("click", () => {
        const section = button.getAttribute("data-lyrics-section");
        const insertion = (editor.value.trim() ? "\n\n" : "") + "[" + section.toUpperCase() + "]\n";
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        editor.setRangeText(insertion, start, end, "end");
        editor.focus();
        updateLyricsMeta();
        saveLyricsDraft();
        status.textContent = section + " section added.";
    });
});

if (insertStructureButton && structureSelect) {
    insertStructureButton.addEventListener("click", () => {
        if (editor.value.trim() && !confirm("Insert a song structure at the end of your current lyrics?")) return;
        const sections = structureSelect.value.split(",").map(item => item.trim());
        const structure = sections.map(section => "[" + section.toUpperCase() + "]\n\n").join("");
        const prefix = editor.value.trim() ? "\n\n" : "";
        editor.value = editor.value.replace(/\s+$/, "") + prefix + structure;
        editor.focus();
        editor.setSelectionRange(editor.value.length, editor.value.length);
        updateLyricsMeta();
        saveLyricsDraft();
        status.textContent = "✓ Song structure inserted. Start writing each section.";
    });
}

copyButton.addEventListener("click", async () => {
    const text = editor.value.trim();

    if (!text) {
        status.textContent =
            "Please enter some lyrics first.";
        return;
    }

    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
        } else {
            editor.select();

            const copied = document.execCommand("copy");

            if (!copied) {
                throw new Error("Copy command failed.");
            }
        }

        status.textContent =
            "✅ Lyrics copied successfully!";

    } catch (error) {
        status.textContent =
            "⚠️ Unable to copy. Please select and copy manually.";
    }
});

downloadButton.addEventListener("click", () => {
    const text = editor.value.trim();

    if (!text) {
        status.textContent =
            "Please enter some lyrics first.";
        return;
    }

    const blob = new Blob(
        [text],
        { type: "text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;
    link.download = "GENERAL-MUSIC-AI-LYRICS.txt";

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);

    status.textContent = "✅ Lyrics downloaded!";
});

clearButton.addEventListener("click", () => {
    if (!editor.value.trim()) {
        status.textContent =
            "The editor is already empty.";
        return;
    }

    if (!confirm("Are you sure you want to clear your lyrics?")) {
        return;
    }

    editor.value = "";
    try { localStorage.removeItem(draftKey); } catch (error) {}
    updateLyricsMeta();
    if (saveStatus) saveStatus.textContent = "Draft cleared";

    status.textContent = "✅ Lyrics cleared.";
});

}

/* ==========================================
DRUM SEPARATION PAGE
========================================== */

function initializeDrumSeparation() {
handleAudioUpload("drumUpload", "drumStatus");

const button = document.getElementById("separateDrums");

const status = document.getElementById("separationStatus");

if (!button || !status) return;

button.addEventListener("click", () => {
    if (!uploadedAudio) {
        alert("Upload an audio file first.");
        return;
    }

    status.innerHTML = `

        <div class="tool-card">

            <h3>🥁 DRUM SEPARATION NOT YET CONNECTED</h3>

            <p>Your audio upload was successful.</p>

            <p>
                The individual drum separation service
                still needs to be connected and tested.
            </p>

        </div>

    `;
});

}

/* ==========================================
FULL STEM SEPARATION
========================================== */

function initializeStemSeparation() {
handleAudioUpload("stemUpload", "stemStatus");

const button = document.getElementById("separateStems");

const status = document.getElementById("stemSeparationResult");

if (!button || !status) return;

button.addEventListener("click", async () => {
    if (!uploadedAudio) {
        alert("Upload an audio file first.");
        return;
    }

    const formData = new FormData();

    formData.append("audio", uploadedAudio);
    formData.append("model", "audio-separation-2");

    button.disabled = true;
    button.textContent = "⏳ PROCESSING...";

    status.textContent = "Preparing audio separation...";

    try {
        const response = await fetch(
            "/api/music/separate-stems",
            {
                method: "POST",
                body: formData
            }
        );

        const result = await readAPIResponse(response);

        if (!response.ok) {
            if (response.status === 503) {
                status.innerHTML = `

                    <div class="tool-card">

                        <h3>🔐 STEM SEPARATION PAUSED</h3>

                        <p>
                            ${escapeHTML(
                                result.message ||
                                "Stem separation is currently paused."
                            )}
                        </p>

                        <p>
                            ✅ No Mureka credits have been used.
                        </p>

                    </div>

                `;

                return;
            }

            throw new Error(
                result.message ||
                "Stem separation request failed."
            );
        }

        const stemData = result.result;

        if (!stemData || !stemData.zip_url) {
            throw new Error(
                "Separation completed, but the download link was not returned."
            );
        }

        const downloadURL = safeAudioURL(stemData.zip_url);

        if (!downloadURL) {
            throw new Error(
                "The server returned an invalid download link."
            );
        }

        const message = document.createElement("p");

        message.textContent =
            "✅ Your separated audio tracks are ready!";

        const downloadLink = document.createElement("a");

        downloadLink.href = downloadURL;
        downloadLink.target = "_blank";
        downloadLink.rel = "noopener noreferrer";
        downloadLink.textContent =
            "⬇️ DOWNLOAD SEPARATED STEMS";

        downloadLink.style.display = "inline-block";
        downloadLink.style.marginTop = "15px";
        downloadLink.style.padding = "12px 20px";
        downloadLink.style.borderRadius = "10px";
        downloadLink.style.background = "#35ffad";
        downloadLink.style.color = "#071426";
        downloadLink.style.fontWeight = "bold";
        downloadLink.style.textDecoration = "none";

        status.innerHTML = "";

        status.appendChild(message);
        status.appendChild(downloadLink);

    } catch (error) {
        status.innerHTML = `

            <div class="tool-card">

                <h3>⚠️ STEM SEPARATION ERROR</h3>

                <p>${escapeHTML(error.message)}</p>

            </div>

        `;
    } finally {
        button.disabled = false;
        button.textContent = "SEPARATE AUDIO STEMS";
    }
});

}
/* ==========================================
PAGE HEADER + BACK BUTTON
========================================== */

function addPageBackButton(page) {
    const heading = app.querySelector("h1, h2");

    if (!heading) return;

    const backButton = document.createElement("button");

    backButton.type = "button";
    backButton.textContent = "← BACK";
    backButton.className = "page-back-button";

    backButton.style.cssText = `
        background: linear-gradient(135deg, #087cff, #853bff);
        color: #ffffff;
        border: none;
        border-radius: 9px;
        padding: 9px 15px;
        font-size: 12px;
        font-weight: bold;
        cursor: pointer;
        margin-right: 14px;
        flex-shrink: 0;
    `;

    backButton.addEventListener("click", goBack);

    heading.style.display = "flex";
    heading.style.alignItems = "center";
    heading.style.flexWrap = "wrap";
    heading.style.gap = "8px";

    heading.prepend(backButton);
}

/* ==========================================
GO BACK TO PREVIOUS PAGE
========================================== */

function goBack() {

    if (pageHistory.length > 0) {
        window.history.back();
        return;
    }

    // No previous app page: return to Dashboard
    pageHistory.length = 0;

    window.history.replaceState(
        { page: "dashboard" },
        "",
        "/"
    );

    navigate("dashboard", true);
}

/* ==========================================
PAGE URL ROUTING
========================================== */

const pagePaths = {
    dashboard: "/",
    create: "/create",
    lyrics: "/lyrics",
    drums: "/drums",
    stems: "/stems",
    music: "/music",
    library: "/library",
    settings: "/settings",
    nowplaying: "/now-playing"
};

function getPageFromPath() {
    const currentPath = window.location.pathname;

    return Object.keys(pagePaths).find(
        page => pagePaths[page] === currentPath
    ) || "dashboard";
}

/* ==========================================
PAGE NAVIGATION
========================================== */
function navigate(page, isBackNavigation = false) {

    if (!pages[page]) {
        console.warn("Unknown application page:", page);
        return;
    }

    if (page === currentPage && !isBackNavigation) {
        return;
    }

    // Save the previous page
    if (!isBackNavigation && currentPage !== page) {
        pageHistory.push(currentPage);
    }

    // Update the browser URL
    if (!isBackNavigation) {
        window.history.pushState(
            { page: page },
            "",
            pagePaths[page]
        );
    }

    currentPage = page;
    document.body.classList.toggle("now-playing-fullscreen", page === "nowplaying");
    uploadedAudio = null;

    // Display the selected page
    app.innerHTML = pages[page];

    // Update active navigation link
    document.querySelectorAll("[data-page]").forEach(link => {
        link.classList.toggle(
            "active",
            link.dataset.page === page
        );
    });

    addPageBackButton(page);

    window.scrollTo(0, 0);

    initializePage(page);

    updateDashboardStatistics();
}


/* ==========================================
NAVIGATION CLICK HANDLER
========================================== */

document.addEventListener("click", event => {
    const target = event.target.closest("[data-page]");

    if (!target) return;

    const destination = target.dataset.page;

    if (!pages[destination]) return;

    // Keep navigation inside the application. The server currently serves
    // the same shell document at each URL, while the pages object contains
    // the actual page layouts. Render the selected layout instead of
    // reloading another copy of the dashboard.
    event.preventDefault();
    navigate(destination);
});

/* ==========================================
   SETTINGS PAGE
========================================== */

function initializeSettings() {
    const volumeInput = document.getElementById("settingsVolume");
    const volumeValue = document.getElementById("settingsVolumeValue");
    const autoplayInput = document.getElementById("settingsAutoplayNext");
    const musicCount = document.getElementById("settingsMusicCount");

    if (volumeInput) {
        const currentVolume = audioElement
            ? audioElement.volume
            : Math.max(0, Math.min(1, Number(localStorage.getItem(PLAYER_VOLUME_KEY) ?? 0.8)));
        volumeInput.value = String(currentVolume);
        const updateVolume = () => {
            const volume = Math.max(0, Math.min(1, Number(volumeInput.value)));
            if (audioElement) audioElement.volume = volume;
            if (playerElements.volume) playerElements.volume.value = String(volume);
            localStorage.setItem(PLAYER_VOLUME_KEY, String(volume));
            if (volumeValue) volumeValue.textContent = Math.round(volume * 100) + "%";
        };
        volumeInput.addEventListener("input", updateVolume);
        updateVolume();
    }

    if (autoplayInput) {
        autoplayInput.checked = localStorage.getItem(AUTOPLAY_NEXT_KEY) !== "false";
        autoplayInput.addEventListener("change", () => {
            localStorage.setItem(AUTOPLAY_NEXT_KEY, String(autoplayInput.checked));
        });
    }

    if (musicCount) {
        const count = getSavedTasks().length;
        musicCount.textContent = count === 1 ? "1 saved track" : count + " saved tracks";
    }
}

/* ==========================================
FULL-SCREEN NOW PLAYING VIEW
========================================== */
function renderNowPlayingPage() {
    const host = document.getElementById("fullNowPlaying");
    if (!host) return;
    const track = getSavedTasks().find(item => String(item.id) === String(currentTrackId));
    if (!track) {
        host.innerHTML = '<div class="now-playing-empty"><div class="now-playing-empty-icon">♫</div><h2>NOTHING PLAYING</h2><p>Open MY MUSIC and choose a track to begin.</p><button type="button" class="primary-btn" data-page="music">OPEN MY MUSIC</button></div>';
        return;
    }
    const title = escapeHTML(track.title || "Untitled Song");
    const artist = escapeHTML(track.artistName || "Unknown artist");
    const cover = track.coverImage
        ? '<div class="full-player-art has-art" style="background-image:url(&quot;' + escapeHTML(track.coverImage) + '&quot;)"></div>'
        : '<div class="full-player-art">' + (track.type === "instrumental" ? "♫" : "🎵") + '</div>';
    const download = track.audioBlobId
        ? '<button type="button" class="full-player-secondary" data-download-local="' + escapeHTML(track.id) + '">⇩ DOWNLOAD</button>'
        : (safeAudioURL(track.audioUrl) ? '<a class="full-player-secondary" href="' + escapeHTML(safeAudioURL(track.audioUrl)) + '" download>⇩ DOWNLOAD</a>' : '');
    host.innerHTML = '<div class="full-player-top"><span>GENERAL MUSIC AI · NOW PLAYING</span><button type="button" class="full-player-back" data-page="music">← MY MUSIC</button></div>' +
        '<div class="full-player-content">' + cover +
        '<div class="full-player-track-meta"><span class="full-player-kicker">' + escapeHTML(track.genre || track.musicStyle || (track.type === "instrumental" ? "INSTRUMENTAL" : "YOUR MUSIC")) + '</span><h2>' + title + '</h2><p>' + artist + '</p><small>' + escapeHTML(track.albumName || "Single") + '</small></div>' +
        '<input class="full-player-progress" type="range" min="0" max="100" step="0.1" value="' + (audioElement && audioElement.duration > 0 ? (audioElement.currentTime / audioElement.duration) * 100 : 0) + '" data-full-progress aria-label="Track progress">' +
        '<div class="full-player-times"><span data-full-current>' + formatTime(audioElement ? audioElement.currentTime : 0) + '</span><span data-full-duration>' + formatTime(audioElement ? audioElement.duration : 0) + '</span></div>' +
        '<div class="full-player-controls"><button type="button" data-full-previous aria-label="Previous track">⏮</button><button type="button" class="full-player-play" data-full-toggle aria-label="Play or pause">' + (audioElement && !audioElement.paused ? "Ⅱ" : "▶") + '</button><button type="button" data-full-next aria-label="Next track">⏭</button></div>' + download + '</div>';
}

/* ==========================================
PAGE INITIALIZER
========================================== */

function initializePage(page) {

if (page === "dashboard") {
    updateDashboardStatistics();
}

if (page === "music" || page === "library") {
    renderMusicCollection();
}

if (page === "nowplaying") {
    renderNowPlayingPage();
}

if (page === "settings") {
    initializeSettings();
}

if (page === "create") {
    initializeSongGenerator();
    initializeInstrumentalGenerator();
}

if (page === "lyrics") {
    initializeLyricsGenerator();
    initializeLyricsEditor();
}

if (page === "drums") {
    initializeDrumSeparation();
}

if (page === "stems") {
    initializeStemSeparation();
}

}

/* ==========================================
APPLICATION STARTUP
========================================== */

/* ==========================================
   BROWSER BACK AND FORWARD SUPPORT
========================================== */

window.addEventListener("popstate", () => {

    if (pageHistory.length > 0) {
        pageHistory.pop();
    }

    const page = getPageFromPath();

    navigate(page, true);
});

initializeGlobalPlayer();
initializeGlobalSearch();
renderPlaybackQueue();

// Restore the last selected track after a full-page navigation.
// Browsers stop audio during document navigation, so playback resumes paused
// at the saved position rather than continuing without interruption.
async function restoreGlobalPlayerState() {
    let savedState = null;

    try {
        savedState = JSON.parse(
            sessionStorage.getItem("gtp_player_navigation_state") || "null"
        );
    } catch (error) {
        savedState = null;
    }

    if (!savedState || !savedState.trackId) return;

    sessionStorage.removeItem("gtp_player_navigation_state");
    refreshPlaylist();

    const track = playerPlaylist.find(
        item => String(item.id) === String(savedState.trackId)
    );

    if (!track) return;

    currentTrackId = track.id;
    currentTrackIndex = playerPlaylist.indexOf(track);
    updatePlayerInformation(track);

    const audioURL = await resolveTrackAudioURL(track);
    if (!audioURL || !audioElement) return;

    const restorePosition = () => {
        const requestedTime = Number(savedState.currentTime) || 0;
        if (Number.isFinite(audioElement.duration) && audioElement.duration > 0) {
            audioElement.currentTime = Math.min(
                requestedTime,
                Math.max(0, audioElement.duration - 0.5)
            );
        }
        updatePlayerProgress();
        updatePlayButton();
    };

    audioElement.addEventListener("loadedmetadata", restorePosition, { once: true });
    audioElement.src = audioURL;
    audioElement.load();
    if (audioElement.readyState >= 1) restorePosition();
}

window.addEventListener("pagehide", () => {
    if (!audioElement || !currentTrackId) return;

    try {
        sessionStorage.setItem(
            "gtp_player_navigation_state",
            JSON.stringify({
                trackId: currentTrackId,
                currentTime: audioElement.currentTime || 0
            })
        );
    } catch (error) {
        console.warn("Unable to preserve player position:", error);
    }
});

// Render the correct page for this independently served HTML document.
navigate(getPageFromPath(), true);
restoreGlobalPlayerState();

// Prepare imported audio URLs before the user taps PLAY or DOWNLOAD.
// Mobile browsers may reject media playback or synthetic downloads if IndexedDB
// is accessed only after the tap, because the original user gesture is lost.
async function prepareLocalAudioCache() {
    const localTracks = getSavedTasks().filter(track => track && track.audioBlobId);
    await Promise.all(localTracks.map(track =>
        resolveTrackAudioURL(track).catch(error => {
            console.warn("Unable to prepare imported audio:", track.id, error);
            return "";
        })
    ));
    if (document.getElementById("musicCollection")) renderMusicCollection();
}
prepareLocalAudioCache();

updateDashboardStatistics();

console.log(
"GENERAL MUSIC AI V1.0 initialized successfully."
);

console.log(
"Global music player initialized."
);
