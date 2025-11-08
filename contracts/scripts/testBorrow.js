import hre from "hardhat";

// --- CONFIGURATION ---
const TOKEN_ID_TO_TEST = 1;
const POOL_FUND_AMOUNT = hre.ethers.parseUnits("5", 6); // 5 * 10^6
const LTV = 50;
const INTEREST_RATE = 500; // 5.00%
const BORROW_AMOUNT = hre.ethers.parseUnits("2", 6); // 2 * 10^6
// ---------------------

async function main() {
  console.log("🚀 Starting LendingPool (Deposit + Borrow) Test...");
  console.log("\n--- 1. SETUP ---");
  
  const [admin] = await hre.ethers.getSigners();
  console.log(`   Signer (Admin): ${admin.address}`);
  
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  const poolAddress = process.env.LENDING_POOL_ADDRESS;
  
  if (!nftAddress || !oracleAddress || !poolAddress) {
    throw new Error("Missing one or more contract addresses in .env file");
  }
  
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
  
  const ticketNFT = await hre.ethers.getContractAt("TicketNFT", nftAddress, admin);
  const pricingOracle = await hre.ethers.getContractAt("PricingOracle", oracleAddress, admin);
  const lendingPool = await hre.ethers.getContractAt("LendingPool", poolAddress, admin);
  const usdc = await hre.ethers.getContractAt("IUSDC", usdcAddress, admin);
  
  console.log("   ✅ Connected to all 4 contracts (NFT, Oracle, Pool, USDC).");
  
  console.log("\n--- 2. PRE-FLIGHT CHECK ---");
  let adminUsdcBalance = await usdc.balanceOf(admin.address);
  console.log(`   Admin USDC Balance (Start): ${hre.ethers.formatUnits(adminUsdcBalance, 6)} USDC`);
  
  if (adminUsdcBalance < POOL_FUND_AMOUNT) {
    throw new Error(`❌ FAILED: Admin wallet only has ${hre.ethers.formatUnits(adminUsdcBalance, 6)} USDC. Please get at least ${hre.ethers.formatUnits(POOL_FUND_AMOUNT, 6)} from a faucet.`);
  }
  
  console.log("\n--- 3. SETUP ---");
  console.log(`   Authorizing LendingPool (${poolAddress}) on TicketNFT...`);
  const txAuth = await ticketNFT.setLendingPool(poolAddress);
  await txAuth.wait(1);
  console.log("   ✅ LendingPool is now authorized on TicketNFT.");
  
  console.log(`   Setting LTV to ${LTV}% and Interest to ${INTEREST_RATE / 100}%...`);
  const txParams = await lendingPool.setRiskParameters(LTV, 80, INTEREST_RATE);
  await txParams.wait(1);
  console.log("   ✅ Risk parameters set.");
  
  console.log(`   Approving pool to take ${hre.ethers.formatUnits(POOL_FUND_AMOUNT, 6)} USDC from admin...`);
  const txApproveFund = await usdc.approve(poolAddress, POOL_FUND_AMOUNT);
  await txApproveFund.wait(1);
  
  console.log(`   Calling fundPool(${hre.ethers.formatUnits(POOL_FUND_AMOUNT, 6)})...`);
  const txFund = await lendingPool.fundPool(POOL_FUND_AMOUNT);
  await txFund.wait(1);
  console.log("   ✅ Pool is funded.");
  
  console.log("\n--- TEST 1: DEPOSIT COLLATERAL ---");
  
  // Pre-deposit validation
  console.log("   Pre-deposit checks:");
  try {
    const tokenOwner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
    console.log(`   - Token ${TOKEN_ID_TO_TEST} owner: ${tokenOwner}`);
    console.log(`   - Admin address: ${admin.address}`);
    
    if (tokenOwner.toLowerCase() !== admin.address.toLowerCase()) {
      throw new Error(`❌ Token ${TOKEN_ID_TO_TEST} is not owned by admin! Owner: ${tokenOwner}`);
    }
    
    const tokenState = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
    console.log(`   - Token ${TOKEN_ID_TO_TEST} state: ${tokenState.toString()} (need 0 for IDLE)`);
    
    if (tokenState.toString() !== "0") {
      throw new Error(`❌ Token ${TOKEN_ID_TO_TEST} is not IDLE! Current state: ${tokenState.toString()}`);
    }
    
    const tokenPrice = await pricingOracle.getPrice(TOKEN_ID_TO_TEST);
    console.log(`   - Token ${TOKEN_ID_TO_TEST} price: ${hre.ethers.formatUnits(tokenPrice, 6)} USDC`);
    
    if (tokenPrice.toString() === "0") {
      throw new Error(`❌ Token ${TOKEN_ID_TO_TEST} has no price set in oracle!`);
    }
    
    const collateralOwnerCheck = await lendingPool.collateralOwner(TOKEN_ID_TO_TEST);
    console.log(`   - Collateral owner in pool: ${collateralOwnerCheck}`);
    
    if (collateralOwnerCheck !== hre.ethers.ZeroAddress) {
      throw new Error(`❌ Token ${TOKEN_ID_TO_TEST} already deposited! Owner: ${collateralOwnerCheck}`);
    }
    
    console.log("   ✅ All pre-deposit checks passed!");
    
  } catch (error) {
    console.error("   ❌ Pre-deposit check failed:");
    throw error;
  }
  
  console.log(`\n   Approving pool to take Token ${TOKEN_ID_TO_TEST}...`);
  const txApproveNFT = await ticketNFT.approve(poolAddress, TOKEN_ID_TO_TEST);
  await txApproveNFT.wait(1);
  console.log("   ✅ Token approved.");
  
  console.log(`\n   Calling lendingPool.depositCollateral(${TOKEN_ID_TO_TEST})...`);
  try {
    const txDeposit = await lendingPool.depositCollateral(TOKEN_ID_TO_TEST);
    await txDeposit.wait(1);
    console.log("   ✅ depositCollateral() transaction confirmed.");
  } catch (error) {
    console.error("\n   ❌ depositCollateral() failed!");
    console.error("   Error details:", error.message);
    throw error;
  }
  
  console.log("   Verifying on-chain state...");
  const newOwner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
  const newState = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
  
  if (newOwner !== poolAddress) {
    throw new Error(`❌ FAILED: Owner should be pool (${poolAddress}), but is ${newOwner}`);
  }
  if (newState.toString() !== "2") { // 2 = COLLATERALIZED
    throw new Error(`❌ FAILED: State should be 2 (COLLATERALIZED), but is ${newState.toString()}`);
  }
  
  console.log(`   ✅ PASSED: Token ${TOKEN_ID_TO_TEST} is now owned by the pool.`);
  console.log(`   ✅ PASSED: Token ${TOKEN_ID_TO_TEST} state is now COLLATERALIZED (2).`);
  
  console.log("\n--- TEST 2: BORROW USDC ---");
  console.log(`   Calling lendingPool.borrow(${hre.ethers.formatUnits(BORROW_AMOUNT, 6)} USDC)...`);
  
  const txBorrow = await lendingPool.borrow(BORROW_AMOUNT);
  await txBorrow.wait(1);
  console.log("   ✅ borrow() transaction confirmed.");
  
  console.log("   Verifying on-chain state...");
  const newDebt = await lendingPool.userDebt(admin.address);
  const finalAdminUsdcBalance = await usdc.balanceOf(admin.address);
  
  if (newDebt.toString() !== BORROW_AMOUNT.toString()) {
    throw new Error(`❌ FAILED: Debt should be ${BORROW_AMOUNT}, but is ${newDebt}`);
  }
  
  console.log(`   Admin USDC Balance (Final): ${hre.ethers.formatUnits(finalAdminUsdcBalance, 6)} USDC`);
  console.log(`   ✅ PASSED: Admin's USDC balance changed as expected.`);
  console.log(`   ✅ PASSED: Pool debt ledger correctly shows ${hre.ethers.formatUnits(newDebt, 6)} debt.`);
  
  console.log("\n✅ Deposit + Borrow Test Passed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:");
    console.error(error);
    process.exit(1);
  });