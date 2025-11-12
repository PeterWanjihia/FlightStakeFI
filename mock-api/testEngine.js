// Import our "Brain"
const { calculateFinalPrice } = require('./pricingEngine.js');

// --- Main Test Function ---
async function runApiTest() {
  console.log("🚀 Running Pricing Engine integration test (hitting live API)...");
  console.log("==================================================");

  // We will test these two tokens
  const tokenIdsToTest = [1, 3];
  
  for (const tokenId of tokenIdsToTest) {
    let apiData;
    try {
      // 1. HIT THE API
      // This makes a *real* network request to your running 'index.js' server
      const response = await fetch(`http://127.0.0.1:3001/flight-data/${tokenId}`);
      
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }
      
      apiData = await response.json();
      console.log(`\n--- [SUCCESS] Fetched data for Token ID #${tokenId} ---`);

    } catch (err) {
      console.error(`\n--- [FAIL] Could not fetch data for Token ID #${tokenId} ---`);
      console.error(err.message);
      continue; // Skip to the next token
    }

    // 2. RUN THE BRAIN
    // We pass the data we *just fetched* into our pricing engine
    const finalPrice = calculateFinalPrice(apiData);

    // 3. Log the results
    const now = new Date();
    const departure = new Date(apiData.departureTimestamp * 1000);
    const daysLeft = (departure - now) / (1000 * 60 * 60 * 24);

    console.log(`   Base Price: $${apiData.basePriceUSD}`);
    console.log(`   Days Left: ~${daysLeft.toFixed(2)}`);
    console.log(`   Cancellation Risk: ${apiData.cancellationRisk * 100}%`);
    console.log(`   ------------------`);
    console.log(`   >>> FINAL PRICE: $${finalPrice}`);
  }

  console.log("\n==================================================");
  console.log("✅ API Integration Test complete.");
}

// Run the main test function
runApiTest();