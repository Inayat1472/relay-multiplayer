import { createRoom, respond } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return respond(() => createRoom(request)); }
