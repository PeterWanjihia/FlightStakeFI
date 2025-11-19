import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const userCount = await prisma.user.count();
    const ticketCount = await prisma.ticket.count();
    const listingCount = await prisma.listing.count();

    console.log(`Users: ${userCount}`);
    console.log(`Tickets: ${ticketCount}`);
    console.log(`Listings: ${listingCount}`);

    const tickets = await prisma.ticket.findMany({ take: 5 });
    console.log('Sample Tickets:', tickets);
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
