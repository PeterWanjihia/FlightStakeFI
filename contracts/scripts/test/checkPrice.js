import hre from "hardhat";
const TOKEN_ID_TO_TEST = 1;

async function main() {
  console.log("🚀 Checking price on live Oracle contract...");
  const oracleAddress = process.env.PRICING_ORACLE_ADDRESS;
  const oracle = await hre.ethers.getContractAt("PricingOracle", oracleAddress);
  
  const price = await oracle.getPrice(TOKEN_ID_TO_TEST);
  
  console.log("\n" + "=".repeat(70));
  console.log(`✅ PRICE FOR TOKEN ${TOKEN_ID_TO_TEST} IS: $${price.toString()}`);
  console.log("=".repeat(70));
}

main().catch(console.error);