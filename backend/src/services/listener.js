import { ethers } from "ethers";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- CONFIGURATION ---
const WSS_URL = process.env.SEPOLIA_WSS_URL;
if (!WSS_URL) throw new Error("Missing SEPOLIA_WSS_URL in .env");

// Contract Addresses
const ADDRESSES = {
    TicketNFT: process.env.TICKET_NFT_ADDRESS,
    PricingOracle: process.env.PRICING_ORACLE_ADDRESS,
    StakingVault: process.env.STAKING_VAULT_ADDRESS,
    LendingPool: process.env.LENDING_POOL_ADDRESS,
    Marketplace: process.env.MARKETPLACE_ADDRESS,
};

// Helper to load ABI
const loadABI = (contractName, fileName) => {
    const artifactPath = path.resolve(__dirname, `../../../contracts/artifacts/contracts/${fileName || contractName}.sol/${contractName}.json`);
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    return artifact.abi;
};

async function main() {
    console.log("👂 Starting FlightStakeFi Event Listener...");
    console.log(`   Connecting to: ${WSS_URL}`);

    const provider = new ethers.WebSocketProvider(WSS_URL);

    // Keep connection alive
    provider._websocket.on("close", async (code) => {
        console.log(`⚠️ Connection lost (code ${code}). Reconnecting in 5s...`);
        setTimeout(main, 5000);
    });

    // --- INITIALIZE CONTRACTS ---
    const ticketNFT = new ethers.Contract(ADDRESSES.TicketNFT, loadABI("TicketNFT"), provider);
    const stakingVault = new ethers.Contract(ADDRESSES.StakingVault, loadABI("StakingVault"), provider);
    const lendingPool = new ethers.Contract(ADDRESSES.LendingPool, loadABI("LendingPool"), provider);
    const marketplace = new ethers.Contract(ADDRESSES.Marketplace, loadABI("Marketplace", "MarketPlace"), provider); // Note: MarketPlace.sol vs Marketplace contract name
    const pricingOracle = new ethers.Contract(ADDRESSES.PricingOracle, loadABI("PricingOracle"), provider);

    console.log("   ✅ Contracts initialized.");

    // --- EVENT HANDLERS ---

    // 1. TicketNFT: Transfer (Minting & Ownership Changes)
    ticketNFT.on("Transfer", async (from, to, tokenId, event) => {
        console.log(`[Transfer] Token ${tokenId} moved from ${from} to ${to}`);

        try {
            const id = Number(tokenId);
            // Upsert Ticket
            await prisma.ticket.upsert({
                where: { tokenId: id },
                update: { ownerAddress: to },
                create: {
                    tokenId: id,
                    ownerAddress: to,
                    status: "IDLE",
                    price: 0
                }
            });

            // Ensure Users exist
            await prisma.user.upsert({ where: { address: to }, update: {}, create: { address: to } });
            if (from !== ethers.ZeroAddress) {
                await prisma.user.upsert({ where: { address: from }, update: {}, create: { address: from } });
            }

            // Log Transaction
            await prisma.transaction.create({
                data: {
                    hash: event.log.transactionHash,
                    type: from === ethers.ZeroAddress ? "MINT" : "TRANSFER",
                    userAddress: to,
                    tokenId: id,
                    timestamp: new Date()
                }
            });
        } catch (e) {
            console.error("Error handling Transfer:", e);
        }
    });

    // 2. StakingVault: TokenStaked / TokenUnstaked
    stakingVault.on("TokenStaked", async (user, tokenId, value, event) => {
        console.log(`[Staked] Token ${tokenId} by ${user}`);
        try {
            await prisma.ticket.update({
                where: { tokenId: Number(tokenId) },
                data: { status: "STAKED" }
            });
            await prisma.transaction.create({
                data: {
                    hash: event.log.transactionHash,
                    type: "STAKE",
                    userAddress: user,
                    tokenId: Number(tokenId),
                    amount: Number(ethers.formatUnits(value, 6)) // Assuming 6 decimals for value if it's price
                }
            });
        } catch (e) { console.error(e); }
    });

    stakingVault.on("TokenUnstaked", async (user, tokenId, event) => {
        console.log(`[Unstaked] Token ${tokenId} by ${user}`);
        try {
            await prisma.ticket.update({
                where: { tokenId: Number(tokenId) },
                data: { status: "IDLE" }
            });
            await prisma.transaction.create({
                data: {
                    hash: event.log.transactionHash,
                    type: "UNSTAKE",
                    userAddress: user,
                    tokenId: Number(tokenId)
                }
            });
        } catch (e) { console.error(e); }
    });

    // 3. LendingPool: CollateralDeposited / Withdrawn / Borrowed / Repaid
    lendingPool.on("CollateralDeposited", async (user, tokenId, value, event) => {
        console.log(`[Collateral] Token ${tokenId} deposited by ${user}`);
        try {
            await prisma.ticket.update({
                where: { tokenId: Number(tokenId) },
                data: { status: "COLLATERALIZED" }
            });
            await prisma.transaction.create({
                data: {
                    hash: event.log.transactionHash,
                    type: "DEPOSIT",
                    userAddress: user,
                    tokenId: Number(tokenId)
                }
            });
        } catch (e) { console.error(e); }
    });

    lendingPool.on("CollateralWithdrawn", async (user, tokenId, value, event) => {
        console.log(`[Collateral] Token ${tokenId} withdrawn by ${user}`);
        try {
            await prisma.ticket.update({
                where: { tokenId: Number(tokenId) },
                data: { status: "IDLE" }
            });
            await prisma.transaction.create({
                data: {
                    hash: event.log.transactionHash,
                    type: "WITHDRAW",
                    userAddress: user,
                    tokenId: Number(tokenId)
                }
            });
        } catch (e) { console.error(e); }
    });

    // 4. Marketplace: ItemListed / ItemCanceled / ItemBought
    marketplace.on("ItemListed", async (seller, tokenId, price, event) => {
        console.log(`[Listed] Token ${tokenId} for ${price}`);
        try {
            const priceNum = Number(ethers.formatUnits(price, 6));
            await prisma.ticket.update({
                where: { tokenId: Number(tokenId) },
                data: { status: "LISTED" }
            });
            await prisma.listing.create({
                data: {
                    tokenId: Number(tokenId),
                    sellerAddress: seller,
                    price: priceNum
                }
            });
            await prisma.transaction.create({
                data: {
                    hash: event.log.transactionHash,
                    type: "LIST",
                    userAddress: seller,
                    tokenId: Number(tokenId),
                    amount: priceNum
                }
            });
        } catch (e) { console.error(e); }
    });

    marketplace.on("ItemCanceled", async (seller, tokenId, event) => {
        console.log(`[Canceled] Listing for Token ${tokenId}`);
        try {
            await prisma.ticket.update({
                where: { tokenId: Number(tokenId) },
                data: { status: "IDLE" }
            });
            await prisma.listing.delete({
                where: { tokenId: Number(tokenId) }
            });
            await prisma.transaction.create({
                data: {
                    hash: event.log.transactionHash,
                    type: "CANCEL",
                    userAddress: seller,
                    tokenId: Number(tokenId)
                }
            });
        } catch (e) { console.error(e); }
    });

    // 5. PricingOracle: PriceUpdated
    pricingOracle.on("PriceUpdated", async (tokenId, price, event) => {
        console.log(`[Price] Token ${tokenId} updated to ${price}`);
        try {
            const priceNum = Number(ethers.formatUnits(price, 6));
            await prisma.ticket.update({
                where: { tokenId: Number(tokenId) },
                data: { price: priceNum }
            });
        } catch (e) { console.error(e); }
    });

    console.log("   🚀 Listening for events...");
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
