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
        ...task
    };
} else {
    tasks.unshift(task);
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
    playerElements.artist.textContent =
        track.type === "instrumental"
            ? "GENERAL MUSIC AI · INSTRUMENTAL"
            : "GENERAL MUSIC AI · AI SONG";
}

if (playerElements.cover) {
    playerElements.cover.textContent =
        track.type === "instrumental" ? "🎹" : "🎵";
}

}

function refreshPlaylist() {
playerPlaylist = getSavedTasks().filter(task => {
return Boolean(safeAudioURL(task.audioUrl));
});

if (currentTrackId) {
    currentTrackIndex = playerPlaylist.findIndex(
        task => task.id === currentTrackId
    );
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
const audioURL = safeAudioURL(track.audioUrl);

if (!audioURL) {
    alert("This track has an invalid audio address.");
    return;
}

currentTrackId = track.id;
currentTrackIndex = index;

updatePlayerInformation(track);

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
                        <option>Afrobeats</option>
                        <option>Gospel</option>
                        <option>Amapiano</option>
                        <option>Hip-Hop</option>
                        <option>R&B</option>
                        <option>Reggae</option>
                        <option>Pop</option>
                        <option>Highlife</option>
                        <option>Jazz</option>
                        <option>Electronic</option>
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

            <label>Describe Your Instrumental</label>

            <textarea
                id="instrumentalPrompt"
                maxlength="1024"
                placeholder="Describe your beat, instruments and sound..."
                required
            ></textarea>

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

        <h3>📝 LYRICS EDITOR</h3>

        <textarea
            id="lyricsEditor"
            rows="14"
            placeholder="Write or paste your lyrics here..."
        ></textarea>

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
MUSIC COLLECTION RENDERING
========================================== */

function renderMusicCollection() {
const collection = document.getElementById("musicCollection");

if (!collection) return;

const savedTasks = getSavedTasks();

const searchInput = document.getElementById("globalSearch");

const searchTerm = searchInput
    ? searchInput.value.trim().toLowerCase()
    : "";

const filteredTasks = savedTasks.filter(song => {
    const title = String(song.title || "").toLowerCase();
    const type = String(song.type || "").toLowerCase();

    return (
        title.includes(searchTerm) ||
        type.includes(searchTerm)
    );
});

if (filteredTasks.length === 0) {
    collection.innerHTML = `

        <div class="empty-state">

            <div>🎼</div>

            <h3>
                ${savedTasks.length
                    ? "No matching music found"
                    : "Your music collection is empty"
                }
            </h3>

            <p>
                ${savedTasks.length
                    ? "Try another search."
                    : "Your generated songs will appear here."
                }
            </p>

        </div>

    `;

    return;
}

collection.innerHTML = filteredTasks.map(song => {
    const title = escapeHTML(song.title || "Untitled Song");
    const id = escapeHTML(song.id);
    const status = escapeHTML(song.status || "preparing");

    const playableURL = safeAudioURL(song.audioUrl);

    const isCurrentTrack =
        String(currentTrackId) === String(song.id);

    let audioControls = "";

    if (playableURL) {
        audioControls = `

            <div class="music-card-controls">

                <button
                    class="primary-btn"
                    type="button"
                    data-play-music="${id}"
                >
                    ${isCurrentTrack && audioElement && !audioElement.paused
                        ? "▶ NOW PLAYING"
                        : "▶ PLAY TRACK"
                    }
                </button>

                <a
                    class="primary-btn"
                    href="${escapeHTML(playableURL)}"
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    data-download-music="${id}"
                >
                    ⬇️ DOWNLOAD
                </a>

            </div>

        `;
    } else {
        audioControls = `
            <p>
                🎧 Audio will appear here when generation succeeds.
            </p>
        `;
    }

    return `

        <div class="tool-card music-track-card">

            <h3>🎵 ${title}</h3>

            <p style="color:#38d8ff;font-weight:bold;">

                ${song.type === "instrumental"
                    ? "🎹 AI INSTRUMENTAL"
                    : "🎤 FULL AI SONG"
                }

            </p>

            <p>Status: ${status}</p>

            ${audioControls}

            <p style="
                font-size:12px;
                opacity:0.7;
                word-break:break-all;
            ">
                Task ID: ${id}
            </p>

            <button
                class="primary-btn"
                type="button"
                data-delete-music="${id}"
                style="
                    margin-top:15px;
                    background:#ff4757;
                "
            >
                🗑️ DELETE TRACK
            </button>

        </div>

    `;
}).join("");

}

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

const playButton = event.target.closest("[data-play-music]");

if (playButton) {
    await playTrack(playButton.dataset.playMusic);
    renderMusicCollection();
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
    const prompt = document.getElementById("musicPrompt").value.trim();
    const lyrics = document.getElementById("songLyrics").value.trim();
    const gender = document.getElementById("vocal").value;
    const model = document.getElementById("musicModel").value;

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

    const prompt = document
        .getElementById("instrumentalPrompt")
        .value.trim();

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
            title: "AI Instrumental",
            type: "instrumental",
            status: task.status || "preparing",
            createdAt: new Date().toISOString()
        });

        updateDashboardStatistics();

        checkMusicTask(
            String(taskId),
            status,
            "AI Instrumental",
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

if (
    !editor ||
    !status ||
    !copyButton ||
    !downloadButton ||
    !clearButton
) {
    return;
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

    // Real navigation links use their own href and browser page loading.
    // This keeps navigation working even when JavaScript is unavailable.
    if (target.tagName === "A") return;

    // Keep page-changing buttons (for example, the dashboard CTA) working.
    const destination = pagePaths[target.dataset.page];

    if (destination) {
        event.preventDefault();
        window.location.assign(destination);
    }
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
