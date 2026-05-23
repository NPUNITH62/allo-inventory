import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { releaseExpiredReservations } from "@/lib/expiry";

export async function GET() {
  // Lazy cleanup: release expired reservations so available stock is accurate
  await releaseExpiredReservations();

  const products = await prisma.product.findMany({
    include: {
      stocks: {
        include: { warehouse: true },
      },
    },
    orderBy: { name: "asc" },
  });

  const response = products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    warehouses: p.stocks.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      total: s.total,
      reserved: s.reserved,
      available: s.total - s.reserved,
    })),
  }));

  return NextResponse.json(response);
}
