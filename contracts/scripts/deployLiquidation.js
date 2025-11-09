import hre from "hardhat";

async function main() {
  console.log("🚀 Starting LiquidationEngine deployment...");

  // --- 1. GET DEPENDENCIES ---
  
  // Get the address of our deployed LendingPool from the .env file
  const lendingPoolAddress = process.env.LENDING_POOL_ADDRESS;
  
  // This is the official Sepolia USDC contract address
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");

  // --- 2. VALIDATION ---
  if (!lendingPoolAddress) {
    throw new Error("LENDING_POOL_ADDRESS is not set in your .env file");
  }

  console.log(`   Using LendingPool at: ${lendingPoolAddress}`);
  console.log(`   Using Sepolia USDC at: ${usdcAddress}`);

  // --- 3. DEPLOYMENT ---
  console.log("   Got contract factory (blueprint)...");
  const EngineFactory = await hre.ethers.getContractFactory("LiquidationEngine");

  console.log("   Deploying LiquidationEngine with constructor arguments...");
  const engine = await EngineFactory.deploy(
    lendingPoolAddress,
    usdcAddress
  );

  await engine.waitForDeployment();
  const address = await engine.getAddress();
  
  console.log(`\n✅ LiquidationEngine deployed successfully to: ${address}`);
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  
  console.log("\n📝 Save this address in your contracts/.env file:");
  console.log(`LIQUIDATION_ENGINE_ADDRESS=${address}`);
  
  console.log("\n✅ Script finished.");
}

// The standard "runner" to execute main() and catch errors
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });