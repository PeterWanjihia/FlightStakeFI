import hre from "hardhat";

// --- CONFIGURATION ---
const TOKEN_ID_TO_TEST = 3;
// ---------------------

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  // --- THIS IS THE FIX ---
  console.log("🚀 Starting Phase 2 'Final Exam' Test: The Oracle Pipeline...");
  // --- END OF FIX ---
  console.log("=".repeat(70));

  // --- 1. SETUP ---
  console.log("\n--- 1. SETUP ---");
  const [admin] = await hre.ethers.getSigners();
  console.log(`   Signer (Admin): ${admin.address}`);

  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  if (!oracleAddress) {
    throw new Error("❌ PRICING_ORACLE_ADDRESS is not set in .env file.");
  }
  console.log(`   Oracle Contract: ${oracleAddress}`);

  const oracle = await hre.ethers.getContractAt("PricingOracle", oracleAddress, admin);
  console.log("   ✅ Connected to PricingOracle.");

  // --- 2. PRE-TEST CHECK ---
  console.log("\n--- 2. PRE-TEST CHECK ---");
  let price = await oracle.getPrice(TOKEN_ID_TO_TEST);
  console.log(`   Current price for Token ${TOKEN_ID_TO_TEST}: $${price.toString()}`);
  if (price.toString() !== "0") {
    console.log("   🟡 Warning: Price is not 0. Test will still proceed.");
  } else {
    console.log("   ✅ Price is 0, as expected.");
  }

  // --- 3. THE "TRIGGER" (Deliverable 4) ---
  console.log("\n--- 3. THE TRIGGER ---");
  console.log(`   Calling oracle.requestPriceUpdate(${TOKEN_ID_TO_TEST})...`);
  
  const tx = await oracle.requestPriceUpdate(TOKEN_ID_TO_TEST);
  const receipt = await tx.wait(1);
  
  // We need to parse the logs to find the requestId
  const event = receipt.logs.find(log => log.eventName === 'PriceRequestSent');
  if (!event) {
    throw new Error("❌ FAILED: PriceRequestSent event not found in transaction logs.");
  }
  
  const requestId = event.args[0];
  console.log(`   ✅ Price request sent! (Request ID: ${requestId})`);

  // --- 4. THE "WAIT" (The Pipeline Runs) ---
  console.log("\n--- 4. THE WAIT ---");
  console.log("   The Chainlink DON is now executing your off-chain script.");
  console.log("   This will take 2-5 minutes. Please be patient.");
  console.log("   Waiting for the callback...");

  let newPrice = 0n;
  const timeout = 5 * 60 * 1000; // 5 minute timeout
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    await delay(20000); // Wait 20 seconds
    console.log("   ...checking price...");
    
    newPrice = await oracle.getPrice(TOKEN_ID_TO_TEST);
    
    if (newPrice.toString() !== "0") {
      console.log(`\n   >>> PRICE RECEIVED! <<<`);
      break; // Exit the loop!
    }
  }

  // --- 5. THE "FINAL VERIFICATION" ---
  console.log("\n--- 5. FINAL VERIFICATION ---");

  if (newPrice.toString() === "0") {
    throw new Error(`❌ FAILED: Timeout. Price was not updated after 5 minutes.`);
  }

  console.log(`   ✅ PASSED: New price for Token ${TOKEN_ID_TO_TEST} is $${newPrice.toString()}`);
  console.log("\n" + "=".repeat(70));
  console.log("🎉 PHASE 2 FULLY TESTED AND FUNCTIONAL! 🚀");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ TEST FAILED:");
    console.error(error);
    process.exit(1);
  });