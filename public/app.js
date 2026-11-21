/* ==================================
   GENERAL MUSIC AI V1.0
   APPLICATION CONTROLLER
================================== */

const app = document.querySelector(".main");

const originalDashboard = app.innerHTML;

let currentPage = "dashboard";
let uploadedAudio = null;
let musicLibrary = [];

/* ==================================
   PAGE NAVIGATION
================================== */

const pages = {

    dashboard: originalDashboard,

      create: `
        <section class="library">
            <h2>🎵 AI MUSIC GENERATOR</h2>
            <p class="description">
                Turn your imagination into music.
            </p>

            <form id="musicForm">

                <label>Song Title</label>
                <input
                    id="songTitle"
                    type="text"
                    placeholder="Enter your song title"
                    required
                >

                <label>Describe Your Music</label>
                <textarea
                    id="musicPrompt"
                    placeholder="Describe the sound, mood and instruments..."
                    required
                ></textarea>

                <label>Write or Paste Your Lyrics</label>
                <textarea
                    id="songLyrics"
                    placeholder="Enter your original song lyrics here..."
                    required
                ></textarea>

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

                <label>Vocal Style</label>
                <select id="vocal">
                    <option value="male">Male Vocals</option>
                    <option value="female">Female Vocals</option>
                </select>

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
                    ✨ Generate AI Song
                </button>

            </form>

            <div id="generationStatus"></div>
        </section>
    `,
    
    lyrics: `
        <section class="library">
            <h2>✍️ LYRICS STUDIO</h2>

            <p>Create original lyrics for your next song.</p>

            <form id="lyricsForm">

                <label>Song Theme</label>

                <textarea id="lyricsTheme"
                placeholder="What should your song be about?"
                required></textarea>

                <label>Music Style</label>

                <select id="lyricsGenre">
                    <option>Afrobeats</option>
                    <option>Gospel</option>
                    <option>Hip-Hop</option>
                    <option>R&B</option>
                    <option>Amapiano</option>
                </select>

                <button class="primary-btn" type="submit">
                    Generate Lyrics
                </button>

            </form>

            <div id="lyricsResult"></div>
        </section>
    `,

    drums: `
        <section class="library">
            <h2>🥁 DRUM SEPARATION STUDIO</h2>

            <p>Extract individual drum components from your music.</p>

            <div class="empty-state">
                <div>🥁</div>
                <h3>Upload Your Audio</h3>
                <p>Supported formats: MP3, WAV, M4A</p>

                <input type="file" id="drumUpload"
                accept="audio/*">

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

            <button class="primary-btn" id="separateDrums">
                Separate All Drums
            </button>

            <div id="separationStatus"></div>
        </section>
    `,

    stems: `
        <section class="library">
            <h2>🎚️ FULL STEM SEPARATION</h2>

            <p>Separate your music into individual audio tracks.</p>

            <div class="empty-state">
                <div>🎧</div>
                <h3>Upload an Audio File</h3>

                <input type="file" id="stemUpload"
                accept="audio/*">

                <div id="stemStatus"></div>
            </div>

            <div class="tools">
                <div class="tool-card">🎤<h3>Vocals</h3></div>
                <div class="tool-card">🥁<h3>Drums</h3></div>
                <div class="tool-card">🎸<h3>Bass</h3></div>
                <div class="tool-card">🎹<h3>Other Instruments</h3></div>
            </div>

            <button class="primary-btn" id="separateStems">
                Separate Audio Stems
            </button>
        </section>
    `,

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

    library: `
        <section class="library">
            <h2>▶️ MUSIC LIBRARY</h2>
            <p>Manage and play your music.</p>

            <div class="empty-state">
                <div>🎧</div>
                <h3>Your audio library</h3>
                <p>Your saved audio will appear here.</p>
            </div>
        </section>
    `,

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

/* ==================================
   NAVIGATION CONTROLLER
================================== */

function navigate(page) {

    if (!pages[page]) return;

    currentPage = page;

    app.innerHTML = pages[page];

    document.querySelectorAll(".sidebar nav a")
    .forEach(link => {

        link.classList.toggle(
            "active",
            link.dataset.page === page ||
            (page === "dashboard" &&
            link.textContent.includes("Dashboard"))
        );

    });

    window.scrollTo(0, 0);

    initializePage(page);
}

/* ==================================
   BUTTON AND LINK EVENTS
================================== */

document.addEventListener("click", event => {

    const target = event.target.closest("[data-page]");

    if (target) {

        event.preventDefault();

        navigate(target.dataset.page);

    }

});

/* ==================================
   FILE UPLOAD PREVIEW
================================== */

function handleAudioUpload(inputId, statusId) {

    const input = document.getElementById(inputId);

    if (!input) return;

    input.addEventListener("change", () => {

        const file = input.files[0];

        if (!file) return;

        if (!file.type.startsWith("audio/")) {

            alert("Please select a valid audio file.");

            input.value = "";

            return;
        }

        uploadedAudio = file;

        document.getElementById(statusId).innerHTML = `
            <div class="tool-card">
                <h3>✅ Audio Uploaded</h3>
                <p>${escapeHTML(file.name)}</p>
                <p>${(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
        `;

    });

}

/* ==================================
   CHECK MUSIC GENERATION STATUS
================================== */

async function checkMusicTask(taskId, statusElement, title) {

    const terminalStatuses = [
        "succeeded",
        "failed",
        "timeouted",
        "cancelled"
    ];

    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {

        attempts++;

        try {

            const response = await fetch(
                `/api/music/task/song/${encodeURIComponent(taskId)}`
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || "Unable to check task status."
                );
            }

            const task = result.task;

            const taskStatus = String(
                task.status || "processing"
            ).toLowerCase();

            const savedTasks = JSON.parse(
                localStorage.getItem("gtp_music_tasks") || "[]"
            );

            let audioUrl = "";

            if (
                taskStatus === "succeeded" &&
                Array.isArray(task.choices) &&
                task.choices.length > 0
            ) {

                const firstChoice = task.choices[0];

                if (
                    firstChoice.wav_url &&
                    typeof firstChoice.wav_url === "string" &&
                    firstChoice.wav_url.startsWith("https://")
                ) {
                    audioUrl = firstChoice.wav_url;
                }

            }

            const updatedTasks = savedTasks.map(item =>
                item.id === taskId
                    ? {
                        ...item,
                        status: taskStatus,
                        ...(audioUrl ? { audioUrl: audioUrl } : {})
                    }
                    : item
            );

            localStorage.setItem(
                "gtp_music_tasks",
                JSON.stringify(updatedTasks)
            );

            if (statusElement && statusElement.isConnected) {

                statusElement.innerHTML = `
                    <div class="tool-card">
                        <h3>🎵 ${escapeHTML(title)}</h3>
                        <p>Generation status: ${escapeHTML(taskStatus)}</p>
                        <p>Check ${attempts} of ${maxAttempts}</p>
                    </div>
                `;

            }

            if (terminalStatuses.includes(taskStatus)) {

                if (statusElement && statusElement.isConnected) {

                    statusElement.innerHTML = `
                        <div class="tool-card">

                            <h3>${taskStatus === "succeeded"
                                ? "✅ SONG GENERATION COMPLETED"
                                : "⚠️ GENERATION ENDED"}</h3>

                            <p>${escapeHTML(title)}</p>

                            <p>Status: ${escapeHTML(taskStatus)}</p>

                            ${audioUrl
                                ? "<p>🎧 Audio link saved successfully.</p>"
                                : taskStatus === "succeeded"
                                    ? "<p>Audio link was not found in the returned result.</p>"
                                    : ""
                            }

                        </div>
                    `;

                }

                return;
            }

        } catch (error) {

            if (statusElement && statusElement.isConnected) {

                statusElement.innerHTML = `
                    <div class="tool-card">
                        <h3>⚠️ STATUS CHECK ERROR</h3>
                        <p>${escapeHTML(error.message)}</p>
                    </div>
                `;

            }

            return;
        }

        await new Promise(resolve =>
            setTimeout(resolve, 10000)
        );

    }

}

/* ==================================
   MY MUSIC LIBRARY
================================== */

function renderMusicCollection() {

    const collection = document.getElementById("musicCollection");

    if (!collection) return;

    const savedTasks = JSON.parse(
        localStorage.getItem("gtp_music_tasks") || "[]"
    );

    if (!savedTasks.length) {

        collection.innerHTML = `
            <div class="empty-state">
                <div>🎼</div>
                <h3>Your music collection is empty</h3>
                <p>Generated songs will appear here.</p>
            </div>
        `;

        return;
    }

    collection.innerHTML = savedTasks.map(song => `
        <div class="tool-card">
            <h3>🎵 ${escapeHTML(song.title || "Untitled Song")}</h3>
            <p>Type: ${escapeHTML(song.type || "song")}</p>
            <p>Status: ${escapeHTML(song.status || "preparing")}</p>
            <p>Task ID: ${escapeHTML(song.id)}</p>
            <p>Created: ${escapeHTML(
                song.createdAt
                    ? new Date(song.createdAt).toLocaleString()
                    : "Unknown"
            )}</p>
        </div>
    `).join("");

}
function initializePage(page) {
       if (page === "music") {

        renderMusicCollection();

    }

        if (page === "create") {

        const musicForm = document.getElementById("musicForm");

        musicForm.addEventListener("submit", async event => {

            event.preventDefault();

            const title = document.getElementById("songTitle").value.trim();
            const prompt = document.getElementById("musicPrompt").value.trim();
            const lyrics = document.getElementById("songLyrics").value.trim();
            const genre = document.getElementById("genre").value;
            const gender = document.getElementById("vocal").value;
            const model = document.getElementById("musicModel").value;

            const status = document.getElementById("generationStatus");

            if (!title || !prompt || !lyrics) {
                status.innerHTML = `
                    <div class="tool-card">
                        <h3>⚠️ Missing Information</h3>
                        <p>Please complete all required fields.</p>
                    </div>
                `;
                return;
            }

            status.innerHTML = `
                <div class="tool-card">
                    <h3>⏳ Connecting to music server...</h3>
                    <p>Please wait.</p>
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

                const result = await response.json();

                if (!response.ok) {

                    if (response.status === 503) {
                        status.innerHTML = `
                            <div class="tool-card">
                                <h3>🔐 BACKEND CONNECTION SUCCESSFUL</h3>
                                <p>Your request reached our server.</p>
                                <p>${escapeHTML(result.message)}</p>
                                <p>✅ No Mureka generation was started.</p>
                            </div>
                        `;
                        return;
                    }

                    throw new Error(
                        result.message || "Server request failed."
                    );
                }

                const task = result.task;

if (!task || !task.id) {
    throw new Error("No task ID was returned by the music server.");
}

const savedTasks = JSON.parse(
    localStorage.getItem("gtp_music_tasks") || "[]"
);

const newTask = {
    id: task.id,
    title: title,
    type: "song",
    status: task.status || "preparing",
    createdAt: new Date().toISOString()
};

savedTasks.unshift(newTask);

localStorage.setItem(
    "gtp_music_tasks",
    JSON.stringify(savedTasks)
);

status.innerHTML = `
    <div class="tool-card">
        <h3>✅ SONG TASK CREATED</h3>
        <p>Title: ${escapeHTML(title)}</p>
        <p>Task ID: ${escapeHTML(task.id)}</p>
        <p>Status: ${escapeHTML(task.status || "preparing")}</p>
        <p>Your generation request has been recorded.</p>
    </div>
`;

checkMusicTask(
    task.id,
    status,
    title
);

            } catch (error) {

                status.innerHTML = `
                    <div class="tool-card">
                        <h3>❌ CONNECTION ERROR</h3>
                        <p>${escapeHTML(error.message)}</p>
                    </div>
                `;

            }

        });

    }    
    if (page === "lyrics") {

        document.getElementById("lyricsForm")
        .addEventListener("submit", event => {

            event.preventDefault();

            document.getElementById(
                "lyricsResult"
            ).innerHTML = `
                <div class="tool-card">
                    <h3>Lyrics Request Prepared</h3>
                    <p>Your songwriting request is ready for AI integration.</p>
                </div>
            `;

        });

    }

    if (page === "drums") {

        handleAudioUpload(
            "drumUpload",
            "drumStatus"
        );

        document.getElementById("separateDrums")
        .addEventListener("click", () => {

            if (!uploadedAudio) {

                alert("Upload an audio file first.");

                return;
            }

            alert("Drum separation API will be connected in a later stage.");

        });

    }

    if (page === "stems") {

        uploadedAudio = null;

        handleAudioUpload(
            "stemUpload",
            "stemStatus"
        );

        document.getElementById("separateStems")
        .addEventListener("click", () => {

            if (!uploadedAudio) {

                alert("Upload an audio file first.");

                return;
            }

            alert("Stem separation API will be connected in a later stage.");

        });

    }

}

/* ==================================
   SECURITY HELPER
================================== */

function escapeHTML(value) {

    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);

}

/* ==================================
   INITIALIZE
================================== */

navigate("dashboard");

console.log("GENERAL MUSIC AI V1.0 initialized.");
