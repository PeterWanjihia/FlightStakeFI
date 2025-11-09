import hre from "hardhat";

async function main() {
  console.log("🚀 Starting Marketplace deployment...");

  // --- ADD THESE LINES ---
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");
  // --- END OF ADDED LINES ---

  // --- 1. CONFIGURATION ---
  
  // Get the address of our deployed TicketNFT from the .env file
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  
  // This is the official Sepolia USDC contract address
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"); // Using getAddress for checksum
  
  // Set the initial protocol fee (200 = 2.00%)
  const initialFee = 200; 

  // --- 2. VALIDATION ---
  if (!nftAddress) {
    throw new Error("TICKET_NFT_ADDRESS is not set in your .env file");
  }

  console.log(`   Using TicketNFT at: ${nftAddress}`);
  console.log(`   Using Sepolia USDC at: ${usdcAddress}`);
  console.log(`   Setting initial fee to: ${initialFee / 100}%`);

  // --- 3. DEPLOYMENT ---
  console.log("   Got contract factory (blueprint)...");
  const MarketplaceFactory = await hre.ethers.getContractFactory("Marketplace");

  console.log("   Deploying Marketplace with constructor arguments...");
  const marketplace = await MarketplaceFactory.deploy(
    nftAddress,
    usdcAddress,
    initialFee
  );

  await marketplace.waitForDeployment();
  const address = await marketplace.getAddress();
  
  console.log(`\n✅ Marketplace deployed successfully to: ${address}`);
  console.log(`🔗 View on Etherscan: https://sepolia.etherscan.io/address/${address}`);
  
  console.log("\n📝 Save this address in your contracts/.env file:");
  console.log(`MARKETPLACE_ADDRESS=${address}`);
  
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