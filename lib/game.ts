export type Role = 0 | 1;
export type Tile = { mask: number; owner: Role; beacon: number | null };
export type Board = { size: number; tiles: Tile[] };
export type Phase = "lobby" | "playing" | "between" | "complete";
export type RoundResult = { moves: [number, number]; seconds: number; hints: number };
export type Game = {
  seed: number; match: number; level: number; phase: Phase; board: Board; solution: number[];
  ready: [boolean, boolean]; moves: [number, number]; startedAt: number; solvedAt: number | null;
  results: RoundResult[]; hints: number;
  hint: { index: number; mask: number; until: number } | null;
  ping: { index: number; from: Role; until: number } | null;
  message: { text: string; from: Role; at: number } | null;
  recentActions: string[];
};
export type PublicGame = Omit<Game, "seed" | "solution" | "recentActions">;
export type RoomView = { code: string; role: Role; revision: number; game: PublicGame;
  players: [{ name: string; seen: number }, { name: string; seen: number } | null]; serverTime: number; expiresAt: number };
export type Action = { type: "rotate"; index: number } | { type: "ping"; index: number } |
  { type: "ready" } | { type: "hint" } | { type: "message"; text: string };
export const SECTORS = [
  { name: "First contact", subtitle: "Find your rhythm.", size: 4 },
  { name: "Common frequency", subtitle: "Every connection counts.", size: 5 },
  { name: "In resonance", subtitle: "Bring it home, together.", size: 6 },
] as const;
export const MESSAGES = ["Follow the signal", "Working on it", "Try my ping", "Nicely done!"] as const;
export const DIRECTIONS = [1, 2, 4, 8] as const;
export const ROLE_NAMES = ["Pulse", "Echo"] as const;
export function rotate(mask: number, turns = 1): number {
  let result = mask;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) result = ((result << 1) & 15) | (result >> 3);
  return result;
}
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function neighbour(index: number, direction: number, size: number): number {
  const x = index % size, y = Math.floor(index / size);
  if (direction === 0) return y > 0 ? index - size : -1;
  if (direction === 1) return x < size - 1 ? index + 1 : -1;
  if (direction === 2) return y < size - 1 ? index + size : -1;
  return x > 0 ? index - 1 : -1;
}
export function connectivity(board: Board) {
  const { tiles, size } = board; const powered = new Set<number>();
  if (tiles[0].mask & 8) {
    powered.add(0); const queue = [0];
    for (let q = 0; q < queue.length; q++) {
      const i = queue[q];
      for (let d = 0; d < 4; d++) {
        const next = neighbour(i, d, size);
        if (next >= 0 && !powered.has(next) && (tiles[i].mask & DIRECTIONS[d]) && (tiles[next].mask & DIRECTIONS[(d + 2) % 4])) {
          powered.add(next); queue.push(next);
        }
      }
    }
  }
  const beacons = tiles.map((t, i) => ({ id: t.beacon, index: i, lit: powered.has(i) }))
    .filter(t => t.id !== null).sort((a, b) => a.id! - b.id!);
  const output = powered.has(tiles.length - 1) && !!(tiles[tiles.length - 1].mask & 2);
  return { powered, beacons, output, solved: output && beacons.every(b => b.lit) };
}
/** A spanning tree supplies a proof of solvability; the reference solution stays server-side. */
export function makePuzzle(seed: number, size: number): { board: Board; solution: number[] } {
  const random = rng(seed), total = size * size, solution = Array<number>(total).fill(0);
  const depth = Array<number>(total).fill(0), parent = Array<number>(total).fill(-1), visited = new Set([0]), stack = [0];
  while (stack.length) {
    const current = stack[stack.length - 1];
    const options = [0, 1, 2, 3].map(d => ({ d, n: neighbour(current, d, size) })).filter(o => o.n >= 0 && !visited.has(o.n));
    if (!options.length) { stack.pop(); continue; }
    const { d, n } = options[Math.floor(random() * options.length)];
    solution[current] |= DIRECTIONS[d]; solution[n] |= DIRECTIONS[(d + 2) % 4];
    visited.add(n); parent[n] = current; depth[n] = depth[current] + 1; stack.push(n);
  }
  solution[0] |= 8; solution[total - 1] |= 2;
  const onRoute = new Set<number>();
  const addPath = (index: number) => { for (let i = index; i >= 0 && !onRoute.has(i); i = parent[i]) onRoute.add(i); };
  addPath(total - 1); const selected: number[] = [], count = size <= 4 ? 2 : 3;
  for (let b = 0; b < count; b++) {
    let best = -1, bestValue = -Infinity;
    for (let i = 1; i < total - 1; i++) {
      if (selected.includes(i)) continue;
      let extension = 0;
      for (let p = i; p >= 0 && !onRoute.has(p); p = parent[p]) extension++;
      const separation = selected.length ? Math.min(...selected.map(j => Math.abs(i % size - j % size) + Math.abs(Math.floor(i / size) - Math.floor(j / size)))) : size;
      const score = extension * 10 + separation * 2 + depth[i] / total + random() * .2;
      if (score > bestValue) { bestValue = score; best = i; }
    }
    selected.push(best); addPath(best);
  }
  const tiles: Tile[] = solution.map((mask, i) => ({ mask: rotate(mask, Math.floor(random() * 4)),
    owner: ((i % size + Math.floor(i / size)) % 2) as Role, beacon: selected.includes(i) ? selected.indexOf(i) + 1 : null }));
  for (const role of [0, 1]) {
    const candidates = [...onRoute].filter(i => tiles[i].owner === role && solution[i] !== 15);
    const index = candidates.find(i => tiles[i].mask !== solution[i]) ?? candidates[0];
    if (index !== undefined) tiles[index].mask = rotate(solution[index], 1);
  }
  const board = { size, tiles };
  if (connectivity(board).solved) tiles[0].mask = rotate(solution[0], 1);
  return { board, solution };
}
export function newGame(seed: number): Game {
  return { seed, match: 0, level: 0, phase: "lobby", ...makePuzzle(seed, 4), ready: [false, false], moves: [0, 0],
    startedAt: 0, solvedAt: null, results: [], hints: 0, hint: null, ping: null, message: null, recentActions: [] };
}
export function roundKey(game: Pick<Game, "match" | "level">) { return `${game.match}:${game.level}`; }
export function publicGame(game: Game): PublicGame {
  const { seed: _seed, solution: _solution, recentActions: _ids, ...visible } = game; return visible;
}
export function applyAction(game: Game, role: Role, action: Action, now: number, hasPartner: boolean): Game {
  if (action.type === "ready") {
    if (game.phase === "playing") throw new Error("This round is already in progress.");
    if (!hasPartner) throw new Error("Your partner needs to join first.");
    game.ready[role] = true;
    if (game.ready.every(Boolean)) {
      if (game.phase === "complete") {
        const match = game.match + 1;
        Object.assign(game, newGame((game.seed + 0x9E3779B9) >>> 0), { match });
      } else if (game.phase === "between") {
        game.level++; Object.assign(game, makePuzzle((game.seed + game.level * 0x9E3779B9) >>> 0, SECTORS[game.level].size));
      }
      game.phase = "playing"; game.ready = [false, false]; game.startedAt = now;
      game.solvedAt = null; game.moves = [0, 0]; game.hints = 0; game.hint = null; game.ping = null; game.message = null;
    }
    return game;
  }
  if (game.phase !== "playing") throw new Error("Wait for both players to start the round.");
  if (action.type === "rotate" || action.type === "ping") {
    if (!Number.isInteger(action.index) || action.index < 0 || action.index >= game.board.tiles.length) throw new Error("Choose a tile on the board.");
    const tile = game.board.tiles[action.index];
    if (action.type === "ping") { game.ping = { index: action.index, from: role, until: now + 6000 }; return game; }
    if (tile.owner !== role) throw new Error("That tile belongs to your partner. Tap it to send a ping.");
    tile.mask = rotate(tile.mask); game.moves[role]++;
    if (game.hint?.index === action.index && tile.mask === game.hint.mask) game.hint = null;
    if (connectivity(game.board).solved) {
      game.solvedAt = now;
      game.results.push({ moves: [...game.moves], seconds: Math.max(1, Math.round((now - game.startedAt) / 1000)), hints: game.hints });
      game.phase = game.level === SECTORS.length - 1 ? "complete" : "between";
      game.ready = [false, false]; game.hint = null; game.ping = null;
    }
  } else if (action.type === "hint") {
    if (game.hint && game.hint.until > now) return game;
    const powered = connectivity(game.board).powered;
    const mismatched = game.board.tiles.map((t, i) => ({ i, wrong: t.mask !== game.solution[i] })).filter(t => t.wrong);
    const candidate = mismatched.find(t => t.i === 0 || [0, 1, 2, 3].some(d => powered.has(neighbour(t.i, d, game.board.size)))) ?? mismatched[0];
    if (candidate) { game.hint = { index: candidate.i, mask: game.solution[candidate.i], until: now + 18000 }; game.hints++; }
  } else if (action.type === "message") {
    if (!(MESSAGES as readonly string[]).includes(action.text)) throw new Error("Choose one of the quick signals.");
    game.message = { text: action.text, from: role, at: now };
  } else throw new Error("Unknown action.");
  return game;
}
export function coordinates(index: number, size: number) { return `${String.fromCharCode(65 + index % size)}${Math.floor(index / size) + 1}`; }
export function maskWords(mask: number) { return ["north", "east", "south", "west"].filter((_, d) => mask & DIRECTIONS[d]).join(", "); }
