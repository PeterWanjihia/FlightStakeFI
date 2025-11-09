import hre from "hardhat";

async function main() {
  console.log("🚀 Starting PricingOracle deployment...");

  // --- ADD THESE LINES ---
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");
  // --- END OF ADDED LINES ---

  // 1. Get the "blueprint" for the contract.
  const OracleFactory = await hre.ethers.getContractFactory("PricingOracle");
  console.log("   Got contract factory (blueprint)...");

  // 2. Send the transaction to the network
  const oracle = await OracleFactory.deploy();
  console.log("   Deploy transaction sent, waiting for confirmation...");

  // 3. Wait for the deployment to be mined
  await oracle.waitForDeployment();

  // 4. Get the new contract's public address
  const address = await oracle.getAddress();
  
  console.log(`\n✅ PricingOracle deployed successfully to: ${address}`);
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  
  console.log("\n📝 Save this address in your contracts/.env file:");
  console.log(`PRICING_ORACLE_ADDRESS=${address}`);

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