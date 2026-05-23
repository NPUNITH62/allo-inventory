import { prisma } from "./prisma";

/**
 * Releases all expired PENDING reservations and restores their stock.
 * Called by the Vercel Cron job and also lazily on reads.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();

  // Find expired pending reservations
  const expired = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
    },
  });

  if (expired.length === 0) return 0;

  // Process in a transaction: update status + restore stock atomically
  await prisma.$transaction(
    expired.map((r) =>
      prisma.$transaction([
        prisma.reservation.update({
          where: { id: r.id },
          data: { status: "RELEASED" },
        }),
        prisma.stock.update({
          where: {
            productId_warehouseId: {
              productId: r.productId,
              warehouseId: r.warehouseId,
            },
          },
          data: { reserved: { decrement: r.quantity } },
        }),
      ])
    )
  );

  console.log(`[expiry] Released ${expired.length} expired reservation(s)`);
  return expired.length;
}
