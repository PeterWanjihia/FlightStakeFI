import hre from "hardhat";

// --- CONFIGURATION ---
// These are the values from your Chainlink dashboard
const ROUTER_ADDRESS = "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0"; // ✅ Fixed checksum
const DON_ID = "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000";
// ---------------------

async function main() {
  console.log("🚀 Starting PricingOracle v2.0 (Chainlink) deployment...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log(`👤 Deployer (Admin): ${deployer.address}`); // ✅ Fixed syntax

  // 1. Get the "blueprint" for the contract.
  // (We'll use the *same* 'PricingOracle.sol' file, just with new code)
  const OracleFactory = await hre.ethers.getContractFactory("PricingOracle");
  console.log("   Got contract factory (blueprint)...");

  // 2. Send the deploy transaction *with constructor arguments*
  console.log("   Deploying PricingOracle with Chainlink arguments...");
  const oracle = await OracleFactory.deploy(
    ROUTER_ADDRESS,
    DON_ID
  );
  
  await oracle.waitForDeployment();
  const address = await oracle.getAddress();
  
  console.log(`\n✅ PricingOracle v2.0 deployed to: ${address}`); // ✅ Fixed syntax
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${address}`); // ✅ Fixed syntax
  
  console.log("\n📝 Save this new address in your contracts/.env file:");
  console.log(`PRICING_ORACLE_ADDRESS=${address}`); // ✅ Fixed syntax
  
  console.log("\n✅ Script finished.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });