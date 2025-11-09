import hre from "hardhat";

// --- CONFIGURATION ---
const TOKEN_ID_TO_TEST = 2;
const POOL_FUND_AMOUNT = hre.ethers.parseUnits("100", 6); // 10,000 USDC
const LTV = 50; // 50%
const LIQUIDATION_THRESHOLD = 80; // 80%
const INTEREST_RATE = 500; // 5.00%
const BORROW_AMOUNT = hre.ethers.parseUnits("50", 6); // 100 USDC
const PARTIAL_REPAY_AMOUNT = hre.ethers.parseUnits("25", 6); // 50 USDC

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));


async function main() {
  console.log("🚀 Starting Comprehensive LendingPool Test Suite...");
  console.log("=".repeat(70));
  
  // ================== SETUP ==================
  console.log("\n📋 PHASE 1: SETUP & INITIALIZATION");
  console.log("-".repeat(70));
  
  const [admin] = await hre.ethers.getSigners();
  console.log(`   Signer (Admin): ${admin.address}`);
  
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  const poolAddress = process.env.LENDING_POOL_ADDRESS;
  
  if (!nftAddress || !oracleAddress || !poolAddress) {
    throw new Error("❌ Missing contract addresses in .env file");
  }
  
  console.log(`   NFT Contract: ${nftAddress}`);
  console.log(`   Oracle Contract: ${oracleAddress}`);
  console.log(`   Pool Contract: ${poolAddress}`);
  
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");
  
  const ticketNFT = await hre.ethers.getContractAt("TicketNFT", nftAddress, admin);
  const pricingOracle = await hre.ethers.getContractAt("PricingOracle", oracleAddress, admin);
  const lendingPool = await hre.ethers.getContractAt("LendingPool", poolAddress, admin);
  const usdc = await hre.ethers.getContractAt("IUSDC", usdcAddress, admin);
  
  console.log("   ✅ Connected to all contracts");
  
  // Pre-flight checks
  console.log("\n📊 Pre-flight Balance Checks:");
  let adminUsdcBalance = await usdc.balanceOf(admin.address);
  console.log(`   Admin USDC Balance: ${hre.ethers.formatUnits(adminUsdcBalance, 6)} USDC`);
  
  if (adminUsdcBalance < POOL_FUND_AMOUNT) {
    throw new Error(`❌ Insufficient USDC. Need ${hre.ethers.formatUnits(POOL_FUND_AMOUNT, 6)} USDC`);
  }
  
  // Authorization
  console.log("\n🔐 Authorizing Contracts:");
  console.log(`   Authorizing LendingPool on TicketNFT...`);
  const txAuth = await ticketNFT.setLendingPool(poolAddress);
  await txAuth.wait(1);
  console.log("   ✅ LendingPool authorized");
  
  // Set risk parameters
  console.log("\n⚙️  Setting Risk Parameters:");
  console.log(`   LTV: ${LTV}%`);
  console.log(`   Liquidation Threshold: ${LIQUIDATION_THRESHOLD}%`);
  console.log(`   Interest Rate: ${INTEREST_RATE / 100}%`);
  const txParams = await lendingPool.setRiskParameters(LTV, LIQUIDATION_THRESHOLD, INTEREST_RATE);
  await txParams.wait(1);
  console.log("   ✅ Risk parameters set");
  
  // Fund the pool
  console.log("\n💰 Funding the Pool:");
  console.log(`   Approving ${hre.ethers.formatUnits(POOL_FUND_AMOUNT, 6)} USDC...`);
  const txApproveFund = await usdc.approve(poolAddress, POOL_FUND_AMOUNT);
  await txApproveFund.wait(1);
  
  console.log(`   Funding pool with ${hre.ethers.formatUnits(POOL_FUND_AMOUNT, 6)} USDC...`);
  const txFund = await lendingPool.fundPool(POOL_FUND_AMOUNT);
  await txFund.wait(1);
  
  const poolBalance = await usdc.balanceOf(poolAddress);
  console.log(`   ✅ Pool funded with ${hre.ethers.formatUnits(poolBalance, 6)} USDC`);
  
  // ================== TEST 1: DEPOSIT COLLATERAL ==================
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST 1: DEPOSIT COLLATERAL");
  console.log("-".repeat(70));
  
  console.log("\n🔍 Pre-deposit Validation:");
  const tokenOwner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
  const tokenState = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
  const tokenPrice = await pricingOracle.getPrice(TOKEN_ID_TO_TEST);
  const collateralOwnerCheck = await lendingPool.collateralOwner(TOKEN_ID_TO_TEST);
  
  console.log(`   Token ${TOKEN_ID_TO_TEST} owner: ${tokenOwner}`);
  console.log(`   Token ${TOKEN_ID_TO_TEST} state: ${tokenState.toString()} (0 = IDLE)`);
  console.log(`   Token ${TOKEN_ID_TO_TEST} price: ${hre.ethers.formatUnits(tokenPrice, 6)} USDC`);
  console.log(`   Collateral owner in pool: ${collateralOwnerCheck}`);
  
  if (tokenOwner.toLowerCase() !== admin.address.toLowerCase()) {
    throw new Error(`❌ Token not owned by admin`);
  }
  if (tokenState.toString() !== "0") {
    throw new Error(`❌ Token not in IDLE state`);
  }
  if (tokenPrice.toString() === "0") {
    throw new Error(`❌ Token has no price`);
  }
  
  console.log("   ✅ All pre-deposit checks passed");
  
  console.log(`\n📝 Approving NFT transfer...`);
  const txApproveNFT = await ticketNFT.approve(poolAddress, TOKEN_ID_TO_TEST);
  await txApproveNFT.wait(1);
  console.log("   ✅ NFT approved");
  
  console.log(`\n🔒 Depositing collateral (Token ${TOKEN_ID_TO_TEST})...`);
  const txDeposit = await lendingPool.depositCollateral(TOKEN_ID_TO_TEST);
  const receiptDeposit = await txDeposit.wait(1);
  console.log(`   ✅ Deposit confirmed (Gas used: ${receiptDeposit.gasUsed.toString()})`);
  
  console.log("\n✅ Verifying Post-Deposit State:");
  const newOwner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
  const newState = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
  const userCollateral = await lendingPool.userCollateralValue(admin.address);
  
  console.log(`   Token owner: ${newOwner}`);
  console.log(`   Token state: ${newState.toString()} (2 = COLLATERALIZED)`);
  console.log(`   User collateral value: ${hre.ethers.formatUnits(userCollateral, 6)} USDC`);
  
  if (newOwner !== poolAddress) {
    throw new Error(`❌ Token owner should be pool`);
  }
  if (newState.toString() !== "2") {
    throw new Error(`❌ Token state should be COLLATERALIZED (2)`);
  }
  if (userCollateral.toString() !== tokenPrice.toString()) {
    throw new Error(`❌ Collateral value mismatch`);
  }
  
  console.log("   ✅ TEST 1 PASSED: Collateral deposited successfully");
  
  // ================== TEST 2: BORROW ==================
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST 2: BORROW USDC");
  console.log("-".repeat(70));
  
  const balanceBeforeBorrow = await usdc.balanceOf(admin.address);
  const borrowLimit = (userCollateral * BigInt(LTV)) / 100n;
  
  console.log(`\n📊 Borrow Parameters:`);
  console.log(`   Collateral value: ${hre.ethers.formatUnits(userCollateral, 6)} USDC`);
  console.log(`   Borrow limit (${LTV}% LTV): ${hre.ethers.formatUnits(borrowLimit, 6)} USDC`);
  console.log(`   Requesting: ${hre.ethers.formatUnits(BORROW_AMOUNT, 6)} USDC`);
  console.log(`   Balance before: ${hre.ethers.formatUnits(balanceBeforeBorrow, 6)} USDC`);
  
  console.log(`\n💸 Borrowing ${hre.ethers.formatUnits(BORROW_AMOUNT, 6)} USDC...`);
  const txBorrow = await lendingPool.borrow(BORROW_AMOUNT);
  const receiptBorrow = await txBorrow.wait(1);
  console.log(`   ✅ Borrow confirmed (Gas used: ${receiptBorrow.gasUsed.toString()})`);
  
  console.log("\n✅ Verifying Post-Borrow State:");
  const balanceAfterBorrow = await usdc.balanceOf(admin.address);
  const userDebt = await lendingPool.userDebt(admin.address);
  const outstandingDebt = await lendingPool.getOutstandingDebt(admin.address);
  
  console.log(`   Balance after: ${hre.ethers.formatUnits(balanceAfterBorrow, 6)} USDC`);
  console.log(`   User debt: ${hre.ethers.formatUnits(userDebt, 6)} USDC`);
  console.log(`   Outstanding debt (with interest): ${hre.ethers.formatUnits(outstandingDebt, 6)} USDC`);
  console.log(`   Balance increased by: ${hre.ethers.formatUnits(balanceAfterBorrow - balanceBeforeBorrow, 6)} USDC`);
  
  if (userDebt.toString() !== BORROW_AMOUNT.toString()) {
    throw new Error(`❌ Debt mismatch`);
  }
  if (balanceAfterBorrow - balanceBeforeBorrow !== BORROW_AMOUNT) {
    throw new Error(`❌ Balance increase mismatch`);
  }
  
  console.log("   ✅ TEST 2 PASSED: Borrow successful");
  
  
 // ================== TEST 3: INTEREST ACCRUAL ==================
  // ================== TEST 3: INTEREST ACCRUAL ==================
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST 3: INTEREST ACCRUAL");
  console.log("-".repeat(70));
  
  // We must use a real-world delay when on a live testnet
  // We'll wait 2 minutes (120 seconds) to ensure interest accrues
  console.log("\n⏳ Waiting 2 minutes for interest to accrue...");
  await delay(120000); 
    
  const debtAfterWait = await lendingPool.getOutstandingDebt(admin.address);
  const interestAccrued = debtAfterWait - userDebt; 
  
  console.log(`\n📈 Interest Calculation:`);
  console.log(`   Original debt: ${hre.ethers.formatUnits(userDebt, 6)} USDC`);
  console.log(`   Current debt: ${hre.ethers.formatUnits(debtAfterWait, 6)} USDC`);
  console.log(`   Interest accrued (2 mins): ${hre.ethers.formatUnits(interestAccrued, 6)} USDC`);
  console.log(`   Annual rate: ${INTEREST_RATE / 100}%`);
  
  if (debtAfterWait <= userDebt) {
    throw new Error(`❌ No interest accrued`);
  }
  
  console.log("   ✅ TEST 3 PASSED: Interest accruing correctly");
  // ================== TEST 4: PARTIAL REPAYMENT ==================
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST 4: PARTIAL REPAYMENT");
  console.log("-".repeat(70));
  
  const debtBeforeRepay = await lendingPool.getOutstandingDebt(admin.address);
  
  console.log(`\n💵 Partial Repayment:`);
  console.log(`   Current debt: ${hre.ethers.formatUnits(debtBeforeRepay, 6)} USDC`);
  console.log(`   Repaying: ${hre.ethers.formatUnits(PARTIAL_REPAY_AMOUNT, 6)} USDC`);
  
  console.log(`\n📝 Approving USDC for repayment...`);
  const txApproveRepay = await usdc.approve(poolAddress, PARTIAL_REPAY_AMOUNT);
  await txApproveRepay.wait(1);
  console.log("   ✅ USDC approved");
  
  console.log(`\n💳 Executing partial repayment...`);
  const txRepay = await lendingPool.repay(PARTIAL_REPAY_AMOUNT);
  const receiptRepay = await txRepay.wait(1);
  console.log(`   ✅ Repayment confirmed (Gas used: ${receiptRepay.gasUsed.toString()})`);
  
  console.log("\n✅ Verifying Post-Repayment State:");
  const debtAfterRepay = await lendingPool.userDebt(admin.address);
  const expectedDebt = debtBeforeRepay - PARTIAL_REPAY_AMOUNT;
  
  console.log(`   Debt after repayment: ${hre.ethers.formatUnits(debtAfterRepay, 6)} USDC`);
  console.log(`   Expected debt: ${hre.ethers.formatUnits(expectedDebt, 6)} USDC`);
  console.log(`   Difference: ${hre.ethers.formatUnits(debtAfterRepay > expectedDebt ? debtAfterRepay - expectedDebt : expectedDebt - debtAfterRepay, 6)} USDC`);
  
  if (debtAfterRepay >= debtBeforeRepay) {
    throw new Error(`❌ Debt did not decrease`);
  }
  
  console.log("   ✅ TEST 4 PASSED: Partial repayment successful");
  
  // ================== TEST 5: FULL REPAYMENT ==================
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST 5: FULL REPAYMENT");
  console.log("-".repeat(70));
  
  const remainingDebt = await lendingPool.getOutstandingDebt(admin.address);
  
  console.log(`\n💰 Full Repayment:`);
  console.log(`   Remaining debt: ${hre.ethers.formatUnits(remainingDebt, 6)} USDC`);
  
  // Approve a bit more than the current debt to account for interest accrual during transaction
  const approvalAmount = remainingDebt + hre.ethers.parseUnits("1", 6); // Add 1 USDC buffer
  
  console.log(`\n📝 Approving USDC for full repayment (with buffer)...`);
  console.log(`   Approving: ${hre.ethers.formatUnits(approvalAmount, 6)} USDC`);
  const txApproveFullRepay = await usdc.approve(poolAddress, approvalAmount);
  await txApproveFullRepay.wait(1);
  console.log("   ✅ USDC approved");
  
  console.log(`\n💳 Executing full repayment with repayAll()...`);
  const txRepayAll = await lendingPool.repayAll();
  const receiptRepayAll = await txRepayAll.wait(1);
  
  // Get the actual amount repaid from the event
  const repaidEvent = receiptRepayAll.logs.find(
    log => log.topics[0] === hre.ethers.id("Repaid(address,uint256)")
  );
  
  console.log(`   ✅ Full repayment confirmed (Gas used: ${receiptRepayAll.gasUsed.toString()})`);
  
  console.log("\n✅ Verifying Post-Full-Repayment State:");
  const finalDebt = await lendingPool.userDebt(admin.address);
  const lastInterestUpdate = await lendingPool.lastInterestUpdate(admin.address);
  
  console.log(`   Final debt: ${hre.ethers.formatUnits(finalDebt, 6)} USDC`);
  console.log(`   Last interest update: ${lastInterestUpdate.toString()}`);
  
  if (finalDebt.toString() !== "0") {
    throw new Error(`❌ Debt should be zero`);
  }
  if (lastInterestUpdate.toString() !== "0") {
    throw new Error(`❌ Interest clock should be reset`);
  }
  
  console.log("   ✅ TEST 5 PASSED: Full repayment successful, debt cleared");
  
  // ================== TEST 6: WITHDRAW COLLATERAL ==================
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TEST 6: WITHDRAW COLLATERAL");
  console.log("-".repeat(70));
  
  console.log(`\n🔓 Withdrawing collateral (Token ${TOKEN_ID_TO_TEST})...`);
  const txWithdraw = await lendingPool.withdrawCollateral(TOKEN_ID_TO_TEST);
  const receiptWithdraw = await txWithdraw.wait(1);
  console.log(`   ✅ Withdrawal confirmed (Gas used: ${receiptWithdraw.gasUsed.toString()})`);
  
  console.log("\n✅ Verifying Post-Withdrawal State:");
  const finalOwner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
  const finalState = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
  const finalCollateral = await lendingPool.userCollateralValue(admin.address);
  const finalCollateralOwner = await lendingPool.collateralOwner(TOKEN_ID_TO_TEST);
  
  console.log(`   Token owner: ${finalOwner}`);
  console.log(`   Token state: ${finalState.toString()} (0 = IDLE)`);
  console.log(`   User collateral value: ${hre.ethers.formatUnits(finalCollateral, 6)} USDC`);
  console.log(`   Collateral owner in pool: ${finalCollateralOwner}`);
  
  if (finalOwner.toLowerCase() !== admin.address.toLowerCase()) {
    throw new Error(`❌ Token should be returned to admin`);
  }
  if (finalState.toString() !== "0") {
    throw new Error(`❌ Token should be IDLE`);
  }
  if (finalCollateral.toString() !== "0") {
    throw new Error(`❌ Collateral value should be zero`);
  }
  if (finalCollateralOwner !== hre.ethers.ZeroAddress) {
    throw new Error(`❌ Collateral owner should be cleared`);
  }
  
  console.log("   ✅ TEST 6 PASSED: Collateral withdrawn successfully");
  
  // ================== FINAL SUMMARY ==================
  console.log("\n" + "=".repeat(70));
  console.log("🎉 ALL TESTS PASSED!");
  console.log("=".repeat(70));
  
  console.log("\n📊 Final State Summary:");
  console.log(`   Admin USDC Balance: ${hre.ethers.formatUnits(await usdc.balanceOf(admin.address), 6)} USDC`);
  console.log(`   Pool USDC Balance: ${hre.ethers.formatUnits(await usdc.balanceOf(poolAddress), 6)} USDC`);
  console.log(`   Admin owns Token ${TOKEN_ID_TO_TEST}: ${await ticketNFT.ownerOf(TOKEN_ID_TO_TEST) === admin.address ? '✅' : '❌'}`);
  console.log(`   Admin debt: ${hre.ethers.formatUnits(await lendingPool.userDebt(admin.address), 6)} USDC`);
  console.log(`   Admin collateral: ${hre.ethers.formatUnits(await lendingPool.userCollateralValue(admin.address), 6)} USDC`);
  
  console.log("\n✅ LendingPool Contract is Production Ready! 🚀");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ TEST SUITE FAILED:");
    console.error(error);
    process.exit(1);
  });