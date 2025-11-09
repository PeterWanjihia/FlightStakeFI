import hre from "hardhat";

async function main() {
  console.log("🚀 Starting full protocol deployment...");
  console.log("=".repeat(70));

  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer (Admin): ${deployer.address}`);

  // --- 1. DEPLOYMENT (BATCH 1: No Dependencies) ---
  console.log("\n--- BATCH 1: DEPLOYING CORE CONTRACTS ---");

  // Deploy TicketNFT
  const TicketNFTFactory = await hre.ethers.getContractFactory("TicketNFT");
  const ticketNFT = await TicketNFTFactory.deploy();
  await ticketNFT.waitForDeployment();
  const nftAddress = await ticketNFT.getAddress();
  console.log(`✅ TicketNFT deployed to: ${nftAddress}`);

  // Deploy PricingOracle
  const OracleFactory = await hre.ethers.getContractFactory("PricingOracle");
  const pricingOracle = await OracleFactory.deploy();
  await pricingOracle.waitForDeployment();
  const oracleAddress = await pricingOracle.getAddress();
  console.log(`✅ PricingOracle deployed to: ${oracleAddress}`);

  // --- 2. DEPLOYMENT (BATCH 2: Core Dependencies) ---
  console.log("\n--- BATCH 2: DEPLOYING PROTOCOL CONTRACTS ---");
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
  console.log(`   Using Sepolia USDC at: ${usdcAddress}`);

  // Deploy StakingVault
  const VaultFactory = await hre.ethers.getContractFactory("StakingVault");
  const stakingVault = await VaultFactory.deploy(nftAddress, oracleAddress);
  await stakingVault.waitForDeployment();
  const vaultAddress = await stakingVault.getAddress();
  console.log(`✅ StakingVault deployed to: ${vaultAddress}`);

  // Deploy LendingPool
  const PoolFactory = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await PoolFactory.deploy(nftAddress, oracleAddress, usdcAddress);
  await lendingPool.waitForDeployment();
  const poolAddress = await lendingPool.getAddress();
  console.log(`✅ LendingPool deployed to: ${poolAddress}`);

  // Deploy Marketplace
  const MarketFactory = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await MarketFactory.deploy(nftAddress, usdcAddress, 200); // 200 = 2% fee
  await marketplace.waitForDeployment();
  const marketAddress = await marketplace.getAddress();
  console.log(`✅ Marketplace deployed to: ${marketAddress}`);

  // --- 3. DEPLOYMENT (BATCH 3: Final Dependency) ---
  console.log("\n--- BATCH 3: DEPLOYING ENFORCER CONTRACT ---");

  // Deploy LiquidationEngine
  const EngineFactory = await hre.ethers.getContractFactory("LiquidationEngine");
  const liquidationEngine = await EngineFactory.deploy(poolAddress, usdcAddress);
  await liquidationEngine.waitForDeployment();
  const engineAddress = await liquidationEngine.getAddress();
  console.log(`✅ LiquidationEngine deployed to: ${engineAddress}`);

  // --- 4. "WIRING" (Connecting Protocol Doors) ---
  console.log("\n--- BATCH 4: WIRING CONTRACTS TOGETHER ---");

  // We need to connect to the deployed contracts *as* the admin
  const nftContract = await hre.ethers.getContractAt("TicketNFT", nftAddress, deployer);
  const poolContract = await hre.ethers.getContractAt("LendingPool", poolAddress, deployer);

  // Authorize protocols on TicketNFT
  console.log("   Authorizing StakingVault on TicketNFT...");
  await (await nftContract.setStakingVault(vaultAddress)).wait(1);
  
  console.log("   Authorizing LendingPool on TicketNFT...");
  await (await nftContract.setLendingPool(poolAddress)).wait(1);

  console.log("   Authorizing Marketplace on TicketNFT...");
  await (await nftContract.setMarketplace(marketAddress)).wait(1);

  // Authorize LiquidationEngine on LendingPool
  console.log("   Authorizing LiquidationEngine on LendingPool...");
  await (await poolContract.setLiquidationEngine(engineAddress)).wait(1);

  console.log("   ✅ All contracts are deployed and authorized!");

  // --- 5. FINAL OUTPUT ---
  console.log("\n" + "=".repeat(70));
  console.log("🎉 FULL PROTOCOL DEPLOYED! 🎉");
  console.log("=".repeat(70));
  console.log("\n📝 Save these addresses in your contracts/.env file:");
  console.log(`TICKET_NFT_ADDRESS=${nftAddress}`);
  console.log(`PRICING_ORACLE_ADDRESS=${oracleAddress}`);
  console.log(`STAKING_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`LENDING_POOL_ADDRESS=${poolAddress}`);
  console.log(`MARKETPLACE_ADDRESS=${marketAddress}`);
  console.log(`LIQUIDATION_ENGINE_ADDRESS=${engineAddress}`);
  console.log("\n======================================================================\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });