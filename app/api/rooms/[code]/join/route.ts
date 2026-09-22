import { joinRoom, respond } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function POST(request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params; return respond(() => joinRoom(request, code));
}
