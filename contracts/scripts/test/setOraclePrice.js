import hre from "hardhat";

async function main() {
  console.log("🚀 Starting Oracle interaction script...");

  // --- 1. Get BOTH funded signers from your config ---
  const [admin, bob] = await hre.ethers.getSigners();
  
  if (!bob) {
    throw new Error(
      "❌ FAILED: Missing 'bob'. Did you add SEPOLIA_PRIVATE_KEY1 to your hardhat.config.js?"
    );
  }
  
  console.log(`    Admin (deployer): ${admin.address}`);
  console.log(`    Second User (Bob): ${bob.address}`); // This is your funded 2nd account

  // ... (rest of the connection logic) ...
  const contractAddress = process.env.PRICING_ORACLE_ADDRESS;
  if (!contractAddress) {
    throw new Error("PRICING_ORACLE_ADDRESS is not set in your .env file");
  }
  const oracle = await hre.ethers.getContractAt(
    "PricingOracle",
    contractAddress,
    admin
  );
  console.log("    Successfully connected to PricingOracle.");

  // --- Test 1: Admin Test ---
  console.log("\n--- TEST 1: ADMIN CAN SET PRICE ---");
  const tokenId = 2;
  const newPrice = hre.ethers.parseUnits("350", 18);

  console.log(`    Calling setPrice(${tokenId}, ${newPrice}) as admin...`);
  const tx = await oracle.setPrice(tokenId, newPrice);
  await tx.wait(1);
  console.log("    ✅ setPrice transaction confirmed.");

  // ... (Test 2: Read price... unchanged) ...
  console.log("\n--- TEST 2: CAN READ THE NEW PRICE ---");
  const priceFromContract = await oracle.getPrice(tokenId);
  if (priceFromContract.toString() === newPrice.toString()) {
    console.log("    ✅ Read Test PASSED. Price matches.");
  } else {
    throw new Error("❌ Read Test FAILED! Price does not match.");
  }


  // --- Test 3: Security Test (This is the important part) ---
  console.log("\n--- TEST 3: 'BOB' (FUNDED USER) IS BLOCKED ---");
  console.log(`    Attempting to call setPrice as "Bob" (expecting failure)...`);

  try {
    // --- HERE IS THE CHANGE: We use the funded 'bob' signer ---
    const evilTx = await oracle.connect(bob).setPrice(tokenId, 999);
    await evilTx.wait(1);

    // If we get here, it's a failure
    throw new Error("❌ Security Test FAILED! Random user was able to set price.");

  } catch (error) {
    // We WANT the transaction to fail, but *only* with the correct error
    if (error.message.includes("PricingOracle: Caller is not the admin")) {
      console.log("    ✅ Security Test PASSED. Transaction reverted with correct error.");
    } else if (error.message.includes("insufficient funds")) {
        console.error("    ❌ TEST FAILED: 'Bob' (your SEPOLIA_PRIVATE_KEY1) has no gas. Please fund it.");
    } else {
      console.log("    Security Test FAILED for an unexpected reason:");
      throw error;
    }
  }

  console.log("\n✅ Script finished successfully.");
}

// The standard "runner"
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:");
    console.error(error);
    process.exit(1);
  });