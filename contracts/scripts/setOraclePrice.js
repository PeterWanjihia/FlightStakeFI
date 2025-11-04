import hre from "hardhat";

async function main() {
  console.log("🚀 Starting Oracle interaction script...");

  // --- CHANGE 1: We only expect ONE signer from our config ---
  const [admin] = await hre.ethers.getSigners();
  console.log(`   Admin (deployer): ${admin.address}`);

  // --- CHANGE 2: We create a NEW, random wallet for "Bob" ---
  // This creates a brand new, random wallet in memory and
  // connects it to the Sepolia network via our provider.
  const bobWallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log(`   Random User (Bob): ${bobWallet.address}`);
  // -----------------------------------------------------------

  // Get the "stage" address from our .env file
  const contractAddress = process.env.PRICING_ORACLE_ADDRESS;
  if (!contractAddress) {
    throw new Error("PRICING_ORACLE_ADDRESS is not set in your .env file");
  }
  console.log(`   Contract Address: ${contractAddress}`);

  // Connect to the deployed contract
  const oracle = await hre.ethers.getContractAt(
    "PricingOracle",
    contractAddress,
    admin
  );
  console.log("   Successfully connected to PricingOracle.");

  // --- Test 1: Admin Test (Happy Path) ---
  console.log("\n--- TEST 1: ADMIN CAN SET PRICE ---");
  const tokenId = 1;
  const newPrice = 350;

  console.log(`   Calling setPrice(${tokenId}, ${newPrice}) as admin...`);
  const tx = await oracle.setPrice(tokenId, newPrice);
  await tx.wait(1);
  console.log("   ✅ setPrice transaction confirmed.");

  // --- Test 2: Read Test (Verification) ---
  console.log("\n--- TEST 2: CAN READ THE NEW PRICE ---");
  const priceFromContract = await oracle.getPrice(tokenId);
  console.log(`   Calling getPrice(${tokenId})...`);
  console.log(`   ...Price returned: ${priceFromContract.toString()}`);
  
  if (priceFromContract.toString() === newPrice.toString()) {
    console.log("   ✅ Read Test PASSED. Price matches.");
  } else {
    throw new Error("❌ Read Test FAILED! Price does not match.");
  }

  // --- Test 3: Security Test (Sad Path) ---
  console.log("\n--- TEST 3: RANDOM USER IS BLOCKED ---");
  console.log(`   Attempting to call setPrice as "Bob" (expecting failure)...`);

  try {
    // --- CHANGE 3: We use our new 'bobWallet' ---
    const evilTx = await oracle.connect(bobWallet).setPrice(tokenId, 999);
    // ---------------------------------------------
    await evilTx.wait(1);

    // If we get here, the transaction *succeeded*, which is a failure!
    throw new Error("❌ Security Test FAILED! Random user was able to set price.");

  } catch (error) {
    // This is the "happy path" for this test. We *expect* an error.
    if (error.message.includes("PricingOracle: Caller is not the admin")) {
      console.log("   ✅ Security Test PASSED. Transaction reverted with correct error.");
    } else {
      // It failed for some other reason
      console.log("   Security Test FAILED for an unexpected reason:");
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