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

const pageHistory = [];

const pageTitles = {
    dashboard: "DASHBOARD",
    create: "CREATE MUSIC",
    lyrics: "LYRICS STUDIO",
    drums: "DRUM SEPARATION",
    stems: "STEM SEPARATION",
    music: "MY MUSIC",
    library: "MUSIC LIBRARY",
    settings: "SETTINGS"
};

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
let playbackQueueIds = null;

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
const audioURL = await resolveTrackAudioURL(track);

if (!audioURL) {
    alert("This track audio file could not be found on this device.");
    return;
}

currentTrackId = track.id;
currentTrackIndex = index;

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

if (playerPlaylist.length === 0) return;

let nextIndex = currentTrackIndex + 1;

if (nextIndex >= playerPlaylist.length) {
    nextIndex = 0;
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

if (playerPlaylist.length === 0) return;

let previousIndex = currentTrackIndex - 1;

if (previousIndex < 0) {
    previousIndex = playerPlaylist.length - 1;
}

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
    if (localStorage.getItem(AUTOPLAY_NEXT_KEY) !== "false") {
        playNextTrack();
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
                        <button type="button" class="collection-playlist-chip ${String(item.id) === String(activePlaylistId) && collectionMode === "playlist" ? "active" : ""}" data-open-playlist="${escapeHTML(item.id)}">${escapeHTML(item.name)} <small>${item.trackIds.length}</small></button>
                    `).join("") : '<p class="collection-muted">Create a playlist to organise your music.</p>'}
                </div>
            ` : ""}
            ${collectionMode === "albums" || collectionMode === "album" ? '<div class="album-library-grid">' + getMusicAlbums().map(album => '<div class="album-library-card">' +
                '<button type="button" class="album-open-button" data-open-album="' + escapeHTML(album.id) + '">' +
                (album.coverImage ? '<span class="album-mini-cover" style="background-image:url(&quot;' + escapeHTML(album.coverImage) + '&quot;)"></span>' : '<span class="album-mini-cover album-placeholder">💿</span>') +
                '<strong>' + escapeHTML(album.name) + '</strong><small>' + escapeHTML(album.artistName || "Various artists") + ' · ' + album.trackIds.length + ' tracks</small></button>' +
                '<label class="collection-action-btn album-cover-label" for="albumCover_' + escapeHTML(album.id) + '">🖼️ COVER</label>' +
                '<input class="music-cover-input" id="albumCover_' + escapeHTML(album.id) + '" type="file" accept="image/jpeg,image/png,image/webp" data-album-cover="' + escapeHTML(album.id) + '">' +
                '<button type="button" class="collection-action-btn" data-rename-album="' + escapeHTML(album.id) + '">✏️ RENAME</button>' +
                '<button type="button" class="collection-action-btn" data-delete-album="' + escapeHTML(album.id) + '">🗑️ DELETE</button></div>').join("") +
                (getMusicAlbums().length ? "" : '<p class="collection-muted">Create your first album to organise your tracks.</p>') + '</div>' : ""}
        </div>
    `;

    if (collectionMode === "albums" && !activeAlbumId) {
        collection.innerHTML = toolbar;
        return;
    }
    let albumHeaderMarkup = "";
    if (collectionMode === "album") {
        const album = getMusicAlbums().find(item => String(item.id) === String(activeAlbumId));
        if (!album) { collectionMode = "albums"; activeAlbumId = null; renderMusicCollection(); return; }
        albumHeaderMarkup = '<section class="album-detail-header">' +
            (album.coverImage ? '<div class="album-detail-cover" style="background-image:url(&quot;' + escapeHTML(album.coverImage) + '&quot;)"></div>' : '<div class="album-detail-cover album-placeholder">💿</div>') +
            '<div class="album-detail-copy"><span class="album-kicker">ALBUM</span><h2>' + escapeHTML(album.name) + '</h2><p>' + escapeHTML(album.artistName || "Various artists") + ' · ' + album.trackIds.length + ' tracks</p>' +
            '<div class="album-playback-actions"><button type="button" class="primary-btn" data-play-album="' + escapeHTML(album.id) + '">▶ PLAY ALBUM</button><button type="button" class="collection-action-btn" data-shuffle-album="' + escapeHTML(album.id) + '">🔀 SHUFFLE</button></div></div></section>';
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
        const playableURL = safeAudioURL(song.audioUrl);
        const isLocalAudio = Boolean(song.audioBlobId);
        const favorite = favorites.includes(String(song.id));
        const isCurrentTrack = String(currentTrackId) === String(song.id);
        const controls = (playableURL || isLocalAudio) ? `
            <div class="music-card-controls">
                <button class="primary-btn" type="button" data-play-music="${id}">${isCurrentTrack && audioElement && !audioElement.paused ? "▶ NOW PLAYING" : "▶ PLAY TRACK"}</button>
                ${playableURL ? `<a class="primary-btn" href="${escapeHTML(playableURL)}" download data-download-music="${id}">⬇️ DOWNLOAD</a>` : `<button class="primary-btn" type="button" data-download-local="${id}">⬇️ DOWNLOAD</button>`}
            </div>` : '<p>🎧 Audio will appear here when generation succeeds or you import a file.</p>';

        const coverMarkup = song.coverImage
            ? '<div class="music-cover-art has-image" style="background-image:url(&quot;' + escapeHTML(song.coverImage) + '&quot;)"></div>'
            : '<div class="music-cover-art generated-cover ' + (song.type === "instrumental" ? "instrumental-cover" : "song-cover") + '><span>' + (song.type === "instrumental" ? "🎹" : "🎤") + '</span><small>GENERAL MUSIC AI</small></div>';

        return `
            <div class="tool-card music-track-card">
                ${coverMarkup}
                <h3>🎵 ${title}</h3>
                <p class="music-track-type">${song.type === "imported" ? "📥 IMPORTED AUDIO" : song.type === "instrumental" ? "🎹 AI INSTRUMENTAL" : "🎤 FULL AI SONG"}</p>
                <p>Status: ${status}</p>
                <div class="music-track-details">
                    <p><strong>Artist:</strong> ${escapeHTML(song.artistName || "Not set")}</p>
                    <p><strong>Album:</strong> ${escapeHTML(song.albumName || "Single")}</p>
                    <p><strong>Genre:</strong> ${escapeHTML(song.genre || song.musicStyle || "Not set")}</p>
                    <p><strong>Duration:</strong> ${song.durationSeconds ? formatTime(song.durationSeconds) : "Not detected yet"}</p>
                    <p><strong>Created:</strong> ${song.createdAt ? escapeHTML(new Date(song.createdAt).toLocaleDateString()) : "Date unavailable"}</p>
                </div>
                <details class="track-metadata-editor">
                    <summary>✏️ EDIT TRACK DETAILS</summary>
                    <label>Artist name<input type="text" maxlength="80" data-meta-field="artistName" value="${escapeHTML(song.artistName || "")}" placeholder="Artist / producer name"></label>
                    <label>Album name<input type="text" maxlength="100" data-meta-field="albumName" value="${escapeHTML(song.albumName || "")}" placeholder="Album or project name"></label>
                    <label>Genre / music style<input type="text" maxlength="60" data-meta-field="genre" value="${escapeHTML(song.genre || song.musicStyle || "")}" placeholder="e.g. Hip-Hop, R&B, Gospel"></label>
                    <button type="button" class="collection-action-btn" data-save-metadata="${id}">💾 SAVE DETAILS</button>
                </details>
                ${controls}
                <div class="music-card-actions">
                    <label class="collection-action-btn cover-upload-label" for="coverUpload_${id}">🖼️ ${song.coverImage ? "CHANGE COVER" : "UPLOAD COVER"}</label>
                    <input class="music-cover-input" id="coverUpload_${id}" type="file" accept="image/jpeg,image/png,image/webp" data-cover-upload="${id}">
                    <button type="button" class="collection-action-btn ${favorite ? "is-favorite" : ""}" data-toggle-favorite="${id}">${favorite ? "♥ FAVORITED" : "♡ ADD TO FAVORITES"}</button>
                    <button type="button" class="collection-action-btn" data-add-to-playlist="${id}">＋ ADD TO PLAYLIST</button>
                    ${collectionMode === "playlist" ? '<button type="button" class="collection-action-btn" data-remove-from-playlist="' + id + '">REMOVE FROM PLAYLIST</button>' : ""}
                    <button type="button" class="collection-action-btn" data-add-to-album="${id}">＋ ADD TO ALBUM</button>
                    ${collectionMode === "album" ? '<button type="button" class="collection-action-btn" data-album-move-up="' + id + '">↑ MOVE UP</button><button type="button" class="collection-action-btn" data-album-move-down="' + id + '">↓ MOVE DOWN</button><button type="button" class="collection-action-btn" data-remove-from-album="' + id + '">REMOVE FROM ALBUM</button>' : ""}
                </div>
                <p class="music-task-id">Task ID: ${id}</p>
                <button class="primary-btn" type="button" data-delete-music="${id}" style="margin-top:12px;background:#ff4757;">🗑️ DELETE TRACK</button>
            </div>`;
    }).join("");

    collection.innerHTML = toolbar + albumHeaderMarkup + sortToolbar + '<div class="music-collection-grid">' + cards + '</div>';
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
            renderMusicCollection();
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

document.addEventListener("click", async event => {

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
    if (collectionMode === "album" && activeAlbumId) {
        const album = getMusicAlbums().find(item => String(item.id) === String(activeAlbumId));
        playbackQueueIds = album ? [...album.trackIds] : null;
    } else {
        playbackQueueIds = null;
    }
    recordRecentlyPlayed(playButton.dataset.playMusic);
    await playTrack(playButton.dataset.playMusic);
    renderMusicCollection();
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
    playbackQueueIds = playableIds;
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
        const albums = getMusicAlbums();
        albums.unshift({ id: "album_" + Date.now(), name: name.trim().slice(0,80), artistName: "", coverImage: "", trackIds: [], createdAt: new Date().toISOString() });
        saveMusicAlbums(albums); collectionMode = "albums"; activeAlbumId = null; renderMusicCollection();
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

const createPlaylistButton = event.target.closest("[data-create-playlist]");
if (createPlaylistButton) {
    const name = prompt("Enter a name for your new playlist:");
    if (name && name.trim()) {
        const playlists = getCustomPlaylists();
        playlists.push({ id: "playlist_" + Date.now(), name: name.trim().slice(0, 50), trackIds: [] });
        saveCustomPlaylists(playlists);
        collectionMode = "playlists";
        activePlaylistId = null;
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
    settings: "/settings"
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

    // Real links must load their matching HTML document. Do not cancel
    // the browser's normal navigation for sidebar and other anchor links.
    if (target.tagName === "A" && target.hasAttribute("href")) {
        return;
    }

    // Dashboard feature cards are clickable containers rather than links.
    // Send them to the same independent page URL as the sidebar.
    event.preventDefault();
    window.location.assign(pagePaths[destination]);
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
PAGE INITIALIZER
========================================== */

function initializePage(page) {

if (page === "dashboard") {
    updateDashboardStatistics();
}

if (page === "music" || page === "library") {
    renderMusicCollection();
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

// Restore the last selected track after a full-page navigation.
// Browsers stop audio during document navigation, so playback resumes paused
// at the saved position rather than continuing without interruption.
function restoreGlobalPlayerState() {
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

    const audioURL = safeAudioURL(track.audioUrl);
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

updateDashboardStatistics();

console.log(
"GENERAL MUSIC AI V1.0 initialized successfully."
);

console.log(
"Global music player initialized."
);
