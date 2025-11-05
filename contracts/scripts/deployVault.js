import hre from "hardhat";

async function main() {
  console.log("🚀 Starting StakingVault deployment...");

  // 1. Get the addresses of our dependencies from the .env file
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;

  // 2. Add "guards" to make sure the addresses are present
  if (!nftAddress) {
    throw new Error("TICKET_NFT_ADDRESS is not set in your .env file");
  }
  if (!oracleAddress) {
    throw new Error("PRICING_ORACLE_ADDRESS is not set in your .env file");
  }

  console.log(`   Using TicketNFT at: ${nftAddress}`);
  console.log(`   Using PricingOracle at: ${oracleAddress}`);

  // 3. Get the "blueprint" for the StakingVault
  const VaultFactory = await hre.ethers.getContractFactory("StakingVault");
  console.log("   Got contract factory (blueprint)...");

  // 4. Send the deploy transaction *with constructor arguments*
  console.log("   Deploying StakingVault with constructor arguments...");
  const vault = await VaultFactory.deploy(
    nftAddress,     // This is the '_ticketNFTAddress'
    oracleAddress   // This is the '_oracleAddress'
  );

  console.log("   Deploy transaction sent, waiting for confirmation...");

  // 5. Wait for the deployment to be mined
  await vault.waitForDeployment();

  // 6. Get the new contract's public address
  const address = await vault.getAddress();
  
  console.log(`\n✅ StakingVault deployed successfully to: ${address}`);
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  
  console.log("\n📝 Save this address in your contracts/.env file:");
  console.log(`STAKING_VAULT_ADDRESS=${address}`);

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