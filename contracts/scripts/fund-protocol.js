import hre from "hardhat";

// --- CONFIGURATION (FIXED) ---
const TOKEN_IDS_TO_MINT = [1, 2, 3, 4]; // We only have 4 tokens in db.json
const POOL_FUND_AMOUNT = hre.ethers.parseUnits("500", 6); // 500 USDC
const USER_FUND_USDC = hre.ethers.parseUnits("400", 6);    // 400 USDC (for Bob/Charlie)
const USER_FUND_ETH = hre.ethers.parseEther("0.02");      // 0.02 ETH
const ORACLE_WAIT_TIMEOUT = 5 * 60 * 1000; // 5 minute timeout *per token*

// FUNDING THRESHOLDS - Only fund if below these amounts
const MIN_ETH_THRESHOLD = hre.ethers.parseEther("0.015");  // Fund if below 0.015 ETH
const MIN_USDC_THRESHOLD = hre.ethers.parseUnits("300", 6); // Fund if below 300 USDC
const MIN_POOL_THRESHOLD = hre.ethers.parseUnits("400", 6); // Fund pool if below 400 USDC

// Helper function
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------
async function main() {
  console.log("🚀 Starting Protocol Funding & Seeding Script...");
  console.log("=".repeat(70));

  // --- 1. GET ACTORS & CONNECT ---
  console.log("\n--- 1. CONNECTING TO ACTORS & CONTRACTS ---");
  
  const [admin, bob] = await hre.ethers.getSigners();
  if (!bob) throw new Error("❌ FAILED: 'SEPOLIA_PRIVATE_KEY1' is missing.");

  const charlie = hre.ethers.Wallet.createRandom().connect(hre.ethers.provider);

  console.log(`   Admin (Alice): ${admin.address}`);
  console.log(`   User (Bob):    ${bob.address}`);
  console.log(`   User (Charlie): ${charlie.address} (Newly created)`);

  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  const poolAddress = process.env.LENDING_POOL_ADDRESS;
  const usdcAddress = hre.ethers.getAddress("0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238");

  const ticketNFT = await hre.ethers.getContractAt("TicketNFT", nftAddress, admin);
  const pricingOracle = await hre.ethers.getContractAt("PricingOracle", oracleAddress, admin);
  const lendingPool = await hre.ethers.getContractAt("LendingPool", poolAddress, admin);
  const usdc = await hre.ethers.getContractAt("contracts/LendingPool.sol:IUSDC", usdcAddress, admin);

  console.log("   ✅ Connected to all contracts.");

  // --- 2. LOG ALL BALANCES (PRE-FUND) ---
  console.log("\n--- 2. CHECKING ALL BALANCES (PRE-FUND) ---");

  const adminEthStart = await hre.ethers.provider.getBalance(admin.address);
  const adminUsdcStart = await usdc.balanceOf(admin.address);

  console.log(`\n   --- Admin (Alice) Balances ---`);
  console.log(`   ETH:  ${hre.ethers.formatEther(adminEthStart)} ETH`);
  console.log(`   USDC: ${hre.ethers.formatUnits(adminUsdcStart, 6)} USDC`);

  const bobEthStart = await hre.ethers.provider.getBalance(bob.address);
  const bobUsdcStart = await usdc.balanceOf(bob.address);

  console.log(`\n   --- User (Bob) Balances ---`);
  console.log(`   ETH:  ${hre.ethers.formatEther(bobEthStart)} ETH`);
  console.log(`   USDC: ${hre.ethers.formatUnits(bobUsdcStart, 6)} USDC`);

  const charlieEthStart = await hre.ethers.provider.getBalance(charlie.address);
  const charlieUsdcStart = await usdc.balanceOf(charlie.address);

  console.log(`\n   --- User (Charlie) Balances ---`);
  console.log(`   ETH:  ${hre.ethers.formatEther(charlieEthStart)} ETH`);
  console.log(`   USDC: ${hre.ethers.formatUnits(charlieUsdcStart, 6)} USDC`);

  const poolUsdcStart = await usdc.balanceOf(poolAddress);

  console.log(`\n   --- Lending Pool Balances ---`);
  console.log(`   USDC: ${hre.ethers.formatUnits(poolUsdcStart, 6)} USDC`);

  // --- 3. FUND THE LENDING POOL (CONDITIONAL) ---
  console.log("\n--- 3. FUNDING THE LENDING POOL (IF NEEDED) ---");

  if (poolUsdcStart < MIN_POOL_THRESHOLD) {
    const poolFundNeeded = POOL_FUND_AMOUNT - poolUsdcStart;
    console.log(`   Pool balance (${hre.ethers.formatUnits(poolUsdcStart, 6)} USDC) is below threshold (${hre.ethers.formatUnits(MIN_POOL_THRESHOLD, 6)} USDC)`);
    
    if (adminUsdcStart < poolFundNeeded) {
      throw new Error(`❌ FAILED: Admin needs ${hre.ethers.formatUnits(poolFundNeeded, 6)} USDC to fund pool, but only has ${hre.ethers.formatUnits(adminUsdcStart, 6)}.`);
    }

    console.log(`   Approving pool to take ${hre.ethers.formatUnits(poolFundNeeded, 6)} USDC...`);
    await (await usdc.approve(poolAddress, poolFundNeeded)).wait(1);

    console.log("   Calling fundPool()...");
    await (await lendingPool.fundPool(poolFundNeeded)).wait(1);
    console.log("   ✅ LendingPool funded.");
  } else {
    console.log(`   Pool already has ${hre.ethers.formatUnits(poolUsdcStart, 6)} USDC. Skipping funding.`);
  }

  // --- 4. FUND THE ACTORS (BOB & CHARLIE) - CONDITIONAL ---
  console.log("\n--- 4. FUNDING 'BOB' & 'CHARLIE' (IF NEEDED) ---");

  // Calculate total funding needed
  let totalUsdcNeeded = 0n;
  let totalEthNeeded = 0n;

  // BOB FUNDING CHECK
  console.log(`\n   --- Checking Bob's funding needs ---`);
  
  if (bobUsdcStart < MIN_USDC_THRESHOLD) {
    const bobUsdcNeeded = USER_FUND_USDC - bobUsdcStart;
    totalUsdcNeeded += bobUsdcNeeded;
    console.log(`   Bob needs ${hre.ethers.formatUnits(bobUsdcNeeded, 6)} USDC (current: ${hre.ethers.formatUnits(bobUsdcStart, 6)})`);
  } else {
    console.log(`   Bob has enough USDC (${hre.ethers.formatUnits(bobUsdcStart, 6)}). Skipping.`);
  }

  if (bobEthStart < MIN_ETH_THRESHOLD) {
    const bobEthNeeded = USER_FUND_ETH - bobEthStart;
    totalEthNeeded += bobEthNeeded;
    console.log(`   Bob needs ${hre.ethers.formatEther(bobEthNeeded)} ETH (current: ${hre.ethers.formatEther(bobEthStart)})`);
  } else {
    console.log(`   Bob has enough ETH (${hre.ethers.formatEther(bobEthStart)}). Skipping.`);
  }

  // CHARLIE FUNDING CHECK
  console.log(`\n   --- Checking Charlie's funding needs ---`);
  
  if (charlieUsdcStart < MIN_USDC_THRESHOLD) {
    const charlieUsdcNeeded = USER_FUND_USDC - charlieUsdcStart;
    totalUsdcNeeded += charlieUsdcNeeded;
    console.log(`   Charlie needs ${hre.ethers.formatUnits(charlieUsdcNeeded, 6)} USDC (current: ${hre.ethers.formatUnits(charlieUsdcStart, 6)})`);
  } else {
    console.log(`   Charlie has enough USDC (${hre.ethers.formatUnits(charlieUsdcStart, 6)}). Skipping.`);
  }

  if (charlieEthStart < MIN_ETH_THRESHOLD) {
    const charlieEthNeeded = USER_FUND_ETH - charlieEthStart;
    totalEthNeeded += charlieEthNeeded;
    console.log(`   Charlie needs ${hre.ethers.formatEther(charlieEthNeeded)} ETH (current: ${hre.ethers.formatEther(charlieEthStart)})`);
  } else {
    console.log(`   Charlie has enough ETH (${hre.ethers.formatEther(charlieEthStart)}). Skipping.`);
  }

  // CHECK IF ADMIN HAS ENOUGH TO FUND
  if (totalUsdcNeeded > 0n || totalEthNeeded > 0n) {
    console.log(`\n   --- Total funding needed ---`);
    console.log(`   USDC: ${hre.ethers.formatUnits(totalUsdcNeeded, 6)}`);
    console.log(`   ETH:  ${hre.ethers.formatEther(totalEthNeeded)}`);

    if (adminUsdcStart < totalUsdcNeeded) {
      throw new Error(`❌ FAILED: Admin needs ${hre.ethers.formatUnits(totalUsdcNeeded, 6)} USDC but only has ${hre.ethers.formatUnits(adminUsdcStart, 6)}.`);
    }

    if (adminEthStart < totalEthNeeded) {
      throw new Error(`❌ FAILED: Admin needs ${hre.ethers.formatEther(totalEthNeeded)} ETH but only has ${hre.ethers.formatEther(adminEthStart)}.`);
    }
  }

  // EXECUTE FUNDING
  console.log(`\n   --- Executing transfers ---`);

  // Fund Bob
  if (bobUsdcStart < MIN_USDC_THRESHOLD) {
    const bobUsdcAmount = USER_FUND_USDC - bobUsdcStart;
    console.log(`   Transferring ${hre.ethers.formatUnits(bobUsdcAmount, 6)} USDC to Bob...`);
    await (await usdc.transfer(bob.address, bobUsdcAmount)).wait(1);
  }

  if (bobEthStart < MIN_ETH_THRESHOLD) {
    const bobEthAmount = USER_FUND_ETH - bobEthStart;
    console.log(`   Transferring ${hre.ethers.formatEther(bobEthAmount)} ETH to Bob...`);
    await (await admin.sendTransaction({ to: bob.address, value: bobEthAmount })).wait(1);
  }

  // Fund Charlie
  if (charlieUsdcStart < MIN_USDC_THRESHOLD) {
    const charlieUsdcAmount = USER_FUND_USDC - charlieUsdcStart;
    console.log(`   Transferring ${hre.ethers.formatUnits(charlieUsdcAmount, 6)} USDC to Charlie...`);
    await (await usdc.transfer(charlie.address, charlieUsdcAmount)).wait(1);
  }

  if (charlieEthStart < MIN_ETH_THRESHOLD) {
    const charlieEthAmount = USER_FUND_ETH - charlieEthStart;
    console.log(`   Transferring ${hre.ethers.formatEther(charlieEthAmount)} ETH to Charlie...`);
    await (await admin.sendTransaction({ to: charlie.address, value: charlieEthAmount })).wait(1);
  }

  console.log("   ✅ Actors funded (where needed).");

  // --- 5. CREATE & PRICE ASSETS (THE "PATIENT" LOOP) ---
  console.log("\n--- 5. MINTING & PRICING ALL 4 TEST ASSETS ---");
  
  for (const tokenId of TOKEN_IDS_TO_MINT) {
    console.log(`\n   ========================================`);
    console.log(`   Processing Token ${tokenId}...`);
    
    // A. MINT (with "already-minted" check)
    let owner;
    try { 
      owner = await ticketNFT.ownerOf(tokenId); 
    } catch (e) { /* DNE */ }

    if (owner === admin.address) {
      console.log(`   Token ${tokenId} already minted. Skipping mint.`);
    } else if (owner) {
      console.log(`   🟡 WARNING: Token ${tokenId} is owned by ${owner}. Skipping mint.`);
    } else {
      console.log(`   Minting Token ${tokenId} to Admin...`);
      const flightDetails = {
          routeHash: hre.ethers.encodeBytes32String("JFK-LAX"),
          departureTimestamp: 1768108800, // Dec 2026
          fareTierIdentifier: hre.ethers.encodeBytes32String("economy")
      };
      await (await ticketNFT.mint(admin.address, tokenId, flightDetails, `https://.../${tokenId}`)).wait(1);
      console.log(`   ✅ Token ${tokenId} minted.`);
    }

    // B. PRICE (REQUEST)
    // Check if price is *already* set. If so, we can skip the wait.
    let currentPrice = await pricingOracle.getPrice(tokenId);
    if (currentPrice.toString() !== "0") {
      console.log(`   Token ${tokenId} already has a price: $${currentPrice.toString()}`);
      console.log(`   Skipping oracle request for this token.`);
      continue; // Skip to the next token in the loop
    }

    // If price is 0, we must request it.
    console.log(`   Requesting price for Token ${tokenId}...`);
    const tx = await pricingOracle.requestPriceUpdate(tokenId);
    const receipt = await tx.wait(1);
    const event = receipt.logs.find(log => log.eventName === 'PriceRequestSent');
    const requestId = event.args[0];
    console.log(`   ✅ Price request sent! (Request ID: ${requestId.slice(0, 8)}...)`);

    // C. WAIT FOR FULFILLMENT (THIS IS THE "PATIENT" PART)
    console.log(`   ...Waiting for Chainlink fulfillment (2-5 mins)...`);
    let priceSet = false;
    const startTime = Date.now();

    while (Date.now() - startTime < ORACLE_WAIT_TIMEOUT) {
      await delay(20000); // Wait 20 seconds
      const price = await pricingOracle.getPrice(tokenId);
      
      if (price.toString() !== "0") {
        priceSet = true;
        console.log(`   >>> PRICE RECEIVED! Token ${tokenId} Price: $${price.toString()}`);
        break; 
      } else {
        console.log("   ...still waiting...");
      }
    }

    if (!priceSet) {
      throw new Error(`❌ FAILED: Oracle pipeline timed out for Token ${tokenId}.`);
    }
  }

  console.log("\n" + "=".repeat(70));
  console.log("🎉 PROTOCOL IS FULLY FUNDED, SEEDED, AND READY FOR TESTS! 🚀");
  console.log("=".repeat(70));
  
  // --- FINAL BALANCE REPORT ---
  console.log("\n--- FINAL BALANCE REPORT ---");

  const adminEthEnd = await hre.ethers.provider.getBalance(admin.address);
  const adminUsdcEnd = await usdc.balanceOf(admin.address);
  console.log(`\n   --- Admin (Alice) Final ---`);
  console.log(`   ETH:  ${hre.ethers.formatEther(adminEthEnd)} ETH (spent: ${hre.ethers.formatEther(adminEthStart - adminEthEnd)})`);
  console.log(`   USDC: ${hre.ethers.formatUnits(adminUsdcEnd, 6)} USDC (spent: ${hre.ethers.formatUnits(adminUsdcStart - adminUsdcEnd, 6)})`);

  const bobEthEnd = await hre.ethers.provider.getBalance(bob.address);
  const bobUsdcEnd = await usdc.balanceOf(bob.address);
  console.log(`\n   --- User (Bob) Final ---`);
  console.log(`   ETH:  ${hre.ethers.formatEther(bobEthEnd)} ETH`);
  console.log(`   USDC: ${hre.ethers.formatUnits(bobUsdcEnd, 6)} USDC`);

  const charlieEthEnd = await hre.ethers.provider.getBalance(charlie.address);
  const charlieUsdcEnd = await usdc.balanceOf(charlie.address);
  console.log(`\n   --- User (Charlie) Final ---`);
  console.log(`   ETH:  ${hre.ethers.formatEther(charlieEthEnd)} ETH`);
  console.log(`   USDC: ${hre.ethers.formatUnits(charlieUsdcEnd, 6)} USDC`);

  const poolUsdcEnd = await usdc.balanceOf(poolAddress);
  console.log(`\n   --- Lending Pool Final ---`);
  console.log(`   USDC: ${hre.ethers.formatUnits(poolUsdcEnd, 6)} USDC`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Setup script failed:");
    console.error(error);
    process.exit(1);
  });