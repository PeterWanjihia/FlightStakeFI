import hre from "hardhat";

async function main() {
  console.log("🚀 Starting 3-Contract Integration Test (Staking)...");

  // 1. Get the Signer (Admin)
  const [admin] = await hre.ethers.getSigners();
  console.log(`    Signer (Admin): ${admin.address}`);

  // 2. Get all 3 Contract Addresses from .env
  const nftAddress = process.env.TICKET_NFT_ADDRESS;
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  const vaultAddress = process.env.STAKING_VAULT_ADDRESS;

  if (!nftAddress || !oracleAddress || !vaultAddress) {
    throw new Error("Missing one or more contract addresses in .env file");
  }

  // 3. Connect to all 3 deployed contracts
  const ticketNFT = await hre.ethers.getContractAt(
    "TicketNFT",
    nftAddress,
    admin
  );
  const pricingOracle = await hre.ethers.getContractAt(
    "PricingOracle",
    oracleAddress,
    admin
  );
  const stakingVault = await hre.ethers.getContractAt(
    "StakingVault",
    vaultAddress,
    admin
  );

  console.log("    ✅ Connected to TicketNFT, PricingOracle, and StakingVault.");

  // --- 4. FULL PRE-FLIGHT CHECK ---
  console.log("\n--- PRE-FLIGHT CHECK ---");
  console.log("    Verifying StakingVault's dependencies...");

  // --- CHECK 1: Is the NFT address correct? ---
  const vault_s_NftAddress = await stakingVault.ticketNFT();
  if (vault_s_NftAddress !== nftAddress) {
    console.error("❌ FATAL ERROR: MISMATCHED TICKET_NFT ADDRESS");
    console.error(`    Vault (${vaultAddress}) is pointing to the WRONG TicketNFT.`);
    console.error(`    It points to:       ${vault_s_NftAddress}`);
    console.error(`    It SHOULD point to: ${nftAddress} (from your .env)`);
    console.error("\n    SOLUTION: You must re-deploy your StakingVault contract.");
    process.exit(1);
  }
  console.log("    ✅ StakingVault is pointing to the correct TicketNFT.");

  // --- CHECK 2: Is the Oracle address correct? ---
  const vault_s_OracleAddress = await stakingVault.pricingOracle();
  if (vault_s_OracleAddress !== oracleAddress) {
    console.error("❌ FATAL ERROR: MISMATCHED ORACLE ADDRESS");
    console.error(`    Vault (${vaultAddress}) is pointing to the WRONG oracle.`);
    console.error(`    It points to:       ${vault_s_OracleAddress}`);
    console.error(`    It SHOULD point to: ${oracleAddress} (from your .env)`);
    console.error("\n    SOLUTION: You must re-deploy your StakingVault contract.");
    process.exit(1);
  }
  console.log("    ✅ StakingVault is pointing to the correct PricingOracle.");

  
  // --- 5. SETUP: Authorize the Vault ---
  console.log("\n--- SETUP 1: AUTHORIZE ---");
  // ... (rest of the script is identical)
  console.log(`    Authorizing StakingVault (${vaultAddress}) on TicketNFT...`);

  const txAuth = await ticketNFT.setStakingVault(vaultAddress);
  await txAuth.wait(1);

  console.log("    ✅ StakingVault is now authorized.");

  // --- 6. SETUP: APPROVE THE VAULT ---
  console.log("\n--- SETUP 2: APPROVE ---");
  const tokenId = 1; 
  console.log(`    Approving StakingVault to take Token ${tokenId}...`);

  const txApprove = await ticketNFT.approve(vaultAddress, tokenId);
  await txApprove.wait(1);

  console.log("    ✅ StakingVault is now approved for Token 1.");

  // --- 7. TEST 1: STAKE TOKEN ---
  console.log("\n--- TEST 1: STAKE ---");
  console.log(`    Calling stakingVault.stake(${tokenId})...`);

  const txStake = await stakingVault.stake(tokenId);
  await txStake.wait(1);
  console.log("    ✅ stake() transaction confirmed.");

  // --- VERIFICATION 1 ---
  console.log("    Verifying on-chain state...");
  const newOwner = await ticketNFT.ownerOf(tokenId);
  const newState = await ticketNFT.getTokenState(tokenId);

  if (newOwner !== vaultAddress) {
    throw new Error(
      `❌ FAILED: Owner should be vault (${vaultAddress}), but is ${newOwner}`
    );
  }
  if (newState.toString() !== "1") {
    throw new Error(
      `❌ FAILED: State should be 1 (STAKED), but is ${newState.toString()}`
    );
  }

  console.log(`    ✅ PASSED: Token ${tokenId} is now owned by the vault.`);
  console.log(`    ✅ PASSED: Token ${tokenId} state is now STAKED (1).`);

  // --- 8. TEST 2: UNSTAKE TOKEN ---
  console.log("\n--- TEST 2: UNSTAKE ---");
  console.log(`    Calling stakingVault.unstake(${tokenId})...`);

  const txUnstake = await stakingVault.unstake(tokenId);
  await txUnstake.wait(1);
  console.log("    ✅ unstake() transaction confirmed.");

  // --- VERIFICATION 2 ---
  console.log("    Verifying on-chain state...");
  const finalOwner = await ticketNFT.ownerOf(tokenId);
  const finalState = await ticketNFT.getTokenState(tokenId);

  if (finalOwner !== admin.address) {
    throw new Error(
      `❌ FAILED: Owner should be admin (${admin.address}), but is ${finalOwner}`
    );
  }
  if (finalState.toString() !== "0") {
    throw new Error(
      `❌ FAILED: State should be 0 (IDLE), but is ${finalState.toString()}`
    );
  }

  console.log(`    ✅ PASSED: Token ${tokenId} is now owned by the admin.`);
  console.log(`    ✅ PASSED: Token ${tokenId} state is now IDLE (0).`);

  console.log("\n✅ Full Integration Test Passed!");
}

// Standard "runner"
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Test failed:");
    console.error(error);
    process.exit(1);
  });