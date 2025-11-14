import hre from "hardhat";
import fs from "fs/promises";
import path from "path";

// --- CONFIGURATION ---
// This is your billing account from functions.chain.link
const SUBSCRIPTION_ID = 5891; 

// This is the path to your "messenger" script, relative to the *root*
const JS_SCRIPT_PATH = "../mock-api/chainlink-script.js";
// ---------------------

async function main() {
  console.log("🚀 Starting Oracle v2.0 Configuration...");

  // 1. Get the Admin Signer
  const [admin] = await hre.ethers.getSigners();
  console.log(`   Signer (Admin): ${admin.address}`);

  // 2. Get the deployed Oracle address
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  if (!oracleAddress) {
    throw new Error("❌ PRICING_ORACLE_ADDRESS is not set in .env file. Did you deploy it?");
  }
  console.log(`   Configuring Oracle at: ${oracleAddress}`);

  // 3. Connect to the Oracle contract
  const oracle = await hre.ethers.getContractAt("PricingOracle", oracleAddress, admin);
  console.log("   ✅ Connected to PricingOracle.");

  // --- 4. Read the JavaScript file from disk ---
  console.log(`   Reading JS script from: ${JS_SCRIPT_PATH}...`);
  let jsSourceCode;
  try {
    // We resolve the path from the *root* of the monorepo
    const scriptPath = path.resolve(process.cwd(), JS_SCRIPT_PATH);
    jsSourceCode = await fs.readFile(scriptPath, "utf8");
  } catch (err) {
    console.error(err);
    throw new Error(`❌ FAILED: Could not read script at ${JS_SCRIPT_PATH}`);
  }
  console.log("   ✅ JS script read successfully.");

  // --- 5. Send the configuration transactions ---
  
  // A. Set the Subscription ID
  console.log(`   Setting Subscription ID to ${SUBSCRIPTION_ID}...`);
  const txSub = await oracle.setSubscriptionId(SUBSCRIPTION_ID);
  await txSub.wait(1);
  console.log("   ✅ Subscription ID set.");

  // B. Set the JavaScript Source Code
  console.log(`   Setting Functions Script (uploading ${jsSourceCode.length} bytes)...`);
  const txScript = await oracle.setFunctionsScript(jsSourceCode);
  await txScript.wait(1);
  console.log("   ✅ Functions Script set.");

  console.log("\n" + "=".repeat(70));
  console.log("🎉 Oracle Configuration Complete!");
  console.log("=".repeat(70));
  console.log("\n   Next Steps:");
  console.log(`   1. Go to: https://functions.chain.link/sepolia/subscription/${SUBSCRIPTION_ID}`);
  console.log(`   2. Click "Add Consumer"`);
  console.log(`   3. Add this address: ${oracleAddress}`);
  console.log("\n   After that, your oracle will be 100% ready.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Configuration failed:");
    console.error(error);
    process.exit(1);
  });