import express from 'express';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// Helper to serialize BigInt/Decimal
const jsonHandler = (data) => {
    return JSON.parse(JSON.stringify(data, (key, value) =>
        typeof value === 'bigint'
            ? value.toString()
            : value
    ));
};

// --- Public Endpoints ---

// GET /api/market/listings
router.get('/market/listings', async (req, res) => {
    try {
        const listings = await prisma.listing.findMany({
            include: {
                ticket: true,
                seller: true
            }
        });
        res.json(jsonHandler(listings));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/ticket/:id/history
router.get('/ticket/:id/history', async (req, res) => {
    const { id } = req.params;
    try {
        const history = await prisma.priceUpdate.findMany({
            where: { ticketId: Number(id) },
            orderBy: { timestamp: 'desc' }
        });
        res.json(jsonHandler(history));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- User Endpoints ---

// GET /api/portfolio/:address
router.get('/portfolio/:address', async (req, res) => {
    const { address } = req.params;
    try {
        const user = await prisma.user.findUnique({
            where: { walletAddress: address },
            include: {
                tickets: {
                    include: {
                        activeLoan: true,
                        activeStake: true,
                        activeListing: true
                    }
                },
                loans: {
                    include: { ticket: true }
                },
                stakes: {
                    include: { ticket: true }
                },
                listings: {
                    include: { ticket: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(jsonHandler(user));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- Auth & Gatekeeper ---

// POST /api/auth/login
router.post('/auth/login', async (req, res) => {
    const { walletAddress, email } = req.body;
    if (!walletAddress) return res.status(400).json({ error: 'Wallet address required' });

    try {
        const user = await prisma.user.upsert({
            where: { walletAddress },
            update: { email }, // Update email if provided
            create: { walletAddress, email }
        });
        res.json(jsonHandler(user));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/mint/verify (Gatekeeper)
router.post('/mint/verify', async (req, res) => {
    const { pnr } = req.body;
    if (!pnr) return res.status(400).json({ error: 'PNR required' });

    console.log(`Verifying PNR: ${pnr}`);

    // Mock Logic:
    // If PNR starts with "VALID", return success.
    // Else return fail.

    const isValid = pnr.toUpperCase().startsWith('VALID');

    if (isValid) {
        // In a real app, we'd sign a message with our private key here
        // to allow the user to mint on-chain.
        const mockSignature = "0xMOCK_SIGNATURE_FOR_" + pnr;

        // Return flight data
        res.json({
            valid: true,
            flightData: {
                departureTime: Math.floor(Date.now() / 1000) + 86400,
                route: "JFK-LHR",
                basePrice: "500.00"
            },
            signature: mockSignature
        });
    } else {
        res.status(400).json({ valid: false, error: 'Invalid PNR' });
    }
});

export default router;
