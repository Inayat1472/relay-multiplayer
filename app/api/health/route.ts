import { database } from "@/db";
import { respond } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() { return respond(async () => { await database().prepare("SELECT 1 AS healthy").first(); return { status: "ok", game: "Relay", protocol: 1 }; }); }
