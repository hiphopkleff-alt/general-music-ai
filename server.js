const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;
const MUREKA_URL = "https://api.mureka.ai";


// SECURITY
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            mediaSrc: ["'self'", "blob:", "https:"]
        }
    }
}));


// REQUEST CONFIGURATION
app.use(express.json({
    limit: "100kb"
}));


// SERVE WEBSITE
app.use(express.static(
    path.join(__dirname, "public")
));


// MUREKA API HELPER
async function murekaRequest(endpoint, method, data = null) {

    if (!process.env.MUREKA_API_KEY) {
        const error = new Error(
            "Mureka API key is not configured."
        );

        error.status = 503;
        throw error;
    }

    const response = await fetch(
        `${MUREKA_URL}${endpoint}`,
        {
            method,

            headers: {
                "Authorization":
                    `Bearer ${process.env.MUREKA_API_KEY}`,

                "Content-Type": "application/json"
            },

            ...(data ? {
                body: JSON.stringify(data)
            } : {}),

            signal: AbortSignal.timeout(30000)
        }
    );

    const result = await response.json();

    if (!response.ok) {

        const error = new Error(
            result?.error?.message ||
            "Mureka API request failed."
        );

        error.status = response.status;

        throw error;
    }

    return result;
}


// HEALTH CHECK
app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        application: "GENERAL MUSIC AI",
        version: "V1.0",
        status: "online",

        murekaKeyConfigured:
            Boolean(process.env.MUREKA_API_KEY),

        musicGeneration:
            process.env.MUREKA_API_KEY
                ? "configured"
                : "not_configured",

        stemSeparation: "not_connected"
    });

});


// APPLICATION INFORMATION
app.get("/api/info", (req, res) => {

    res.json({
        name: "GENERAL MUSIC AI",
        version: "V1.0",
        description: "CREATE. SEPARATE. PRODUCE.",

        features: [
            "AI Music Generation",
            "Instrumental Generation",
            "Lyrics Generation",
            "Lyrics Studio",
            "Drum Separation",
            "Stem Separation",
            "Music Library"
        ]
    });

});


// MODEL VALIDATION
const allowedModels = [
    "auto",
    "mureka-7.6",
    "mureka-o2",
    "mureka-8",
    "mureka-9",
    "mureka-9.5"
];


// GENERATE FULL AI SONG
app.post("/api/music/generate-song", async (req, res) => {

    try {

        const {
            lyrics,
            prompt,
            gender,
            model,
            duration
        } = req.body;

        if (
            typeof lyrics !== "string" ||
            !lyrics.trim() ||
            lyrics.length > 5000
        ) {
            return res.status(400).json({
                success: false,
                message: "Lyrics are required and must not exceed 5000 characters."
            });
        }

        if (
            prompt !== undefined &&
            (
                typeof prompt !== "string" ||
                prompt.length > 1024
            )
        ) {
            return res.status(400).json({
                success: false,
                message: "Music prompt must not exceed 1024 characters."
            });
        }

        if (
            gender !== undefined &&
            !["male", "female"].includes(gender)
        ) {
            return res.status(400).json({
                success: false,
                message: "Gender must be male or female."
            });
        }

        const selectedModel = model || "auto";

        if (!allowedModels.includes(selectedModel)) {
            return res.status(400).json({
                success: false,
                message: "Unsupported Mureka model."
            });
        }

        const data = {
            lyrics: lyrics.trim(),
            model: selectedModel,
            n: 1
        };

        if (prompt) data.prompt = prompt;

        if (gender) data.gender = gender;

        if (duration !== undefined) {

            if (
                selectedModel !== "mureka-9.5" ||
                !Number.isInteger(duration) ||
                duration < 120 ||
                duration > 300
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Duration must be 120–300 seconds and requires mureka-9.5."
                });
            }

            data.duration = duration;
        }

        const result = await murekaRequest(
            "/v1/song/generate",
            "POST",
            data
        );

        res.json({
            success: true,
            type: "song",
            task: result
        });

    } catch (error) {

        console.error(
            "Song generation error:",
            error.message
        );

        res.status(error.status || 502).json({
            success: false,
            message: error.message
        });

    }

});


// GENERATE INSTRUMENTAL / BEAT
app.post("/api/music/generate-instrumental", async (req, res) => {

    try {

        const {
            prompt,
            model
        } = req.body;

        if (
            typeof prompt !== "string" ||
            !prompt.trim() ||
            prompt.length > 1024
        ) {
            return res.status(400).json({
                success: false,
                message: "A music prompt is required (maximum 1024 characters)."
            });
        }

        const selectedModel = model || "auto";

        if (
            ![
                "auto",
                "mureka-7.6",
                "mureka-8",
                "mureka-9",
                "mureka-9.5"
            ].includes(selectedModel)
        ) {
            return res.status(400).json({
                success: false,
                message: "Unsupported instrumental model."
            });
        }

        const result = await murekaRequest(
            "/v1/instrumental/generate",
            "POST",
            {
                prompt: prompt.trim(),
                model: selectedModel,
                n: 1
            }
        );

        res.json({
            success: true,
            type: "instrumental",
            task: result
        });

    } catch (error) {

        console.error(
            "Instrumental generation error:",
            error.message
        );

        res.status(error.status || 502).json({
            success: false,
            message: error.message
        });

    }

});


// GENERATE LYRICS
app.post("/api/music/generate-lyrics", async (req, res) => {

    try {

        const { prompt } = req.body;

        if (
            typeof prompt !== "string" ||
            !prompt.trim() ||
            prompt.length > 2000
        ) {
            return res.status(400).json({
                success: false,
                message: "Please provide a lyrics description."
            });
        }

        const result = await murekaRequest(
            "/v1/lyrics/generate",
            "POST",
            {
                prompt: prompt.trim()
            }
        );

        res.json({
            success: true,
            lyrics: result
        });

    } catch (error) {

        console.error(
            "Lyrics generation error:",
            error.message
        );

        res.status(error.status || 502).json({
            success: false,
            message: error.message
        });

    }

});


// CHECK GENERATION STATUS
app.get("/api/music/task/:type/:id", async (req, res) => {

    try {

        const { type, id } = req.params;

        if (!["song", "instrumental"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task type."
            });
        }

        if (!/^[a-zA-Z0-9_-]{1,150}$/.test(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID."
            });
        }

        const endpoint =
            type === "song"
                ? `/v1/song/query/${encodeURIComponent(id)}`
                : `/v1/instrumental/query/${encodeURIComponent(id)}`;

        const result = await murekaRequest(
            endpoint,
            "GET"
        );

        res.json({
            success: true,
            task: result
        });

    } catch (error) {

        console.error(
            "Task status error:",
            error.message
        );

        res.status(error.status || 502).json({
            success: false,
            message: error.message
        });

    }

});

// SECURE MUREKA BALANCE CHECK
app.get("/api/mureka/balance", async (req, res) => {

    try {

        const suppliedToken =
            req.get("x-billing-check-token") || "";

        const savedToken =
            process.env.BILLING_CHECK_TOKEN || "";

        if (!savedToken || !suppliedToken) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const suppliedBuffer =
            Buffer.from(suppliedToken);

        const savedBuffer =
            Buffer.from(savedToken);

        if (
            suppliedBuffer.length !== savedBuffer.length ||
            !crypto.timingSafeEqual(
                suppliedBuffer,
                savedBuffer
            )
        ) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized."
            });
        }

        const result = await murekaRequest(
            "/v1/account/billing",
            "GET"
        );

        res.json({
            success: true,
            balanceUSD: result.balance / 100,
            totalRechargeUSD: result.total_recharge / 100,
            totalSpendingUSD: result.total_spending / 100,
            currency: "USD"
        });

    } catch (error) {

        console.error(
            "Mureka balance check failed:",
            error.message
        );

        res.status(error.status || 502).json({
            success: false,
            message: "Unable to retrieve Mureka balance."
        });

    }

});

// UNKNOWN API ROUTES
app.use("/api", (req, res) => {

    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });

});


// START SERVER
app.listen(PORT, () => {

    console.log(
        `GENERAL MUSIC AI running on port ${PORT}`
    );

});
