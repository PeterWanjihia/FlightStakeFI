import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "*", // Allow all for dev
        methods: ["GET", "POST"]
    }
});

const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());

// --- API ROUTES ---

// 1. Get User Portfolio
app.get("/api/portfolio/:address", async (req, res) => {
    const { address } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { address },
            include: {
                tickets: true,
                listings: true,
                transactions: {
                    orderBy: { timestamp: 'desc' },
                    take: 10
                }
            }
        });
        res.json(user || { message: "User not found", tickets: [], transactions: [] });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Get All Listings
app.get("/api/market", async (req, res) => {
    try {
        const listings = await prisma.listing.findMany({
            where: { active: true },
            include: { ticket: true }
        });
        res.json(listings);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Verify PNR (Mock)
app.post("/api/verify-pnr", (req, res) => {
    const { pnr } = req.body;
    // Mock Logic
    if (pnr && pnr.length === 6) {
        res.json({
            valid: true,
            flight: {
                flightNumber: "KQ101",
                origin: "NBO",
                destination: "LHR",
                departureTime: Math.floor(Date.now() / 1000) + 86400 * 2
            }
        });
    } else {
        res.status(400).json({ valid: false, message: "Invalid PNR" });
    }
});

// --- SOCKET.IO ---
io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`❌ Client disconnected: ${socket.id}`);
    });
});

// --- START LISTENER ---
// We run the listener as a separate process or just import it. 
// For robustness, let's spawn it so if it crashes, the API stays up.
const startListener = () => {
    console.log("Starting Event Listener subprocess...");
    const listenerPath = path.join(__dirname, "services/listener.js");
    const listener = spawn("node", [listenerPath], { stdio: "inherit" });

    listener.on("close", (code) => {
        console.log(`Listener exited with code ${code}. Restarting...`);
        setTimeout(startListener, 5000);
    });
};

// --- START SERVER ---
httpServer.listen(PORT, () => {
    console.log(`\n🚀 FlightStakeFi Backend running on port ${PORT}`);
    console.log(`   API: http://localhost:${PORT}`);

    // Start the Ear
    startListener();
});
