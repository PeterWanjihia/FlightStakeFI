/*
 * =========================================
 * Chainlink Functions "Messenger" Script (v2.0 - Self-Contained)
 * =========================================
 * This one file contains ALL off-chain logic:
 * 1. The Pricing Engine (the "Brain")
 * 2. The Chainlink Script (the "Messenger")
*/

// --- Constants ---
const SECONDS_PER_DAY = 86400;
const MAX_DECAY_DAYS = 90;

function calculateTimeDecay(departureTimestamp) {
  const now = Date.now() / 1000;
  const secondsLeft = departureTimestamp - now;

  if (secondsLeft <= 0) {
    return 0.0;
  }

  const daysLeft = secondsLeft / SECONDS_PER_DAY;
  if (daysLeft >= MAX_DECAY_DAYS) {
    return 1.0;
  }

  return daysLeft / MAX_DECAY_DAYS;
}

function calculateRiskPenalty(basePrice, riskFactor) {
  return basePrice * riskFactor;
}

function calculateFinalPrice(apiData) {
  const basePrice = apiData.basePriceUSD;
  const departureTime = apiData.departureTimestamp;
  const risk = apiData.cancellationRisk;

  const timeFactor = calculateTimeDecay(departureTime);
  const timeAdjustedPrice = basePrice * timeFactor;

  const riskPenalty = calculateRiskPenalty(basePrice, risk);

  let finalPrice = timeAdjustedPrice - riskPenalty;

  if (finalPrice < 0) {
    finalPrice = 0;
  }

  // Scale to USDC decimals (6)
  return Math.floor(finalPrice * 1_000_000);
}

// =========================================
// DELIVERABLE 3: The Chainlink "Messenger"
// =========================================

if (args.length < 1) {
  throw new Error("Missing tokenId. Must be passed in 'args[0]'.");
}
const tokenId = args[0];

// This is the public URL for our "Data Source" (Deliverable 1)
const API_URL = `https://flightstakefi.onrender.com/flight-data/${tokenId}`;

console.log(`[Chainlink] Starting job for Token ID: ${tokenId}`);
console.log(`[Chainlink] Fetching data from: ${API_URL}`);

// 1. FETCH
const apiResponse = await Functions.makeHttpRequest({
  url: API_URL
});

if (apiResponse.error) {
  console.error("[Chainlink] API request failed:", apiResponse.error);
  throw new Error(`API request failed for token ${tokenId}`);
}

const apiData = apiResponse.data;
console.log(`[Chainlink] API Response OK`);

// 2. COMPUTE
// We can now call the function *directly* since it's in the same file.
console.log(`[Chainlink] Running pricing engine...`);
const finalPrice = calculateFinalPrice(apiData);
console.log(`[Chainlink] Final computed price: $${finalPrice}`);

// 3. RETURN
return Functions.encodeUint256(finalPrice);