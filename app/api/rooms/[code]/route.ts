import { readRoom, actOnRoom, respond } from "@/lib/server";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ code: string }> };
export async function GET(request: Request, context: Context) { const { code } = await context.params; return respond(() => readRoom(request, code)); }
export async function POST(request: Request, context: Context) { const { code } = await context.params; return respond(() => actOnRoom(request, code)); }
