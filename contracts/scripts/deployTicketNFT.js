// ES6 Module deployment script for TicketNFT
import hre from "hardhat";

async function main() {
  console.log("\n🚀 Starting TicketNFT deployment to Sepolia...\n");

  // Get the deployer's account
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying from address:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "ETH");
  
  if (balance === 0n) {
    console.error("\n❌ Error: Deployer account has no ETH!");
    console.log("Please fund your account:", deployer.address);
    process.exit(1);
  }

  // Get the contract factory
  console.log("\n📦 Getting TicketNFT contract factory...");
  const TicketNFT = await hre.ethers.getContractFactory("TicketNFT");
  
  // Deploy the contract
  console.log("⏳ Deploying contract...");
  const ticketNFT = await TicketNFT.deploy();
  
  // Wait for deployment to finish
  await ticketNFT.waitForDeployment();
  
  // Get the deployed contract address
  const contractAddress = await ticketNFT.getAddress();
  
  console.log("\n✅ TicketNFT deployed successfully!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // Wait for block confirmations
  console.log("\n⏳ Waiting for 5 block confirmations...");
  const receipt = await ticketNFT.deploymentTransaction().wait(5);
  console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
  
  // Verify contract details
  console.log("\n📋 Contract Details:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const minterAddress = await ticketNFT.getMinter();
  const name = await ticketNFT.name();
  const symbol = await ticketNFT.symbol();
  
  console.log("   Contract Address:", contractAddress);
  console.log("   Name:", name);
  console.log("   Symbol:", symbol);
  console.log("   Minter:", minterAddress);
  console.log("   Network:", hre.network.name);
  console.log("   Chain ID:", (await hre.ethers.provider.getNetwork()).chainId);
  
  // Calculate deployment cost
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.gasPrice || 0n;
  const deploymentCost = gasUsed * gasPrice;
  
  console.log("\n💸 Deployment Costs:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("   Gas Used:", gasUsed.toString());
  console.log("   Gas Price:", hre.ethers.formatUnits(gasPrice, "gwei"), "gwei");
  console.log("   Total Cost:", hre.ethers.formatEther(deploymentCost), "ETH");
  
  console.log("\n🔗 View on Etherscan:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`   https://sepolia.etherscan.io/address/${contractAddress}`);
  console.log(`   https://sepolia.etherscan.io/tx/${receipt.hash}`);
  
  console.log("\n📝 Save this information for your .env file:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`TICKET_NFT_ADDRESS=${contractAddress}`);
  console.log(`MINTER_ADDRESS=${minterAddress}`);
  
  console.log("\n🎉 Deployment Complete!\n");
  
  return {
    contractAddress,
    minterAddress,
    deploymentCost: hre.ethers.formatEther(deploymentCost)
  };
}

// Execute the deployment
main()
  .then((result) => {
    console.log("✅ Deployment successful!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });