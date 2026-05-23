import { NextResponse } from "next/server";
import { releaseExpiredReservations } from "@/lib/expiry";

// Vercel Cron: runs every minute — see vercel.json
export async function GET(req: Request) {
  // Protect the endpoint with a shared secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const released = await releaseExpiredReservations();
  return NextResponse.json({ released });
}
