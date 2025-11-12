const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = process.env.PORT || 3001;
let database;

// --- Setup Middleware ---
app.use(cors());

// --- Define the Endpoint ---
app.get('/flight-data/:tokenId', (req, res) => {
  const { tokenId } = req.params;

  if (database && database[tokenId]) {
    console.log(`[OK] Returning data for token: ${tokenId}`);
    res.json({
      tokenId: tokenId,
      ...database[tokenId]
    });
  } else {
    console.log(`[WARN] No data found for token: ${tokenId}`);
    res.status(404).json({ error: "Token data not found" });
  }
});

// --- Create the "Startup" Function ---
// This function loads data *first*, then starts the server.
async function startServer() {
  try {
    // 1. Load the database first
    const dbPath = path.resolve(__dirname, 'db.json');
    const data = await fs.readFile(dbPath, 'utf8');
    database = JSON.parse(data);
    console.log(`   Loaded ${Object.keys(database).length} token records from db.json`);

    // 2. NOW, start listening for requests
    // This is the *last* step and will keep the server running.
    app.listen(port, () => {
      console.log(`✅ Mock Flight API listening on http://localhost:${port}`);
    });

  } catch (err) {
    console.error("❌ FAILED TO LOAD DATABASE (db.json):", err);
    process.exit(1);
  }
}

// --- Run the Startup Function ---
startServer();