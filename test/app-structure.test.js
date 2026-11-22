const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const server = read("server.js");
const app = read("public/app.js");

const pages = {
    dashboard: ["index.html", "/"],
    create: ["create.html", "/create"],
    lyrics: ["lyrics.html", "/lyrics"],
    drums: ["drums.html", "/drums"],
    stems: ["stems.html", "/stems"],
    music: ["music.html", "/music"],
    library: ["library.html", "/library"],
    settings: ["settings.html", "/settings"]
};

test("all eight page files exist and load the shared app assets", () => {
    for (const [slug, [file]] of Object.entries(pages)) {
        const html = read(path.join("public", file));
        assert.match(html, /<main\b[^>]*class="main"/i, file + " has main app container");
        assert.match(html, /id="globalAudio"/, file + " has global audio player");
        assert.match(html, /src="\/app\.js\?v=3"/, file + " loads current app script");
        assert.match(html, new RegExp('class="active" data-page="' + slug + '"'), file + " highlights correct navigation item");
    }
});

test("server maps every page URL to its own HTML document", () => {
    for (const [slug, [file, route]] of Object.entries(pages)) {
        assert.ok(server.includes('"' + route + '": "' + file + '"'), route + " route mapping exists");
    }
});

test("client route map contains all eight pages", () => {
    for (const [slug, [, route]] of Object.entries(pages)) {
        assert.ok(app.includes(slug + ': "' + route + '"'), slug + " client route exists");
    }
});

test("each feature page has its page initializer wired", () => {
    for (const slug of ["create", "lyrics", "drums", "stems", "settings"]) {
        assert.match(app, new RegExp('if \\(page === "' + slug + '"\\)'));
    }
    for (const fn of [
        "initializeSongGenerator",
        "initializeInstrumentalGenerator",
        "initializeLyricsGenerator",
        "initializeLyricsEditor",
        "initializeDrumSeparation",
        "initializeStemSeparation",
        "initializeSettings"
    ]) {
        assert.ok(app.includes("function " + fn + "("), fn + " is defined");
    }
});

test("paid Mureka operations remain disabled by default", () => {
    assert.match(server, /const MUREKA_GENERATION_ENABLED = false;/);
    assert.match(server, /const MUREKA_STEM_ENABLED = false;/);
});

test("drum separation is not falsely presented as connected", () => {
    assert.match(app, /DRUM SEPARATION NOT YET CONNECTED/);
});

test("player defaults to a usable volume and settings persist preferences", () => {
    assert.ok(app.includes('const storedVolume = localStorage.getItem(PLAYER_VOLUME_KEY);'));
    assert.ok(app.includes('const savedVolume = storedVolume === null ? 0.8 : Number(storedVolume);'));
    assert.ok(app.includes('localStorage.setItem(PLAYER_VOLUME_KEY, String(volume))'));
    assert.ok(app.includes('localStorage.setItem(AUTOPLAY_NEXT_KEY, String(autoplayInput.checked))'));
});

test("navigation uses in-app page rendering for links and buttons", () => {
    for (const [slug, [, route]] of Object.entries(pages)) {
        for (const [otherSlug, [otherFile]] of Object.entries(pages)) {
            const html = read(path.join("public", otherFile));
            assert.ok(
                html.includes('href="' + route + '" data-page="' + slug + '"') ||
                html.includes('href="' + route + '" class="active" data-page="' + slug + '"'),
                otherFile + " links to " + slug + " using its real page URL"
            );
        }
    }

    assert.match(app, /event\.preventDefault\(\);\s*navigate\(destination\);/);
    assert.doesNotMatch(app, /window\.location\.assign\(destination\);/);
});
