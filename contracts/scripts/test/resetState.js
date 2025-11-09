import hre from "hardhat";

async function main() {
  console.log("🚀 Running script to reset token state...");

  const [admin] = await hre.ethers.getSigners();
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const tokenId = 1;
  const newState = 0; // 0 = IDLE

  if (!nftAddress) {
    throw new Error("Missing TICKET_NFT_ADDRESS in .env file");
  }

  const ticketNFT = await hre.ethers.getContractAt(
    "TicketNFT",
    nftAddress,
    admin
  );

  console.log(`    Connecting to TicketNFT at ${nftAddress}...`);
  console.log(`    Attempting to set Token ${tokenId} state to ${newState} (IDLE)...`);

  const tx = await ticketNFT.changeState_TEMPORARY(tokenId, newState);
  await tx.wait(1);

  console.log("    ✅ Transaction confirmed.");

  // Verify the change
  const currentState = await ticketNFT.getTokenState(tokenId);
  if (currentState.toString() === newState.toString()) {
    console.log(`    ✅ SUCCESS: Token ${tokenId} state is now IDLE (0).`);
  } else {
    throw new Error(
      `❌ FAILED: Tried to set state to 0, but it is now ${currentState.toString()}`
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed:");
    console.error(error);
    process.exit(1);
  });