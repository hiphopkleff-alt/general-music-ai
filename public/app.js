/* ==========================================
   GENERAL MUSIC AI V1.0
   COMPLETE APPLICATION CONTROLLER
========================================== */

"use strict";

/* ==========================================
   APPLICATION STATE
========================================== */

const app = document.querySelector(".main");

if (!app) {
    throw new Error(
        "GENERAL MUSIC AI: Main application container was not found."
    );
}

const originalDashboard = app.innerHTML;

let currentPage = "dashboard";
let uploadedAudio = null;

const STORAGE_KEY = "gtp_music_tasks";

const MAX_AUDIO_SIZE = 7 * 1024 * 1024;

const SUPPORTED_AUDIO_FORMATS = [
    "mp3",
    "m4a"
];


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
   SECURITY HELPER
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


/* ==========================================
   API RESPONSE HELPER
========================================== */

async function readAPIResponse(response) {

    let result;

    try {

        result = await response.json();

    } catch (error) {

        throw new Error(
            "The server returned an invalid response."
        );

    }

    return result;

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

                <div class="tool-card">
                    🥁
                    <h3>Kick</h3>
                </div>

                <div class="tool-card">
                    🔊
                    <h3>Snare</h3>
                </div>

                <div class="tool-card">
                    🎵
                    <h3>Hi-hats</h3>
                </div>

                <div class="tool-card">
                    👏
                    <h3>Claps</h3>
                </div>

                <div class="tool-card">
                    🎚️
                    <h3>Toms</h3>
                </div>

                <div class="tool-card">
                    ✨
                    <h3>Cymbals</h3>
                </div>

                <div class="tool-card">
                    🎼
                    <h3>Percussion</h3>
                </div>

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

                <div class="tool-card">
                    🎤
                    <h3>Vocals</h3>
                </div>

                <div class="tool-card">
                    🥁
                    <h3>Drums</h3>
                </div>

                <div class="tool-card">
                    🎸
                    <h3>Bass</h3>
                </div>

                <div class="tool-card">
                    🎹
                    <h3>Other Instruments</h3>
                </div>

            </div>


            <button
                class="primary-btn"
                id="separateStems"
                type="button"
            >
                SEPARATE AUDIO STEMS
            </button>

        </section>

    `,


    /* ======================================
       MY MUSIC
    ====================================== */

    music: `

        <section class="library">

            <h2>📁 MY MUSIC</h2>

            <p>Your personal music collection.</p>


            <div id="musicCollection">

                <div class="empty-state">

                    <div>🎼</div>

                    <h3>Your music collection is empty</h3>

                    <p>Generated songs will appear here.</p>

                </div>

            </div>

        </section>

    `,


    /* ======================================
       MUSIC LIBRARY
    ====================================== */

    library: `

        <section class="library">

            <h2>▶️ MUSIC LIBRARY</h2>

            <p>Manage and play your music.</p>


            <div id="musicCollection">

                <div class="empty-state">

                    <div>🎧</div>

                    <h3>Your audio library</h3>

                    <p>Your saved audio will appear here.</p>

                </div>

            </div>

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

            </div>


            <div class="tool-card">

                <h3>Audio Preferences</h3>

                <p>Music playback and audio settings.</p>

            </div>


            <div class="tool-card">

                <h3>Account</h3>

                <p>Account management will be added.</p>

            </div>

        </section>

    `

};


/* ==========================================
   PAGE NAVIGATION
========================================== */

function navigate(page) {

    if (!pages[page]) {

        console.warn("Unknown application page:", page);

        return;

    }


    currentPage = page;

    uploadedAudio = null;

    app.innerHTML = pages[page];


    document.querySelectorAll(".sidebar nav a").forEach(link => {

        const isActive =
            link.dataset.page === page ||
            (
                page === "dashboard" &&
                link.textContent.toLowerCase().includes("dashboard")
            );

        link.classList.toggle("active", isActive);

    });


    window.scrollTo(0, 0);

    initializePage(page);

}


/* ==========================================
   NAVIGATION CLICK HANDLER
========================================== */

document.addEventListener("click", event => {

    const target = event.target.closest("[data-page]");

    if (!target) return;


    event.preventDefault();

    navigate(target.dataset.page);

});


/* ==========================================
   MUSIC COLLECTION
========================================== */

function renderMusicCollection() {

    const collection = document.getElementById(
        "musicCollection"
    );

    if (!collection) return;


    const savedTasks = getSavedTasks();


    if (savedTasks.length === 0) {

        collection.innerHTML = `

            <div class="empty-state">

                <div>🎼</div>

                <h3>Your music collection is empty</h3>

                <p>Generated songs will appear here.</p>

            </div>

        `;

        return;

    }


    collection.innerHTML = savedTasks.map(song => {

        const title = escapeHTML(
            song.title || "Untitled Song"
        );

        const id = escapeHTML(song.id);

        const status = escapeHTML(
            song.status || "preparing"
        );


        let audioPlayer = "";

        if (song.audioUrl) {

            const audioUrl = escapeHTML(song.audioUrl);

            audioPlayer = `

                <audio
                    controls
                    preload="none"
                    style="width:100%; margin-top:12px;"
                >

                    <source src="${audioUrl}">

                </audio>


                <a
                    class="primary-btn"
                    href="${audioUrl}"
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    style="
                        display:inline-block;
                        margin-top:12px;
                        text-decoration:none;
                    "
                >
                    ⬇️ DOWNLOAD TRACK
                </a>

            `;

        } else {

            audioPlayer = `

                <p>
                    🎧 Audio will appear here when generation succeeds.
                </p>

            `;

        }


        return `

            <div class="tool-card">

                <h3>🎵 ${title}</h3>


                <p style="
                    color:#38d8ff;
                    font-weight:bold;
                ">

                    ${song.type === "instrumental"
                        ? "🎹 AI INSTRUMENTAL"
                        : "🎤 FULL AI SONG"
                    }

                </p>


                <p>Status: ${status}</p>


                ${audioPlayer}


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
   DELETE MUSIC EVENT
========================================== */

document.addEventListener("click", event => {

    const button = event.target.closest(
        "[data-delete-music]"
    );

    if (!button) return;


    const id = button.dataset.deleteMusic;

    if (!confirm("Are you sure you want to delete this track?")) {
        return;
    }


    const tasks = getSavedTasks().filter(
        song => song.id !== id
    );


    saveTasks(tasks);

    renderMusicCollection();

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

        if (typeof value !== "string") continue;

        try {

            const url = new URL(value, window.location.origin);

            if (
                url.protocol === "https:" ||
                url.protocol === "http:"
            ) {
                return url.href;
            }

        } catch (error) {

            continue;

        }

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
                    result.message ||
                    "Unable to check task status."
                );

            }


            const task = result.task || result;


            const taskStatus = String(
                task.status || "processing"
            ).toLowerCase();


            const audioUrl =
                taskStatus === "succeeded"
                    ? getTaskAudioURL(task)
                    : "";


            const savedTasks = getSavedTasks();


            const updatedTasks = savedTasks.map(item => {

                if (item.id !== taskId) return item;


                return {

                    ...item,

                    status: taskStatus,

                    ...(audioUrl
                        ? { audioUrl }
                        : {})

                };

            });


            saveTasks(updatedTasks);


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
                                ? "<p>🎧 Your audio is ready.</p>"
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


        await new Promise(resolve => {

            setTimeout(resolve, 10000);

        });

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
                    ${(file.size / 1024 / 1024).toFixed(2)}
                    MB
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


        const title = document
            .getElementById("songTitle")
            .value.trim();


        const prompt = document
            .getElementById("musicPrompt")
            .value.trim();


        const lyrics = document
            .getElementById("songLyrics")
            .value.trim();


        const gender = document
            .getElementById("vocal")
            .value;


        const model = document
            .getElementById("musicModel")
            .value;


        const status = document.getElementById(
            "generationStatus"
        );


        const button = form.querySelector(
            'button[type="submit"]'
        );


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
                    result.message ||
                    "Song generation request failed."
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

            button.textContent = "✨ GENERATE AI SONG";

        }

    });

}


/* ==========================================
   GENERATE INSTRUMENTAL
========================================== */

function initializeInstrumentalGenerator() {

    const form = document.getElementById(
        "instrumentalForm"
    );

    if (!form) return;


    form.addEventListener("submit", async event => {

        event.preventDefault();


        const prompt = document
            .getElementById("instrumentalPrompt")
            .value.trim();


        const model = document
            .getElementById("instrumentalModel")
            .value;


        const status = document.getElementById(
            "instrumentalStatus"
        );


        const button = form.querySelector(
            'button[type="submit"]'
        );


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

            button.textContent =
                "🎹 GENERATE INSTRUMENTAL";

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


    const resultBox = document.getElementById(
        "lyricsResult"
    );


    const lyricsEditor = document.getElementById(
        "lyricsEditor"
    );


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


            const lyricsText =
                typeof lyrics === "string"
                    ? lyrics
                    : JSON.stringify(lyrics, null, 2);


            lyricsEditor.value = lyricsText;


            resultBox.innerHTML = `

                <div class="tool-card">

                    <h3>🎵 YOUR GENERATED LYRICS</h3>

                    <div style="
                        white-space:pre-wrap;
                        line-height:1.8;
                    ">

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

            generateButton.textContent =
                "🎵 GENERATE LYRICS";

        }

    });

}


/* ==========================================
   LYRICS EDITOR CONTROLS
========================================== */

function initializeLyricsEditor() {

    const editor = document.getElementById(
        "lyricsEditor"
    );


    const status = document.getElementById(
        "lyricsEditorStatus"
    );


    const copyButton = document.getElementById(
        "copyLyrics"
    );


    const downloadButton = document.getElementById(
        "downloadLyrics"
    );


    const clearButton = document.getElementById(
        "clearLyrics"
    );


    if (
        !editor ||
        !status ||
        !copyButton ||
        !downloadButton ||
        !clearButton
    ) {
        return;
    }


    /* COPY LYRICS */

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


    /* DOWNLOAD LYRICS */

    downloadButton.addEventListener("click", () => {

        const text = editor.value.trim();


        if (!text) {

            status.textContent =
                "Please enter some lyrics first.";

            return;

        }


        const blob = new Blob(
            [text],
            {
                type: "text/plain;charset=utf-8"
            }
        );


        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");


        link.href = url;

        link.download =
            "GENERAL-MUSIC-AI-LYRICS.txt";


        document.body.appendChild(link);

        link.click();

        link.remove();


        URL.revokeObjectURL(url);


        status.textContent =
            "✅ Lyrics downloaded!";

    });


    /* CLEAR LYRICS */

    clearButton.addEventListener("click", () => {

        if (!editor.value.trim()) {

            status.textContent =
                "The editor is already empty.";

            return;

        }


        if (
            !confirm(
                "Are you sure you want to clear your lyrics?"
            )
        ) {
            return;
        }


        editor.value = "";


        status.textContent =
            "✅ Lyrics cleared.";

    });

}


/* ==========================================
   DRUM SEPARATION PAGE
========================================== */

function initializeDrumSeparation() {

    handleAudioUpload(
        "drumUpload",
        "drumStatus"
    );


    const button = document.getElementById(
        "separateDrums"
    );


    const status = document.getElementById(
        "separationStatus"
    );


    if (!button || !status) return;


    button.addEventListener("click", () => {

        if (!uploadedAudio) {

            alert("Upload an audio file first.");

            return;

        }


        status.innerHTML = `

            <div class="tool-card">

                <h3>🥁 DRUM SEPARATION NOT YET CONNECTED</h3>

                <p>
                    Your audio upload was successful.
                </p>

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

    handleAudioUpload(
        "stemUpload",
        "stemStatus"
    );


    const button = document.getElementById(
        "separateStems"
    );


    const status = document.getElementById(
        "stemStatus"
    );


    if (!button || !status) return;


    button.addEventListener("click", async () => {

        if (!uploadedAudio) {

            alert("Upload an audio file first.");

            return;

        }


        const formData = new FormData();


        formData.append(
            "audio",
            uploadedAudio
        );


        formData.append(
            "model",
            "audio-separation-2"
        );


        button.disabled = true;

        button.textContent = "⏳ PROCESSING...";


        status.textContent =
            "Preparing audio separation...";


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


            const downloadURL = new URL(
                stemData.zip_url,
                window.location.origin
            );


            if (
                !["https:", "http:"].includes(downloadURL.protocol)
            ) {

                throw new Error(
                    "The server returned an invalid download link."
                );

            }


            status.innerHTML = "";


            const message = document.createElement("p");

            message.textContent =
                "✅ Your separated audio tracks are ready!";


            const downloadLink = document.createElement("a");

            downloadLink.href = downloadURL.href;

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

            button.textContent =
                "SEPARATE AUDIO STEMS";

        }

    });

}


/* ==========================================
   PAGE INITIALIZER
========================================== */

function initializePage(page) {


    /* MUSIC COLLECTION */

    if (
        page === "music" ||
        page === "library"
    ) {

        renderMusicCollection();

    }


    /* SONG AND INSTRUMENTAL GENERATOR */

    if (page === "create") {

        initializeSongGenerator();

        initializeInstrumentalGenerator();

    }


    /* LYRICS STUDIO */

    if (page === "lyrics") {

        initializeLyricsGenerator();

        initializeLyricsEditor();

    }


    /* DRUM SEPARATION */

    if (page === "drums") {

        initializeDrumSeparation();

    }


    /* FULL STEM SEPARATION */

    if (page === "stems") {

        initializeStemSeparation();

    }

}


/* ==========================================
   APPLICATION STARTUP
========================================== */

navigate("dashboard");


console.log(
    "GENERAL MUSIC AI V1.0 initialized successfully."
);
