import hre from "hardhat";

async function main() {
  console.log("🚀 Starting LendingPool deployment...");

  // --- ADD THESE LINES ---
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");
  // --- END OF ADDED LINES ---

  // 1. Get addresses of dependencies from .env
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  
  // 2. THIS IS THE NEW PART: The official Sepolia USDC address
  const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";

  // 3. Guards
  if (!nftAddress || !oracleAddress) {
    throw new Error("Missing TICKET_NFT_ADDRESS or PRICING_ORACLE_ADDRESS in .env");
  }
  
  console.log(`   Using TicketNFT at: ${nftAddress}`);
  console.log(`   Using PricingOracle at: ${oracleAddress}`);
  console.log(`   Using Sepolia USDC at: ${usdcAddress}`);

  // 4. Get the "blueprint"
  const PoolFactory = await hre.ethers.getContractFactory("LendingPool");
  console.log("   Got contract factory (blueprint)...");

  // 5. Deploy with all 3 constructor arguments
  console.log("   Deploying LendingPool with constructor arguments...");
  const pool = await PoolFactory.deploy(
    nftAddress,
    oracleAddress,
    usdcAddress
  );

  await pool.waitForDeployment();
  const address = await pool.getAddress();
  
  console.log(`\n✅ LendingPool deployed successfully to: ${address}`);
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  
  console.log("\n📝 Save this address in your contracts/.env file:");
  console.log(`LENDING_POOL_ADDRESS=${address}`);
  
  console.log("\n✅ Script finished.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });