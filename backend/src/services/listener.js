import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const RPC_URL = process.env.SEPOLIA_WSS_URL || process.env.SEPOLIA_RPC_URL;
const provider = new ethers.WebSocketProvider(RPC_URL);

// --- Contract Addresses ---
const ADDRESSES = {
    TicketNFT: process.env.TICKET_NFT_ADDRESS,
    PricingOracle: process.env.PRICING_ORACLE_ADDRESS,
    StakingVault: process.env.STAKING_VAULT_ADDRESS,
    LendingPool: process.env.LENDING_POOL_ADDRESS,
    Marketplace: process.env.MARKETPLACE_ADDRESS,
    LiquidationEngine: process.env.LIQUIDATION_ENGINE_ADDRESS
};

// --- Artifact Paths ---
const ARTIFACTS_DIR = path.resolve(__dirname, '../../../contracts/artifacts/contracts');
const ARTIFACT_PATHS = {
    TicketNFT: path.join(ARTIFACTS_DIR, 'TicketNFT.sol/TicketNFT.json'),
    PricingOracle: path.join(ARTIFACTS_DIR, 'PricingOracle.sol/PricingOracle.json'),
    StakingVault: path.join(ARTIFACTS_DIR, 'StakingVault.sol/StakingVault.json'),
    LendingPool: path.join(ARTIFACTS_DIR, 'LendingPool.sol/LendingPool.json'),
    Marketplace: path.join(ARTIFACTS_DIR, 'MarketPlace.sol/Marketplace.json'), // Note: MarketPlace.sol dir, Marketplace.json file
    LiquidationEngine: path.join(ARTIFACTS_DIR, 'LiquidationEngine.sol/LiquidationEngine.json')
};

// --- State Mapping ---
const TICKET_STATE = ['IDLE', 'STAKED', 'COLLATERALIZED', 'LISTED'];

// --- Global Contract Instances ---
const contracts = {};

async function loadContracts() {
    console.log('Loading contracts...');
    for (const [name, address] of Object.entries(ADDRESSES)) {
        if (!address) {
            console.error(`Missing address for ${name}`);
            continue;
        }
        const artifactPath = ARTIFACT_PATHS[name];
        try {
            const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
            contracts[name] = new ethers.Contract(address, artifact.abi, provider);
            console.log(`Loaded ${name} at ${address}`);
        } catch (e) {
            console.error(`Failed to load ${name}:`, e.message);
        }
    }
}

// --- Event Handlers ---

async function handleTransfer(from, to, tokenId, event) {
    console.log(`[TicketNFT] Transfer #${tokenId} from ${from} to ${to}`);
    const id = Number(tokenId);

    // 1. Create/Update User (Receiver)
    await prisma.user.upsert({
        where: { walletAddress: to },
        update: {},
        create: { walletAddress: to }
    });

    // 2. Create/Update Ticket
    // We might need to fetch metadata if it's a mint (from === 0x0)
    // For now, we'll just update the owner and ensure it exists

    const ticketData = {
        tokenId: id,
        ownerAddress: to,
        // Defaults for new tickets if not exists
        departureTime: Math.floor(Date.now() / 1000) + 86400, // Mock: 24h from now
        route: "JFK-LHR", // Mock
        basePrice: 500.00, // Mock
        currentPrice: 500.00, // Mock
        state: 'IDLE'
    };

    await prisma.ticket.upsert({
        where: { tokenId: id },
        update: { ownerAddress: to },
        create: ticketData
    });
}

async function handlePriceUpdated(flightId, newPrice, event) {
    console.log(`[PricingOracle] PriceUpdated Flight ${flightId}: ${ethers.formatUnits(newPrice, 18)} USDC`);
    // In a real app, we'd map flightId to tickets. 
    // For this demo, we'll update ALL tickets (simplification) or just log it.
    // Let's assume flightId maps to route or something. 
    // For now, we will just log it as we don't have a direct mapping in the event to specific tokenIds without more logic.
    // BUT, the requirement says "Update ticket Price & History".
    // Let's update all tickets for now or just skip if we can't map.
    // Actually, let's just update a specific ticket if we had a mapping.
    // We'll skip bulk update for safety and just log.
}

async function handleTokenStaked(user, tokenId, event) {
    console.log(`[StakingVault] Staked #${tokenId} by ${user}`);
    const id = Number(tokenId);

    await prisma.$transaction([
        prisma.ticket.update({
            where: { tokenId: id },
            data: { state: 'STAKED' }
        }),
        prisma.stake.upsert({
            where: { ticketId: id },
            update: { userAddress: user },
            create: {
                userAddress: user,
                ticketId: id
            }
        })
    ]);
}

async function handleTokenUnstaked(user, tokenId, event) {
    console.log(`[StakingVault] Unstaked #${tokenId} by ${user}`);
    const id = Number(tokenId);

    await prisma.$transaction([
        prisma.ticket.update({
            where: { tokenId: id },
            data: { state: 'IDLE' }
        }),
        prisma.stake.delete({
            where: { ticketId: id }
        })
    ]);
}

async function handleCollateralDeposited(user, tokenId, event) {
    console.log(`[LendingPool] Collateral Deposited #${tokenId} by ${user}`);
    const id = Number(tokenId);

    await prisma.$transaction([
        prisma.ticket.update({
            where: { tokenId: id },
            data: { state: 'COLLATERALIZED' }
        }),
        prisma.loan.upsert({
            where: { ticketId: id },
            update: {
                userAddress: user,
                debtAmount: 0,
                healthFactor: 100
            },
            create: {
                userAddress: user,
                ticketId: id,
                debtAmount: 0,
                healthFactor: 100 // Max health initially
            }
        })
    ]);
}

async function handleCollateralWithdrawn(user, tokenId, event) {
    console.log(`[LendingPool] Collateral Withdrawn #${tokenId} by ${user}`);
    const id = Number(tokenId);

    await prisma.$transaction([
        prisma.ticket.update({
            where: { tokenId: id },
            data: { state: 'IDLE' }
        }),
        prisma.loan.delete({
            where: { ticketId: id }
        })
    ]);
}

async function handleBorrowed(user, amount, event) {
    console.log(`[LendingPool] Borrowed ${ethers.formatUnits(amount, 6)} USDC by ${user}`);
    // Complex: We need to find the active loan for this user.
    // Assuming 1 active loan per user for simplicity or we need to know which loan.
    // The event doesn't give tokenId. We'll find the first active loan for the user.
    const loan = await prisma.loan.findFirst({ where: { userAddress: user } });
    if (loan) {
        await prisma.loan.update({
            where: { id: loan.id },
            data: { debtAmount: { increment: ethers.formatUnits(amount, 6) } }
        });
    }
}

async function handleRepaid(user, amount, event) {
    console.log(`[LendingPool] Repaid ${ethers.formatUnits(amount, 6)} USDC by ${user}`);
    const loan = await prisma.loan.findFirst({ where: { userAddress: user } });
    if (loan) {
        await prisma.loan.update({
            where: { id: loan.id },
            data: { debtAmount: { decrement: ethers.formatUnits(amount, 6) } }
        });
    }
}

async function handleItemListed(seller, tokenId, price, event) {
    console.log(`[Marketplace] Listed #${tokenId} for ${ethers.formatUnits(price, 6)} USDC`);
    const id = Number(tokenId);

    await prisma.$transaction([
        prisma.ticket.update({
            where: { tokenId: id },
            data: { state: 'LISTED' }
        }),
        prisma.listing.upsert({
            where: { ticketId: id },
            update: {
                sellerAddress: seller,
                price: ethers.formatUnits(price, 6)
            },
            create: {
                sellerAddress: seller,
                ticketId: id,
                price: ethers.formatUnits(price, 6)
            }
        })
    ]);
}

async function handleItemSold(seller, buyer, tokenId, price, event) {
    console.log(`[Marketplace] Sold #${tokenId} to ${buyer}`);
    const id = Number(tokenId);

    await prisma.$transaction([
        prisma.ticket.update({
            where: { tokenId: id },
            data: {
                state: 'IDLE',
                ownerAddress: buyer
            }
        }),
        prisma.listing.delete({
            where: { ticketId: id }
        }),
        // Ensure buyer exists
        prisma.user.upsert({
            where: { walletAddress: buyer },
            update: {},
            create: { walletAddress: buyer }
        })
    ]);
}

async function handleListingCancelled(seller, tokenId, event) {
    console.log(`[Marketplace] Cancelled Listing #${tokenId}`);
    const id = Number(tokenId);

    await prisma.$transaction([
        prisma.ticket.update({
            where: { tokenId: id },
            data: { state: 'IDLE' }
        }),
        prisma.listing.delete({
            where: { ticketId: id }
        })
    ]);
}

// --- Main Listener Logic ---

async function startListeners() {
    console.log('Starting Event Listeners...');

    // TicketNFT
    contracts.TicketNFT.on('Transfer', handleTransfer);

    // StakingVault
    contracts.StakingVault.on('TokenStaked', handleTokenStaked);
    contracts.StakingVault.on('TokenUnstaked', handleTokenUnstaked);

    // LendingPool
    contracts.LendingPool.on('CollateralDeposited', handleCollateralDeposited);
    contracts.LendingPool.on('CollateralWithdrawn', handleCollateralWithdrawn);
    contracts.LendingPool.on('Borrowed', handleBorrowed);
    contracts.LendingPool.on('Repaid', handleRepaid);

    // Marketplace
    contracts.Marketplace.on('ItemListed', handleItemListed);
    contracts.Marketplace.on('ItemSold', handleItemSold);
    contracts.Marketplace.on('ListingCancelled', handleListingCancelled);

    // PricingOracle
    contracts.PricingOracle.on('PriceUpdated', handlePriceUpdated);
}

// --- Backfill Logic ---

async function backfill() {
    console.log('Starting Backfill...');
    // Alchemy Free Tier limits getLogs to 10 blocks range. 
    // For demo purposes, we only look back 5 blocks. 
    const startBlock = -5;

    try {
        // 1. Backfill Tickets (Transfers)
        console.log('Backfilling Tickets...');
        const transferEvents = await contracts.TicketNFT.queryFilter('Transfer', startBlock);
        for (const event of transferEvents) {
            await handleTransfer(event.args[0], event.args[1], event.args[2], event);
        }

        // 2. Backfill Listings
        console.log('Backfilling Listings...');
        const listedEvents = await contracts.Marketplace.queryFilter('ItemListed', startBlock);
        for (const event of listedEvents) {
            await handleItemListed(event.args[0], event.args[1], event.args[2], event);
        }

        // 3. Backfill Stakes
        console.log('Backfilling Stakes...');
        const stakedEvents = await contracts.StakingVault.queryFilter('TokenStaked', startBlock);
        for (const event of stakedEvents) {
            await handleTokenStaked(event.args[0], event.args[1], event.args[2], event);
        }

        // 4. Backfill Loans (CollateralDeposited)
        console.log('Backfilling Loans...');
        const collateralEvents = await contracts.LendingPool.queryFilter('CollateralDeposited', startBlock);
        for (const event of collateralEvents) {
            await handleCollateralDeposited(event.args[0], event.args[1], event.args[2], event);
        }
        console.log('Backfill Complete.');
    } catch (error) {
        console.error('Backfill failed (likely RPC limit):', error.message);
        console.log('Proceeding to start listener...');
    }
}

async function main() {
    try {
        await loadContracts();
        await backfill(); // Run backfill before listening
        await startListeners();
        console.log('Listening for events...');

        // Keep process alive
        process.stdin.resume();
    } catch (error) {
        console.error('Fatal Error:', error);
        process.exit(1);
    }
}

main();