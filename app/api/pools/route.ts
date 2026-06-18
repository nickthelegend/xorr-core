import { NextResponse } from "next/server";
import type { Db } from "mongodb";
import { getDb } from "@/lib/mongodb";

/** Fetch all pool documents from the given DB. Exported so it can be unit-tested. */
export async function getPoolsFromDb(db: Db) {
  return db.collection("pools").find({}).toArray();
}

export async function GET() {
  try {
    const db = await getDb();
    const pools = await getPoolsFromDb(db);
    return NextResponse.json(pools);
  } catch (err) {
    console.error("[GET /api/pools] DB error:", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
