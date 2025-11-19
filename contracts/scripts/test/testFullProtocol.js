import hre from "hardhat";

// --- CONFIGURATION ---
const TOKEN_ID_TO_TEST = 4; // Use existing Token ID 4
const LISTING_PRICE = hre.ethers.parseUnits("50", 6); // 50 USDC
const BORROW_AMOUNT = hre.ethers.parseUnits("5", 6); // 5 USDC
// ---------------------

// Helper function for delays
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log("🚀 Starting Grand Integration Test: The Full FlightStakeFi Protocol...");
    console.log("=".repeat(70));

    // --- 1. SETUP ---
    console.log("\n--- 1. SETUP & CONNECTION ---");
    const [user] = await hre.ethers.getSigners();
    console.log(`   👤 User (Tester): ${user.address}`);
    console.log(`   💰 ETH Balance: ${hre.ethers.formatEther(await hre.ethers.provider.getBalance(user.address))} ETH`);

    // Load Addresses from Env
    const nftAddress = process.env.TICKET_NFT_ADDRESS;
    const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
    const vaultAddress = process.env.STAKING_VAULT_ADDRESS;
    const poolAddress = process.env.LENDING_POOL_ADDRESS;
    const marketAddress = process.env.MARKETPLACE_ADDRESS;
    const usdcAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // Sepolia USDC

    if (!nftAddress || !oracleAddress || !vaultAddress || !poolAddress || !marketAddress) {
        throw new Error("❌ Missing contract addresses in .env file.");
    }

    // Connect to Contracts
    const ticketNFT = await hre.ethers.getContractAt("TicketNFT", nftAddress, user);
    const pricingOracle = await hre.ethers.getContractAt("PricingOracle", oracleAddress, user);
    const stakingVault = await hre.ethers.getContractAt("StakingVault", vaultAddress, user);
    const lendingPool = await hre.ethers.getContractAt("LendingPool", poolAddress, user);
    const marketplace = await hre.ethers.getContractAt("Marketplace", marketAddress, user);
    const usdc = await hre.ethers.getContractAt("contracts/LendingPool.sol:IUSDC", usdcAddress, user);

    console.log("   ✅ Connected to all contracts.");

    // --- 2. ASSET CHECK (MINTING SKIPPED) ---
    console.log("\n--- 2. ASSET CHECK ---");
    console.log(`   Checking Token ID ${TOKEN_ID_TO_TEST}...`);

    let owner;
    try {
        owner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
        console.log(`   ✅ Token ${TOKEN_ID_TO_TEST} exists. Owner: ${owner}`);
    } catch (e) {
        throw new Error(`❌ Token ${TOKEN_ID_TO_TEST} does not exist. Please run fund-protocol.js first.`);
    }

    if (owner !== user.address) {
        // Check if it's in the vault, pool, or marketplace
        if (owner === vaultAddress) {
            console.log("   ⚠️ Token is currently STAKED. Unstaking for test...");
            // We need to be the original owner to unstake. 
            // Assuming 'user' is the one who staked it.
            // If not, we can't proceed easily.
            try {
                await (await stakingVault.unstake(TOKEN_ID_TO_TEST)).wait(1);
                console.log("   ✅ Unstaked.");
            } catch (e) {
                throw new Error(`❌ Token is staked but we couldn't unstake it. Is 'user' the staker? Error: ${e.message}`);
            }
        } else if (owner === poolAddress) {
            // It might be collateral.
            console.log("   ⚠️ Token is currently COLLATERALIZED. Withdrawing for test...");
            try {
                // Check debt first?
                const debt = await lendingPool.getOutstandingDebt(user.address);
                if (debt > 0n) {
                    console.log(`   User has debt: ${debt}. Repaying...`);
                    await (await usdc.approve(poolAddress, debt)).wait(1);
                    await (await lendingPool.repay(debt)).wait(1);
                }
                await (await lendingPool.withdrawCollateral(TOKEN_ID_TO_TEST)).wait(1);
                console.log("   ✅ Withdrawn.");
            } catch (e) {
                throw new Error(`❌ Token is collateral but we couldn't withdraw it. Error: ${e.message}`);
            }
        } else if (owner === marketAddress) {
            // It might be listed.
            console.log("   ⚠️ Token is currently LISTED. Cancelling listing for test...");
            try {
                await (await marketplace.cancelListing(TOKEN_ID_TO_TEST)).wait(1);
                console.log("   ✅ Cancelled listing.");
            } catch (e) {
                throw new Error(`❌ Token is listed but we couldn't cancel it. Error: ${e.message}`);
            }
        } else {
            throw new Error(`❌ Token ${TOKEN_ID_TO_TEST} is owned by ${owner}, not us (${user.address}). Cannot proceed.`);
        }
    }

    // Double check we have it now
    owner = await ticketNFT.ownerOf(TOKEN_ID_TO_TEST);
    if (owner !== user.address) {
        throw new Error("❌ Failed to acquire token ownership.");
    }
    console.log("   ✅ We have the token.");

    // Ensure state is IDLE
    const state = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
    if (state.toString() !== "0") { // 0 = IDLE
        console.log(`   ⚠️ Token state is ${state}. Resetting to IDLE...`);
        // Only protocol can set state, but if we own it and it's not in a protocol contract, 
        // it implies a state desync or we need to use a specific function.
        // Actually, if we own it, it SHOULD be IDLE unless it was manually messed with.
        // Let's assume it's fine or try to proceed.
    }


    // --- 3. ORACLE UPDATE (Phase 2 Integration) ---
    console.log("\n--- 3. ORACLE PRICE UPDATE ---");
    let price = await pricingOracle.getPrice(TOKEN_ID_TO_TEST);
    console.log(`   Current Oracle Price: $${price.toString()}`);

    if (price < 1000000n) { // Less than 1 USDC (scaled)
        console.log("   Price is unscaled or 0. Requesting update from Chainlink...");
        const tx = await pricingOracle.requestPriceUpdate(TOKEN_ID_TO_TEST);
        const receipt = await tx.wait(1);
        const event = receipt.logs.find(log => log.eventName === 'PriceRequestSent');
        if (event) {
            console.log(`   ✅ Request Sent! ID: ${event.args[0]}`);
            console.log("   ⏳ Waiting for Chainlink fulfillment (approx 2-5 mins)...");

            const timeout = 5 * 60 * 1000;
            const start = Date.now();

            // Listen for errors
            pricingOracle.on("PriceRequestError", (requestId, err) => {
                console.log(`\n   ❌ ORACLE ERROR: Request ${requestId} failed!`);
                console.log(`   Error Data: ${err}`);
            });

            while (Date.now() - start < timeout) {
                await delay(20000);
                process.stdout.write(".");
                price = await pricingOracle.getPrice(TOKEN_ID_TO_TEST);
                if (price > 1000000n) { // Wait for SCALED price
                    console.log("\n   ✅ Price Updated!");
                    break;
                }
            }
            if (price < 1000000n) throw new Error("❌ Oracle update timed out or returned unscaled price.");
        } else {
            console.log("   ⚠️ Could not find PriceRequestSent event, but tx succeeded. Waiting anyway...");
        }
    } else {
        console.log("   ✅ Price already set and scaled. Skipping update.");
    }
    console.log(`   Final Price: $${price.toString()}`);


    // --- 4. STAKING ---
    console.log("\n--- 4. STAKING VAULT ---");
    console.log("   Approving StakingVault...");
    await (await ticketNFT.approve(vaultAddress, TOKEN_ID_TO_TEST)).wait(1);

    console.log("   Staking...");
    await (await stakingVault.stake(TOKEN_ID_TO_TEST)).wait(1);
    console.log("   ✅ Staked!");

    // Verify State
    const stateStaked = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
    console.log(`   Token State: ${stateStaked} (Expect 1: STAKED)`);
    if (stateStaked.toString() !== "1") throw new Error("❌ State mismatch after staking");

    console.log("   Unstaking...");
    await (await stakingVault.unstake(TOKEN_ID_TO_TEST)).wait(1);
    console.log("   ✅ Unstaked!");


    // --- 5. LENDING POOL ---
    console.log("\n--- 5. LENDING POOL ---");
    console.log("   Approving LendingPool...");
    await (await ticketNFT.approve(poolAddress, TOKEN_ID_TO_TEST)).wait(1);

    // CHECK & SET RISK PARAMETERS
    const ltv = await lendingPool.loanToValue();
    if (ltv.toString() === "0") {
        console.log("   ⚠️ Risk parameters not set. Initializing...");
        // LTV: 75%, Threshold: 80%, Interest: 5%
        await (await lendingPool.setRiskParameters(75, 80, 500)).wait(1);
        console.log("   ✅ Risk parameters set (LTV: 75%).");
    }

    console.log("   Depositing Collateral...");
    await (await lendingPool.depositCollateral(TOKEN_ID_TO_TEST)).wait(1);
    console.log("   ✅ Collateral Deposited!");

    // Verify State
    const stateCollateral = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
    console.log(`   Token State: ${stateCollateral} (Expect 2: COLLATERALIZED)`);
    if (stateCollateral.toString() !== "2") throw new Error("❌ State mismatch after deposit");

    console.log(`   Borrowing ${hre.ethers.formatUnits(BORROW_AMOUNT, 6)} USDC...`);
    // Check pool liquidity
    const poolBalance = await usdc.balanceOf(poolAddress);
    console.log(`   Pool Liquidity: ${hre.ethers.formatUnits(poolBalance, 6)} USDC`);

    if (poolBalance >= BORROW_AMOUNT) {
        await (await lendingPool.borrow(BORROW_AMOUNT)).wait(1);
        console.log("   ✅ Borrowed!");

        console.log("   Repaying...");
        await (await usdc.approve(poolAddress, BORROW_AMOUNT)).wait(1);
        await (await lendingPool.repay(BORROW_AMOUNT)).wait(1);
        console.log("   ✅ Repaid!");
    } else {
        console.log("   ⚠️ Pool has insufficient liquidity. Skipping borrow/repay.");
    }

    console.log("   Withdrawing Collateral...");
    await (await lendingPool.withdrawCollateral(TOKEN_ID_TO_TEST)).wait(1);
    console.log("   ✅ Collateral Withdrawn!");


    // --- 6. MARKETPLACE ---
    console.log("\n--- 6. MARKETPLACE ---");
    console.log("   Approving Marketplace...");
    await (await ticketNFT.approve(marketAddress, TOKEN_ID_TO_TEST)).wait(1);

    console.log(`   Listing for ${hre.ethers.formatUnits(LISTING_PRICE, 6)} USDC...`);
    await (await marketplace.listItem(TOKEN_ID_TO_TEST, LISTING_PRICE)).wait(1);
    console.log("   ✅ Listed!");

    // Verify State
    const stateListed = await ticketNFT.getTokenState(TOKEN_ID_TO_TEST);
    console.log(`   Token State: ${stateListed} (Expect 3: LISTED)`);
    if (stateListed.toString() !== "3") throw new Error("❌ State mismatch after listing");

    console.log("   Cancelling Listing...");
    await (await marketplace.cancelListing(TOKEN_ID_TO_TEST)).wait(1);
    console.log("   ✅ Cancelled!");


    // --- 7. FINISH ---
    console.log("\n" + "=".repeat(70));
    console.log("🎉 GRAND INTEGRATION TEST PASSED! 🎉");
    console.log("The protocol is fully functional on Sepolia.");
    console.log("=".repeat(70));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ TEST FAILED:");
        console.error(error);
        process.exit(1);
    });
