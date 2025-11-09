import hre from "hardhat";

async function main() {
  const [admin] = await hre.ethers.getSigners();
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const poolAddress = process.env.LENDING_POOL_ADDRESS;
  
  console.log(`Authorizing LendingPool ${poolAddress} on TicketNFT...`);
  
  const ticketNFT = await hre.ethers.getContractAt("TicketNFT", nftAddress, admin);
  const tx = await ticketNFT.setLendingPool(poolAddress);
  await tx.wait(1);
  
  console.log("✅ LendingPool authorized!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });