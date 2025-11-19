import hre from "hardhat";

async function main() {
    console.log("TICKET_NFT_ADDRESS=" + process.env.TICKET_NFT_ADDRESS);
    console.log("PRICING_ORACLE_ADDRESS=" + process.env.PRICING_ORACLE_ADDRESS);
    console.log("STAKING_VAULT_ADDRESS=" + process.env.STAKING_VAULT_ADDRESS);
    console.log("LENDING_POOL_ADDRESS=" + process.env.LENDING_POOL_ADDRESS);
    console.log("MARKETPLACE_ADDRESS=" + process.env.MARKETPLACE_ADDRESS);
    console.log("LIQUIDATION_ENGINE_ADDRESS=" + process.env.LIQUIDATION_ENGINE_ADDRESS);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
