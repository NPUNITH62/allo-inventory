import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  const reservation = await prisma.reservation.findUnique({ where: { id } });

  if (!reservation) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  if (reservation.status !== "PENDING") {
    // Idempotent: already released or confirmed
    return NextResponse.json(reservation, { status: 200 });
  }

  const [released] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id },
      data: { status: "RELEASED" },
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
      data: { reserved: { decrement: reservation.quantity } },
    }),
  ]);

  return NextResponse.json(released, { status: 200 });
}
