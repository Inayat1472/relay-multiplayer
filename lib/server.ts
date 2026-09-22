import { database } from "@/db";
import { applyAction, newGame, publicGame, type Action, type Game, type Role, type RoomView, roundKey } from "./game";
type RoomRow = { code: string; state: string; revision: number; pulse_hash: string; echo_hash: string | null;
  pulse_name: string; echo_name: string | null; pulse_seen: number; echo_seen: number | null; expires_at: number };
class Problem extends Error { constructor(message: string, public status = 400) { super(message); } }
const NO_CACHE = { "Cache-Control": "no-store, private", "Vary": "Authorization", "X-Content-Type-Options": "nosniff" };
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;
export async function hash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
}
function randomToken() { return Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, "0")).join(""); }
function randomCode() { return Array.from(crypto.getRandomValues(new Uint8Array(6)), x => ALPHABET[x % ALPHABET.length]).join(""); }
function cleanName(input: unknown) {
  if (typeof input !== "string") throw new Problem("Enter your name to join.");
  const name = input.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "").trim().replace(/\s+/g, " ");
  if (!name || [...name].length > 20) throw new Problem("Use a name between 1 and 20 characters.");
  return name;
}
function validCode(input: string) {
  const code = input.trim().toUpperCase();
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new Problem("Enter the six-character room code.");
  return code;
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Problem("Open Relay directly to play.", 403);
  if (!request.headers.get("content-type")?.includes("application/json")) throw new Problem("Use a JSON request.", 415);
  if (Number(request.headers.get("content-length") ?? 0) > 4096) throw new Problem("Request is too large.", 413);
  const raw = await request.text();
  if (raw.length > 4096) throw new Problem("Request is too large.", 413);
  try { const data = JSON.parse(raw); if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(); return data; }
  catch { throw new Problem("The request could not be read. Try again."); }
}
async function limit(key: string, maximum: number) {
  const now = Date.now(), expires = now + 60000;
  const row = await database().prepare(`INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)
    ON CONFLICT(key) DO UPDATE SET count = CASE WHEN expires_at <= ? THEN 1 ELSE count + 1 END,
    expires_at = CASE WHEN expires_at <= ? THEN ? ELSE expires_at END RETURNING count`).bind(key, expires, now, now, expires).first<{ count: number }>();
  if (row && row.count > maximum) throw new Problem("A few too many requests. Wait a minute and try again.", 429);
}
async function getRow(code: string): Promise<RoomRow> {
  const row = await database().prepare("SELECT * FROM rooms WHERE code = ? AND expires_at > ?").bind(validCode(code), Date.now()).first<RoomRow>();
  if (!row) throw new Problem("That room was not found or has expired. Check the code, or create a new room.", 404);
  return row;
}
async function authenticate(request: Request, row: RoomRow): Promise<Role> {
  const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Problem("Join this room to play.", 401);
  const digest = await hash(token);
  if (digest === row.pulse_hash) return 0;
  if (digest === row.echo_hash) return 1;
  throw new Problem("Your seat could not be restored. Rejoin from the start screen.", 401);
}
function view(row: RoomRow, role: Role): RoomView {
  return { code: row.code, role, revision: row.revision, game: publicGame(JSON.parse(row.state)),
    players: [{ name: row.pulse_name, seen: row.pulse_seen }, row.echo_name ? { name: row.echo_name, seen: row.echo_seen ?? 0 } : null],
    serverTime: Date.now(), expiresAt: row.expires_at };
}
export async function respond(work: () => Promise<unknown>) {
  try { return Response.json(await work(), { headers: NO_CACHE }); }
  catch (error) {
    if (error instanceof Problem) return Response.json({ error: error.message }, { status: error.status, headers: NO_CACHE });
    console.error("Relay request failed", error);
    return Response.json({ error: "Relay could not reach the room right now. Your progress is saved; please try again." }, { status: 503, headers: NO_CACHE });
  }
}
export async function createRoom(request: Request) {
  const body = await readBody(request), name = cleanName(body.name);
  const ip = request.headers.get("cf-connecting-ip") ?? "preview";
  await limit("create:" + await hash(ip), 20);
  const now = Date.now(), token = randomToken(), digest = await hash(token);
  const state = JSON.stringify(newGame(crypto.getRandomValues(new Uint32Array(1))[0]));
  await database().batch([database().prepare("DELETE FROM rooms WHERE expires_at <= ?").bind(now), database().prepare("DELETE FROM rate_limits WHERE expires_at <= ?").bind(now)]);
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const inserted = await database().prepare(`INSERT OR IGNORE INTO rooms
      (code, state, revision, pulse_hash, pulse_name, pulse_seen, expires_at) VALUES (?, ?, 0, ?, ?, ?, ?)`).bind(code, state, digest, name, now, now + EXPIRE_MS).run();
    if (inserted.meta.changes) return { token, room: view(await getRow(code), 0) };
  }
  throw new Problem("We could not create a room. Please try again.", 503);
}
export async function joinRoom(request: Request, codeInput: string) {
  const code = validCode(codeInput), body = await readBody(request), name = cleanName(body.name);
  await limit("join:" + await hash(request.headers.get("cf-connecting-ip") ?? "preview"), 60);
  const row = await getRow(code);
  if (row.echo_hash) throw new Problem("This room already has two players. Restore your saved seat, or create a new room.", 409);
  const token = randomToken(), digest = await hash(token), now = Date.now();
  const joined = await database().prepare(`UPDATE rooms SET echo_hash = ?, echo_name = ?, echo_seen = ?, revision = revision + 1
    WHERE code = ? AND echo_hash IS NULL AND expires_at > ?`).bind(digest, name, now, code, now).run();
  if (!joined.meta.changes) throw new Problem("Someone just took the second seat. Create a new room to play.", 409);
  return { token, room: view(await getRow(code), 1) };
}
export async function readRoom(request: Request, code: string) {
  const row = await getRow(code), role = await authenticate(request, row), now = Date.now();
  const field = role === 0 ? "pulse_seen" : "echo_seen";
  if (now - (row[field] ?? 0) > 5000) {
    await database().prepare(role === 0 ? "UPDATE rooms SET pulse_seen = ? WHERE code = ?" : "UPDATE rooms SET echo_seen = ? WHERE code = ?").bind(now, row.code).run();
    row[field] = now;
  }
  return { room: view(row, role) };
}
export async function actOnRoom(request: Request, code: string) {
  const body = await readBody(request), initial = await getRow(code), role = await authenticate(request, initial);
  if (typeof body.id !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(body.id)) throw new Problem("This action is missing its identifier.");
  if (typeof body.round !== "string" || !body.action || typeof body.action !== "object") throw new Problem("This action could not be read.");
  await limit(`act:${code}:${role}`, 240);
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = attempt === 0 ? initial : await getRow(code), game: Game = JSON.parse(row.state);
    if (game.recentActions.includes(body.id)) return { room: view(row, role) };
    if (body.round !== roundKey(game)) throw new Problem("The next round has started. Your board is refreshing.", 409);
    try { applyAction(game, role, body.action as Action, Date.now(), !!row.echo_hash); }
    catch (error) { throw new Problem(error instanceof Error ? error.message : "That move is unavailable.", 409); }
    game.recentActions = [...game.recentActions.slice(-63), body.id];
    const updated = await database().prepare(`UPDATE rooms SET state = ?, revision = revision + 1
      WHERE code = ? AND revision = ? AND expires_at > ?`).bind(JSON.stringify(game), code, row.revision, Date.now()).run();
    if (updated.meta.changes) return { room: view(await getRow(code), role) };
  }
  throw new Problem("Both players moved at once. Please try your move again.", 409);
}
