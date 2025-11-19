import { ethers } from 'ethers';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
const RPC_URL = process.env.SEPOLIA_RPC_URL;
const PRIVATE_KEY = process.env.SEPOLIA_PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ Missing SEPOLIA_PRIVATE_KEY in .env");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

// --- Contract Addresses ---
const ADDRESSES = {
    TicketNFT: process.env.TICKET_NFT_ADDRESS,
    Marketplace: process.env.MARKETPLACE_ADDRESS
};

// --- Artifact Paths ---
const ARTIFACTS_DIR = path.resolve(__dirname, '../../contracts/artifacts/contracts');
const ARTIFACT_PATHS = {
    TicketNFT: path.join(ARTIFACTS_DIR, 'TicketNFT.sol/TicketNFT.json'),
    Marketplace: path.join(ARTIFACTS_DIR, 'MarketPlace.sol/Marketplace.json')
};

// --- Load Contracts ---
const contracts = {};
for (const [name, address] of Object.entries(ADDRESSES)) {
    const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATHS[name], 'utf8'));
    contracts[name] = new ethers.Contract(address, artifact.abi, wallet);
}

async function main() {
    console.log("🚀 Starting Deep System Check...");
    console.log(`🔑 Wallet: ${wallet.address}`);

    // 1. DB Health Check
    try {
        const userCount = await prisma.user.count();
        console.log(`✅ Database is connected. User count: ${userCount}`);
    } catch (e) {
        console.error("❌ Database connection failed:", e);
        process.exit(1);
    }

    // 2. Determine Target Token
    let tokenId;
    let needsMinting = false;

    // Check if we are minter
    const minter = await contracts.TicketNFT.getMinter();
    console.log(`ℹ️  Contract Minter: ${minter}`);

    if (minter.toLowerCase() === wallet.address.toLowerCase()) {
        console.log("✅ We are the minter.");
        needsMinting = true;
    } else {
        console.log("⚠️ We are NOT the minter. Checking for existing tokens...");
        // Check DB for tokens we own
        const myTicket = await prisma.ticket.findFirst({
            where: { ownerAddress: wallet.address }
        });

        if (myTicket) {
            tokenId = myTicket.tokenId;
            console.log(`✅ Found existing token #${tokenId} in DB.`);
        } else {
            console.error("❌ No tokens found and cannot mint. Please transfer a token to this wallet manually.");
            process.exit(1);
        }
    }

    if (needsMinting) {
        tokenId = Math.floor(Math.random() * 1000000) + 1000; // Random ID > 1000
        console.log(`🛠  Minting new Token #${tokenId}...`);

        const flightDetails = {
            routeHash: "JFK-LHR",
            departureTimestamp: Math.floor(Date.now() / 1000) + 86400,
            fareTierIdentifier: ethers.ZeroHash
        };

        try {
            const tx = await contracts.TicketNFT.mint(
                wallet.address,
                tokenId,
                flightDetails,
                "ipfs://mock-uri"
            );
            console.log(`⏳ Mint Tx sent: ${tx.hash}. Waiting for confirmation...`);
            await tx.wait();
            console.log("✅ Mint Confirmed.");

            console.log("⏳ Waiting 15s for Listener to sync Mint...");
            await new Promise(r => setTimeout(r, 15000));
        } catch (e) {
            console.error("❌ Mint failed:", e);
            process.exit(1);
        }
    }

    // 3. Pre-Flight Snapshot
    console.log(`📸 Taking Pre-Flight Snapshot for Token #${tokenId}...`);
    let ticket = await prisma.ticket.findUnique({ where: { tokenId: tokenId } });

    if (!ticket) {
        console.error("❌ Ticket not found in DB after mint/wait. Listener might be broken.");
        process.exit(1);
    }

    console.log(`   State: ${ticket.state} | Owner: ${ticket.ownerAddress}`);

    // Ensure IDLE state
    if (ticket.state === 'LISTED') {
        console.log("⚠️ Token is LISTED. Cancelling listing to reset state...");
        const tx = await contracts.Marketplace.cancelListing(tokenId);
        await tx.wait();
        console.log("✅ Listing Cancelled. Waiting 15s...");
        await new Promise(r => setTimeout(r, 15000));
        ticket = await prisma.ticket.findUnique({ where: { tokenId: tokenId } });
        console.log(`   New State: ${ticket.state}`);
    }

    if (ticket.state !== 'IDLE') {
        console.error(`❌ Token state is ${ticket.state}, expected IDLE. Cannot proceed.`);
        process.exit(1);
    }

    // 4. The "Live Fire" - List Item
    console.log("🔥 Triggering 'ItemListed' Event on-chain...");

    // Approve
    const approved = await contracts.TicketNFT.getApproved(tokenId);
    if (approved !== contracts.Marketplace.target) {
        console.log("   Approving Marketplace...");
        const txApprove = await contracts.TicketNFT.approve(contracts.Marketplace.target, tokenId);
        await txApprove.wait();
        console.log("   Approved.");
    }

    // List
    const price = ethers.parseUnits("100", 6); // 100 USDC
    console.log(`   Listing Token #${tokenId} for 100 USDC...`);
    const txList = await contracts.Marketplace.listItem(tokenId, price);
    console.log(`⏳ List Tx sent: ${txList.hash}. Waiting for confirmation...`);
    await txList.wait();
    console.log("✅ List Confirmed.");

    // 5. Wait & Watch
    console.log("⏳ Waiting 15s for Event Listener to sync...");
    await new Promise(r => setTimeout(r, 15000));

    // 6. Post-Flight Verification
    console.log("🔎 Verifying Database State...");
    const updatedTicket = await prisma.ticket.findUnique({
        where: { tokenId: tokenId },
        include: { activeListing: true }
    });

    if (updatedTicket.state === 'LISTED') {
        console.log("✅ POST-STATE: Token State is LISTED.");
    } else {
        console.error(`❌ POST-STATE: Token State is ${updatedTicket.state} (Expected LISTED). Sync Failed.`);
        process.exit(1);
    }

    if (updatedTicket.activeListing) {
        console.log("✅ POST-STATE: Listing record found.");
        console.log(`   Price: ${updatedTicket.activeListing.price}`);
        if (Number(updatedTicket.activeListing.price) === 100) {
            console.log("✅ Data Integrity: Price matches (100).");
        } else {
            console.error(`❌ Data Integrity: Price mismatch. Expected 100, got ${updatedTicket.activeListing.price}`);
        }
    } else {
        console.error("❌ POST-STATE: No Listing record found. Sync Failed.");
        process.exit(1);
    }

    console.log("🎉 SYSTEM CHECK PASSED: Backend is mirroring blockchain correctly.");
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
