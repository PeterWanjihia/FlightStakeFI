import hre from "hardhat";

async function main() {
  console.log("🚀 Starting LendingPool Admin Test...");

  // 1. Get our "Actors"
  const [admin] = await hre.ethers.getSigners();
  const bobWallet = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);
  console.log(`   Admin (Deployer): ${admin.address}`);
  console.log(`   Random User (Bob): ${bobWallet.address}`);

  // 2. Get the "Stage" (our deployed LendingPool)
  // This reads the address you just saved to your .env file
  const poolAddress = process.env.LENDING_POOL_ADDRESS;
  if (!poolAddress) {
    throw new Error("LENDING_POOL_ADDRESS is not set in your .env file");
  }
  console.log(`   Testing LendingPool at: ${poolAddress}`);

  // 3. Connect to the deployed contract
  const pool = await hre.ethers.getContractAt(
    "LendingPool",
    poolAddress,
    admin
  );
  console.log("   ✅ Successfully connected to LendingPool.");

  // --- TEST 1: SET RISK PARAMETERS (HAPPY PATH) ---
  console.log("\n--- TEST 1: ADMIN CAN SET RISK PARAMETERS ---");
  const ltv = 50; // 50%
  const threshold = 80; // 80%
  const rate = 5; // 5%
  
  console.log(`   Calling setRiskParameters(50, 80, 5) as admin...`);
  const tx = await pool.setRiskParameters(ltv, threshold, rate);
  await tx.wait(1);
  console.log("   ✅ Transaction confirmed.");

  // Verify the values were set
  const newLtv = await pool.loanToValue();
  if (newLtv.toString() === ltv.toString()) {
    console.log("   ✅ PASSED: loanToValue is 50.");
  } else {
    throw new Error("❌ FAILED: loanToValue was not set.");
  }

  // --- TEST 2: SET RISK PARAMETERS (SAD PATH) ---
  console.log("\n--- TEST 2: RANDOM USER IS BLOCKED ---");
  console.log(`   Attempting to call setRiskParameters as "Bob" (expecting failure)...`);

  try {
    // We connect 'bobWallet' to the contract and try to call the admin function
    await pool.connect(bobWallet).setRiskParameters(99, 99, 99);
    
    // If the line above *doesn't* fail, our security is broken.
    throw new Error("❌ FAILED: Random user was able to set parameters!");

  } catch (error) {
    // This is what we *want* to happen.
    // We check if the error message is the one we wrote in our 'require' statement.
    if (error.message.includes("LendingPool: Not admin")) {
      console.log("   ✅ PASSED: Transaction reverted with 'LendingPool: Not admin'.");
    } else {
      // It failed for some other, unexpected reason
      throw error;
    }
  }

  console.log("\n--- NOTE: Skipping 'fundPool' test ---");
  console.log("   (Cannot test 'fundPool' without Sepolia USDC in admin wallet)");

  console.log("\n✅ Admin function tests passed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:");
    console.error(error);
    process.exit(1);
  });