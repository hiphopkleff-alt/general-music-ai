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
            <p class="description">Turn your imagination into music.</p>

            <form id="musicForm">

                <label>Describe your music</label>
                <textarea id="musicPrompt"
                placeholder="Describe the song you want to create..."
                required></textarea>

                <label>Music Genre</label>
                <select id="genre">
                    <option>Afrobeats</option>
                    <option>Gospel</option>
                    <option>Amapiano</option>
                    <option>Hip-Hop</option>
                    <option>R&B</option>
                    <option>Reggae</option>
                    <option>Pop</option>
                    <option>Jazz</option>
                    <option>Electronic</option>
                </select>

                <label>Vocal Style</label>
                <select id="vocal">
                    <option>Male Vocals</option>
                    <option>Female Vocals</option>
                    <option>Duet</option>
                    <option>Instrumental Only</option>
                </select>

                <label>Song Title</label>
                <input id="songTitle"
                placeholder="Enter song title">

                <button class="primary-btn" type="submit">
                    ✨ Generate Music
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
   GENERATION FORM
================================== */

function initializePage(page) {

    if (page === "create") {

        document.getElementById("musicForm")
        .addEventListener("submit", event => {

            event.preventDefault();

            document.getElementById(
                "generationStatus"
            ).innerHTML = `
                <div class="tool-card">
                    <h3>🎵 Generation Setup Complete</h3>
                    <p>Your music request is ready.</p>
                    <p>AI music API connection is the next stage.</p>
                </div>
            `;

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
