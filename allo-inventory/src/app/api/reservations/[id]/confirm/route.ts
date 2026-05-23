import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withIdempotency } from "@/lib/idempotency";

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  return withIdempotency(req, async () => {
    const { id } = params;

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
    }

    if (reservation.status === "CONFIRMED") {
      return NextResponse.json(reservation, { status: 200 });
    }

    if (reservation.status === "RELEASED") {
      return NextResponse.json(
        { error: "Reservation has already been released" },
        { status: 410 }
      );
    }

    // Check expiry
    if (reservation.expiresAt < new Date()) {
      // Lazily release the reservation
      await prisma.$transaction([
        prisma.reservation.update({
          where: { id },
          data: { status: "RELEASED" },
        }),
        prisma.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: { reserved: { decrement: reservation.quantity } },
        }),
      ]);

      return NextResponse.json(
        { error: "Reservation has expired" },
        { status: 410 }
      );
    }

    // Confirm: decrement total stock (the hold becomes a real sale)
    const [confirmed] = await prisma.$transaction([
      prisma.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: {
          product: { select: { name: true } },
          warehouse: { select: { name: true } },
        },
      }),
      prisma.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          total: { decrement: reservation.quantity },
          reserved: { decrement: reservation.quantity },
        },
      }),
    ]);

    return NextResponse.json(confirmed, { status: 200 });
  });
}
