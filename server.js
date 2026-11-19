const express = require("express");
const helmet = require("helmet");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

// Security headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            mediaSrc: ["'self'", "blob:"]
        }
    }
}));

// Request configuration
app.use(express.json({
    limit: "100kb"
}));

// Serve application files
app.use(express.static(
    path.join(__dirname, "public")
));

// Health check
app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        application: "GENERAL MUSIC AI",
        version: "V1.0",
        status: "online",
        musicGeneration: "not_connected",
        stemSeparation: "not_connected"
    });

});

// Application information
app.get("/api/info", (req, res) => {

    res.json({
        name: "GENERAL MUSIC AI",
        version: "V1.0",
        description: "CREATE. SEPARATE. PRODUCE.",
        features: [
            "AI Music Generation",
            "Lyrics Studio",
            "Drum Separation",
            "Stem Separation",
            "Music Library"
        ]
    });

});

// Handle unknown API routes
app.use("/api", (req, res) => {

    res.status(404).json({
        success: false,
        message: "API endpoint not found."
    });

});

// Start server
app.listen(PORT, () => {

    console.log(
        `GENERAL MUSIC AI running on port ${PORT}`
    );

});
