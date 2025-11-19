import hre from "hardhat";

// --- CONFIGURATION ---
const TOKEN_ID = 1; // We know Token 1 is minted and owned by Alice
const PRICE = hre.ethers.parseUnits("50", 6); // 50 USDC
// ---------------------

async function main() {
  console.log("🚀 Starting Marketplace Event Generation Test...");
  console.log("=".repeat(60));

  const [alice, bob] = await hre.ethers.getSigners();
  console.log(`   Seller (Alice): ${alice.address}`);
  console.log(`   Buyer (Bob):    ${bob.address}`);

  // Load Addresses
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const marketAddress = process.env.MARKETPLACE_ADDRESS;
  // Use the fully qualified name for USDC interface to avoid errors
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");

  // Connect Contracts
  const ticketNFT = await hre.ethers.getContractAt("TicketNFT", nftAddress, alice);
  const marketplace = await hre.ethers.getContractAt("Marketplace", marketAddress, alice);
  const usdc = await hre.ethers.getContractAt("contracts/Marketplace.sol:IUSDC", usdcAddress, alice);

  console.log("   ✅ Contracts connected");

  // --- STEP 1: LIST ITEM (Generates 'ItemListed') ---
  console.log("\n--- STEP 1: LISTING ---");
  
  console.log("   Alice approving Marketplace...");
  await (await ticketNFT.approve(marketAddress, TOKEN_ID)).wait(1);
  
  console.log(`   Alice listing Token ${TOKEN_ID} for 50 USDC...`);
  await (await marketplace.listItem(TOKEN_ID, PRICE)).wait(1);
  console.log("   ✅ Item Listed!");

  // --- STEP 2: BUY ITEM (Generates 'ItemSold' & 'Transfer') ---
  console.log("\n--- STEP 2: BUYING ---");
  
  // Connect as Bob
  const marketBob = marketplace.connect(bob);
  const usdcBob = usdc.connect(bob);

  console.log("   Bob approving USDC...");
  await (await usdcBob.approve(marketAddress, PRICE)).wait(1);

  console.log("   Bob buying Token...");
  await (await marketBob.buyItem(TOKEN_ID)).wait(1);
  console.log("   ✅ Item Sold!");
  
  console.log("\n🎉 Test Complete. Check your Backend Listener!");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});