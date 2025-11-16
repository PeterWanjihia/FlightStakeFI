import hre from "hardhat";

// --- CONFIGURATION ---
// These are the values from your Chainlink dashboard & our research
// We "clean" them with getAddress() to fix the "bad checksum" error.
const ROUTER_ADDRESS = hre.ethers.getAddress("0xb83E47C2bC239B3bf370bc41e1459A34b41238D0");
const DON_ID = "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000";
const USDC_ADDRESS = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"); // Your provided address
const MARKETPLACE_FEE = 200; // 200 = 2.00%
// ---------------------

async function main() {
  console.log("🚀 Starting full protocol deployment...");
  console.log("=".repeat(70));

  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer (Admin): ${deployer.address}`);
  console.log(`   Admin Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address))} ETH`);

  // --- 1. DEPLOYMENT (BATCH 1: No Dependencies) ---
  console.log("\n--- BATCH 1: DEPLOYING CORE CONTRACTS ---");

  // Deploy TicketNFT (constructor takes 0 args)
  console.log("   Deploying TicketNFT...");
  const TicketNFTFactory = await hre.ethers.getContractFactory("TicketNFT");
  const ticketNFT = await TicketNFTFactory.deploy();
  await ticketNFT.waitForDeployment();
  const nftAddress = await ticketNFT.getAddress();
  console.log(`✅ TicketNFT deployed to: ${nftAddress}`);

  // Deploy PricingOracle (constructor takes 2 args)
  console.log("   Deploying PricingOracle...");
  const OracleFactory = await hre.ethers.getContractFactory("PricingOracle");
  const pricingOracle = await OracleFactory.deploy(ROUTER_ADDRESS, DON_ID);
  await pricingOracle.waitForDeployment();
  const oracleAddress = await pricingOracle.getAddress();
  console.log(`✅ PricingOracle deployed to: ${oracleAddress}`);

  // --- 2. DEPLOYMENT (BATCH 2: Core Dependencies) ---
  console.log("\n--- BATCH 2: DEPLOYING PROTOCOL CONTRACTS ---");
  console.log(`   Using Sepolia USDC at: ${USDC_ADDRESS}`);

  // Deploy StakingVault (constructor takes 2 args)
  console.log("   Deploying StakingVault...");
  const VaultFactory = await hre.ethers.getContractFactory("StakingVault");
  const stakingVault = await VaultFactory.deploy(nftAddress, oracleAddress);
  await stakingVault.waitForDeployment();
  const vaultAddress = await stakingVault.getAddress();
  console.log(`✅ StakingVault deployed to: ${vaultAddress}`);

  // Deploy LendingPool (constructor takes 3 args)
  console.log("   Deploying LendingPool...");
  const PoolFactory = await hre.ethers.getContractFactory("LendingPool");
  const lendingPool = await PoolFactory.deploy(nftAddress, oracleAddress, USDC_ADDRESS);
  await lendingPool.waitForDeployment();
  const poolAddress = await lendingPool.getAddress();
  console.log(`✅ LendingPool deployed to: ${poolAddress}`);

  // Deploy Marketplace (constructor takes 3 args)
  console.log("   Deploying Marketplace...");
  const MarketFactory = await hre.ethers.getContractFactory("Marketplace");
  const marketplace = await MarketFactory.deploy(nftAddress, USDC_ADDRESS, MARKETPLACE_FEE);
  await marketplace.waitForDeployment();
  const marketAddress = await marketplace.getAddress();
  console.log(`✅ Marketplace deployed to: ${marketAddress}`);

  // --- 3. DEPLOYMENT (BATCH 3: Final Dependency) ---
  console.log("\n--- BATCH 3: DEPLOYING ENFORCER CONTRACT ---");

  // Deploy LiquidationEngine (constructor takes 2 args)
  console.log("   Deploying LiquidationEngine...");
  const EngineFactory = await hre.ethers.getContractFactory("LiquidationEngine");
  const liquidationEngine = await EngineFactory.deploy(poolAddress, USDC_ADDRESS);
  await liquidationEngine.waitForDeployment();
  const engineAddress = await liquidationEngine.getAddress();
  console.log(`✅ LiquidationEngine deployed to: ${engineAddress}`);

  // --- 4. "WIRING" (Connecting Protocol Doors) ---
  console.log("\n--- BATCH 4: WIRING CONTRACTS TOGETHER ---");

  // We connect to the contracts *as the deployer* to call admin functions
  const nftContract = await hre.ethers.getContractAt("TicketNFT", nftAddress, deployer);
  const poolContract = await hre.ethers.getContractAt("LendingPool", poolAddress, deployer);

  console.log("   Authorizing StakingVault on TicketNFT...");
  await (await nftContract.setStakingVault(vaultAddress)).wait(1);
  
  console.log("   Authorizing LendingPool on TicketNFT...");
  await (await nftContract.setLendingPool(poolAddress)).wait(1);

  console.log("   Authorizing Marketplace on TicketNFT...");
  await (await nftContract.setMarketplace(marketAddress)).wait(1);

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