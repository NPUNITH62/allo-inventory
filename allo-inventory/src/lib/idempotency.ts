import { prisma } from "./prisma";
import { NextResponse } from "next/server";

/**
 * Checks for a stored idempotency result. If found, returns an early Response.
 * If not found, calls `handler`, stores the result, then returns the Response.
 *
 * Usage:
 *   return withIdempotency(req, () => yourHandler());
 */
export async function withIdempotency(
  req: Request,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  const key = req.headers.get("Idempotency-Key");

  if (!key) {
    // No key provided — just run the handler without idempotency guarantees.
    return handler();
  }

  // Look up existing result
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
  if (existing) {
    return NextResponse.json(existing.responseBody, { status: existing.statusCode });
  }

  // Run the real handler
  const response = await handler();

  // Store result (best-effort; a concurrent duplicate may also try to insert)
  try {
    const body = await response.clone().json();
    await prisma.idempotencyKey.create({
      data: {
        key,
        responseBody: body,
        statusCode: response.status,
      },
    });
  } catch {
    // If a concurrent request already stored the key (unique constraint), ignore.
  }

  return response;
}
