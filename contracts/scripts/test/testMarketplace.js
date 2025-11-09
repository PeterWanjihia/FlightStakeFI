import hre from "hardhat";

// --- CONFIGURATION ---
// !! MAKE SURE YOU HAVE MINTED & PRICED THIS TOKEN ID !!
const TOKEN_ID_TO_TEST = 5; // Or 2, or 3, or 4 - whichever one 'admin' owns and has a price for
const LISTING_PRICE = hre.ethers.parseUnits("35", 6); // 35 USDC
const FUND_BUYER_USDC = hre.ethers.parseUnits("50", 6); // 50 USDC
const FUND_BUYER_ETH = hre.ethers.parseEther("0.01"); // 0.01 ETH for gas
// ---------------------

async function main() {
  console.log("🚀 Starting Marketplace 3-Act Integration Test...");
  console.log("=".repeat(70));

  // --- ACT 1: SETUP ---
  console.log("\n📋 ACT 1: SETUP (Actors, Stage, & Funding)");
  console.log("-".repeat(70));

  // 1. Get our "Actors" (from hardhat.config.js)
  const [admin, bob] = await hre.ethers.getSigners();
  if (!bob) {
    throw new Error("❌ FAILED: 'SEPOLIA_PRIVATE_KEY1' is missing. Test requires two signers.");
  }
  console.log(`   Seller (Admin): ${admin.address}`);
  console.log(`   Buyer (Bob):    ${bob.address}`);

  // 2. Get our "Props" (Contracts)
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const marketplaceAddress = process.env.MARKETPLACE_ADDRESS;
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");

  if (!nftAddress || !marketplaceAddress) {
    throw new Error("❌ FAILED: Missing TICKET_NFT_ADDRESS or MARKETPLACE_ADDRESS in .env");
  }

  // 3. Connect to Contracts
  const ticketNFT = await hre.ethers.getContractAt("TicketNFT", nftAddress, admin);
  const marketplace = await hre.ethers.getContractAt("Marketplace", marketplaceAddress, admin);
  // We use the fully-qualified name to avoid the "multiple artifacts" error
  const usdc = await hre.ethers.getContractAt("contracts/MarketPlace.sol:IUSDC", usdcAddress, admin);
  console.log("   ✅ Connected to all 3 contracts.");

  // 4. Authorize Marketplace (Admin's "Homework")
  console.log(`   Authorizing Marketplace (${marketplaceAddress}) on TicketNFT...`);
  const txAuth = await ticketNFT.setMarketplace(marketplaceAddress);
  await txAuth.wait(1);
  console.log("   ✅ Marketplace is now authorized on TicketNFT.");

  // 5. Fund the Buyer (Bob) with USDC
  console.log(`   Funding Buyer (Bob) with ${hre.ethers.formatUnits(FUND_BUYER_USDC, 6)} USDC...`);
  const txFund = await usdc.transfer(bob.address, FUND_BUYER_USDC);
  await txFund.wait(1);
  console.log("   ✅ Buyer (Bob) is funded with USDC.");

  // 6. Fund the Buyer (Bob) with ETH for Gas
  console.log(`   Funding Buyer (Bob) with ${hre.ethers.formatEther(FUND_BUYER_ETH)} ETH for gas...`);
  const txFundETH = await admin.sendTransaction({
      to: bob.address,
      value: FUND_BUYER_ETH
  });
  await txFundETH.wait(1);
  console.log("   ✅ Buyer (Bob) is funded with ETH.");

  // --- ACT 2: THE LISTING (Seller's Journey) ---
  console.log("\n" + "=".repeat(70));
  console.log("🎭 ACT 2: THE LISTING (Seller: Admin)");
  console.log("-".repeat(70));

  // 1. Prerequisite: Approve the Marketplace
  console.log(`   Approving Marketplace to take Token ${TOKEN_ID_TO_TEST}...`);
  const txApprove = await ticketNFT.approve(marketplaceAddress, TOKEN_ID_TO_TEST);
  await txApprove.wait(1);
  console.log(`   ✅ Token ${TOKEN_ID_TO_TEST} approved.`);

  // 2. Action: List the Item
  console.log(`   Listing Token ${TOKEN_ID_TO_TEST} for ${hre.ethers.formatUnits(LISTING_PRICE, 6)} USDC...`);
  const txList = await marketplace.listItem(TOKEN_ID_TO_TEST, LISTING_PRICE);
  await txList.wait(1);
  console.log("   ✅ Item listed.");

  // 3. Verification
  console.log("   Verifying on-chain state...");
  const newState = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
  if (newState.toString() !== "3") { // 3 = LISTED
    throw new Error(`❌ FAILED: State should be 3 (LISTED), but is ${newState}`);
  }
  console.log(`   ✅ PASSED: Token ${TOKEN_ID_TO_TEST} state is now LISTED (3).`);
  console.log("   ✅ ACT 2 SUCCESSFUL");

  // --- ACT 3: THE SALE (Buyer's Journey) ---
  console.log("\n" + "=".repeat(70));
  console.log("🎭 ACT 3: THE SALE (Buyer: Bob)");
  console.log("-".repeat(70));

  // 1. Prerequisite: Buyer approves USDC
  console.log(`   Buyer (Bob) is approving Marketplace to spend ${hre.ethers.formatUnits(LISTING_PRICE, 6)} USDC...`);
  // We must connect 'bob' to the USDC contract to make *him* send the 'approve'
  const txApproveUSDC = await usdc.connect(bob).approve(marketplaceAddress, LISTING_PRICE);
  await txApproveUSDC.wait(1);
  console.log("   ✅ Buyer's USDC is approved.");

  // 2. Action: Buy the Item
  console.log(`   Buyer (Bob) is calling buyItem(${TOKEN_ID_TO_TEST})...`);
  // We connect 'bob' to the Marketplace contract to make *him* call 'buyItem'
  const txBuy = await marketplace.connect(bob).buyItem(TOKEN_ID_TO_TEST);
  await txBuy.wait(1);
  console.log("   ✅ Sale confirmed!");

  // 3. Verification (The Final Checks)
  console.log("   Verifying final state...");
  const finalOwner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
  const finalState = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
  const sellerBalance = await usdc.balanceOf(admin.address); // We'll just check this

  if (finalOwner.toLowerCase() !== bob.address.toLowerCase()) {
    throw new Error(`❌ FAILED: Buyer (Bob) should be the new owner, but owner is ${finalOwner}`);
  }
  if (finalState.toString() !== "0") { // 0 = IDLE
    throw new Error(`❌ FAILED: State should be 0 (IDLE), but is ${finalState}`);
  }
  
  console.log(`   ✅ PASSED: Token ${TOKEN_ID_TO_TEST} is now owned by Buyer (Bob).`);
  console.log(`   ✅ PASSED: Token ${TOKEN_ID_TO_TEST} state is now IDLE (0).`);
  console.log(`   (Seller's new USDC balance: ${hre.ethers.formatUnits(sellerBalance, 6)})`);
  console.log("   ✅ ACT 3 SUCCESSFUL");

  console.log("\n" + "=".repeat(70));
  console.log("🎉 FULL MARKETPLACE TEST PASSED! 🚀");
  console.log("=".repeat(70));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ TEST SUITE FAILED:");
    console.error(error);
    process.exit(1);
  });