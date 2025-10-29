import hre from "hardhat";

// ─────────────────────────────────────────────────────────────
// Main function that holds all logic
// ─────────────────────────────────────────────────────────────
async function main() {
  console.log("🚀 Script started...");

  // 1️⃣ Get the Signer (your minter wallet)
  // 'hre.ethers.getSigners()' reads your .env and gets the wallet
  // from your SEPOLIA_PRIVATE_KEY
  const [minter] = await hre.ethers.getSigners();
  console.log(`👤 Using Minter account: ${minter.address}`);

  // 2️⃣ Get the Contract Address (from .env file)
  const contractAddress = process.env.TICKET_NFT_ADDRESS;
  if (!contractAddress) {
    throw new Error("TICKET_NFT_ADDRESS is not set in your .env file");
  }
  console.log(`📍 Found contract at: ${contractAddress}`);

  // 3️⃣ Define the data for our new NFT
  const tokenId = 1; // First token
  const tokenURI = `https://api.flightstake.fi/meta/${tokenId}.json`;

  const flightDetails = {
    routeHash: hre.ethers.encodeBytes32String("JFK-LAX"),
    departureTimestamp: 1735689600, // Jan 1, 2025
    fareTierIdentifier: hre.ethers.encodeBytes32String("economy"),
  };

  // Using 'hre.ethers.encodeBytes32String' because Solidity's 'bytes32'
  // type isn't a simple string. This helper formats it correctly.

  // 4️⃣ Connect to deployed contract
  const ticketNFT = await hre.ethers.getContractAt(
    "TicketNFT",      // Contract name
    contractAddress,  // Deployed address
    minter            // Wallet that will call functions
  );
  console.log("✅ Successfully connected to contract.");

  // 5️⃣ Call the 'mint' function
  console.log(`⏳ Calling mint() for Token ID ${tokenId}...`);
  const tx = await ticketNFT.mint(
    minter.address, // 'to' — mint to ourselves
    tokenId,
    flightDetails,
    tokenURI
  );

  // 6️⃣ Wait for the transaction to be mined
  console.log(`...Transaction sent. Hash: ${tx.hash}`);
  console.log("...Waiting for 1 block confirmation...");
  const receipt = await tx.wait(1);

  console.log("\n✅ Transaction Mined!");
  console.log("   Block Number:", receipt.blockNumber);

  // 7️⃣ Verify the data on-chain
  console.log("\n🕵️ Verifying data on-chain...");
  const owner = await ticketNFT.ownerOf(tokenId);
  const state = await ticketNFT.getTokenState(tokenId);

  console.log(`   Owner of Token 1: ${owner}`);
  console.log(`   State of Token 1: ${state.toString()} (0 = IDLE)`);

  if (owner === minter.address && state.toString() === "0") {
    console.log("✅ Verification successful! Minting worked.");
  } else {
    throw new Error("Verification failed. Data does not match.");
  }

  console.log("✅ Script finished!");
}

// ─────────────────────────────────────────────────────────────
// Standard way to run 'main' safely
// ─────────────────────────────────────────────────────────────
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ An error occurred:");
    console.error(error);
    process.exit(1);
  });
