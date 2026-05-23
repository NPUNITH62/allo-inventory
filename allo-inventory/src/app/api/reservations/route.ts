import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";
import { withIdempotency } from "@/lib/idempotency";

const RESERVATION_MINUTES = parseInt(process.env.RESERVATION_MINUTES ?? "10", 10);
const LOCK_TTL_MS = 5_000; // 5 seconds

/**
 * Acquires a Redis SET NX PX lock on a stock row.
 * Returns the lock token if acquired, null otherwise.
 */
async function acquireLock(key: string): Promise<string | null> {
  const token = `${Date.now()}-${Math.random()}`;
  const result = await redis.set(key, token, "PX", LOCK_TTL_MS, "NX");
  return result === "OK" ? token : null;
}

/**
 * Releases the lock only if we still own it (Lua script for atomicity).
 */
async function releaseLock(key: string, token: string): Promise<void> {
  const script = `
    if redis.call("GET", KEYS[1]) == ARGV[1] then
      return redis.call("DEL", KEYS[1])
    else
      return 0
    end
  `;
  await redis.eval(script, 1, key, token);
}

export async function POST(req: Request) {
  return withIdempotency(req, async () => {
    const body = await req.json().catch(() => null);
    const parsed = CreateReservationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parsed.data;

    // Distributed lock key scoped to the stock row
    const lockKey = `lock:stock:${productId}:${warehouseId}`;
    const token = await acquireLock(lockKey);

    if (!token) {
      return NextResponse.json(
        { error: "Another reservation is in progress for this item. Please try again." },
        { status: 503 }
      );
    }

    try {
      // Use a DB transaction to read-then-write atomically within the lock
      const reservation = await prisma.$transaction(async (tx) => {
        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId, warehouseId } },
        });

        if (!stock) {
          throw { status: 404, message: "Stock record not found for this product/warehouse" };
        }

        const available = stock.total - stock.reserved;
        if (available < quantity) {
          throw {
            status: 409,
            message: `Not enough stock. Requested ${quantity}, available ${available}.`,
          };
        }

        // Decrement available (increment reserved) and create reservation
        await tx.stock.update({
          where: { productId_warehouseId: { productId, warehouseId } },
          data: { reserved: { increment: quantity } },
        });

        const expiresAt = new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000);

        return tx.reservation.create({
          data: {
            productId,
            warehouseId,
            quantity,
            status: "PENDING",
            expiresAt,
          },
          include: {
            product: { select: { name: true } },
            warehouse: { select: { name: true } },
          },
        });
      });

      return NextResponse.json(reservation, { status: 201 });
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e.status === 409) {
        return NextResponse.json({ error: e.message }, { status: 409 });
      }
      if (e.status === 404) {
        return NextResponse.json({ error: e.message }, { status: 404 });
      }
      console.error("[POST /api/reservations]", err);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    } finally {
      await releaseLock(lockKey, token);
    }
  });
}
