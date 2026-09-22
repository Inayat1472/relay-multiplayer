"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { ArrowRight, ArrowUpRight, Check, CheckCheck, CircleHelp, Copy, Lightbulb, Link2, Loader2, Radio, RotateCw, Sparkles, Users, Volume2, VolumeX, WifiOff, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Toaster, toast } from "sonner";
import { connectivity, coordinates, DIRECTIONS, makePuzzle, maskWords, MESSAGES, newGame, publicGame, ROLE_NAMES, rotate, roundKey, SECTORS, type Action, type Board, type Game, type PublicGame, type Role, type RoomView } from "@/lib/game";

type Seat = { code: string; token: string };
type SavedSeat = Seat & { name: string };
const DEMO = makePuzzle(1489, 5);
// A recognisable live circuit on the game-native start screen, not a fake room.
const DEMO_BOARD: Board = { size: 5, tiles: DEMO.board.tiles.map((t, i) => ({ ...t, mask: i < 16 ? DEMO.solution[i] : t.mask })) };
function fromStorage<T>(kind: "localStorage" | "sessionStorage", key: string): T | null {
  try { return JSON.parse(window[kind].getItem(key) ?? "null"); } catch { return null; }
}
function saveStorage(kind: "localStorage" | "sessionStorage", key: string, value: unknown) {
  try { window[kind].setItem(key, JSON.stringify(value)); } catch { /* Play remains available without browser storage. */ }
}
async function api(path: string, method = "GET", body?: unknown, token?: string) {
  let response: Response;
  try { response = await fetch(path, { method, cache: "no-store", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(10000) }); }
  catch { throw new Error("Connection interrupted. Your last saved board is safe. Please try again."); }
  const data = await response.json().catch(() => ({})) as { error?: string; room: RoomView; token: string };
  if (!response.ok) throw new Error(data.error ?? "Relay is taking a moment. Please try again.");
  return data;
}
function timeText(seconds: number) { const s = Math.max(0, Math.floor(seconds)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; }
function Glyph({ role, className = "" }: { role: number; className?: string }) { return <span aria-hidden="true" className={`role-glyph ${role === 0 ? "pulse" : "echo"} ${className}`}>{role === 0 ? "▲" : "●"}</span>; }
function Wire({ mask, ghost = false }: { mask: number; ghost?: boolean }) {
  const ends = [[50, 0], [100, 50], [50, 100], [0, 50]];
  return <svg className={`wire ${ghost ? "ghost-wire" : ""}`} viewBox="0 0 100 100" aria-hidden="true">
    {ends.map(([x, y], d) => (mask & DIRECTIONS[d]) ? <path key={d} d={`M50 50 L${x} ${y}`} /> : null)}
    <circle className="wire-core" cx="50" cy="50" r="5" />
  </svg>;
}
function CircuitBoard({ board, role = null, interactive = false, busy = false, game, now = 0, onTile, label = "Signal circuit" }: {
  board: Board; role?: Role | null; interactive?: boolean; busy?: boolean; game?: PublicGame; now?: number; onTile?: (i: number) => void; label?: string;
}) {
  const connection = useMemo(() => connectivity(board), [board]);
  const [focus, setFocus] = useState(0), container = useRef<HTMLDivElement>(null);
  const moveFocus = (event: KeyboardEvent, i: number) => {
    let next = i;
    if (event.key === "ArrowRight") next = Math.min(i + 1, board.tiles.length - 1);
    else if (event.key === "ArrowLeft") next = Math.max(0, i - 1);
    else if (event.key === "ArrowDown") next = Math.min(board.tiles.length - 1, i + board.size);
    else if (event.key === "ArrowUp") next = Math.max(0, i - board.size);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = board.tiles.length - 1;
    else return;
    event.preventDefault(); setFocus(next); container.current?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
  };
  return <div className={`board-frame ${interactive ? "is-interactive" : "is-display"}`} style={{ "--n": board.size } as CSSProperties}>
    <div className="board-coordinates">{Array.from({ length: board.size }, (_, i) => <span key={i}>{String.fromCharCode(65 + i)}</span>)}</div>
    <div className="board-rows">{Array.from({ length: board.size }, (_, i) => <span key={i}>{i + 1}</span>)}</div>
    <span className="terminal input-terminal" title="Input: signal enters from the left">IN</span>
    <span className={`terminal output-terminal ${connection.output ? "lit" : ""}`} title="Output: signal exits to the right">OUT</span>
    <div ref={container} className="circuit-board" role="group" aria-label={label}>
      {board.tiles.map((tile, i) => {
        const powered = connection.powered.has(i), mine = role === null || tile.owner === role;
        const pinged = game?.ping?.index === i && game.ping.until > now;
        const hinted = game?.hint?.index === i && game.hint.until > now;
        return <button type="button" key={i} data-cell={i} data-mask={tile.mask} data-owner={tile.owner}
          disabled={!interactive || busy} tabIndex={interactive && focus === i ? 0 : -1}
          onFocus={() => setFocus(i)} onKeyDown={event => moveFocus(event, i)} onClick={() => onTile?.(i)}
          className={`tile ${tile.owner === 0 ? "pulse-tile" : "echo-tile"} ${powered ? "powered" : ""} ${mine ? "owned" : "partner-tile"} ${pinged ? "pinged" : ""} ${hinted ? "hinted" : ""}`}
          aria-label={`${coordinates(i, board.size)}, ${ROLE_NAMES[tile.owner]}, wires ${maskWords(tile.mask)}${tile.beacon ? `, relay ${tile.beacon}` : ""}, ${powered ? "powered" : "unpowered"}. ${mine ? "Rotate clockwise" : "Ping your partner"}`}
          title={`${coordinates(i, board.size)} · ${mine ? "Rotate clockwise" : "Ping your partner"}`}>
          <Wire mask={tile.mask} />
          {hinted && <Wire mask={game!.hint!.mask} ghost />}
          {tile.beacon && <span className="beacon"><span>{tile.beacon}</span></span>}
          <Glyph role={tile.owner} />
          {pinged && <span className="ping-ring" aria-hidden="true" />}
        </button>;
      })}
    </div>
  </div>;
}
function Rules({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="rules-dialog">
    <div className="eyebrow">THE FIELD GUIDE</div>
    <DialogTitle>One goal. Two sets of hands.</DialogTitle>
    <DialogDescription>Connect the IN signal to every numbered relay and the OUT port. Light all of them at the same time to clear a round.</DialogDescription>
    <ol className="rule-list">
      <li><span>01</span><div><h3>Bring your other half</h3><p>Create a room and send its link or code to a friend on another device. Both players press ready.</p></div></li>
      <li><span>02</span><div><h3>Turn your tiles</h3><p><b className="pulse">▲ Pulse</b> controls amber tiles. <b className="echo">● Echo</b> controls blue tiles. Every tap rotates your tile a quarter-turn clockwise.</p></div></li>
      <li><span>03</span><div><h3>Make the connection</h3><p>Facing wire ends must meet. The signal enters the top-left tile from the left. Powered wires glow mint. The OUT port is to the right of the bottom-right tile.</p></div></li>
      <li><span>04</span><div><h3>Work together</h3><p>Tap a partner’s tile to ping its position. Use quick signals, or talk on a call. Finish all three rounds together. There’s no time limit and no penalty for experimenting.</p></div></li>
    </ol>
    <div className="rule-note"><Lightbulb size={19} /><p>Not every wire needs power. Unconnected branches are allowed. Stuck? A hint outlines one useful tile orientation for both players.</p></div>
    <p className="keyboard-note">Keyboard: Tab to the board · Arrow keys to move · Enter or Space to turn or ping.</p>
    <button className="primary-button" onClick={() => onOpenChange(false)}>Got it. Let’s connect. <ArrowRight size={18} /></button>
  </DialogContent></Dialog>;
}

export default function Relay() {
  const [room, setRoom] = useState<RoomView | null>(null), [seat, setSeat] = useState<Seat | null>(null);
  const [saved, setSaved] = useState<SavedSeat | null>(null), [name, setName] = useState(""), [code, setCode] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [connection, setConnection] = useState<"live" | "connecting" | "offline">("connecting");
  const [rules, setRules] = useState(false), [sound, setSound] = useState(false), [clock, setClock] = useState(0);
  const [practice, setPractice] = useState<Game | null>(null), [practiceCount, setPracticeCount] = useState(0), [practiceWon, setPracticeWon] = useState(false);
  const [invite, setInvite] = useState(false), [link, setLink] = useState("");
  const [initialized, setInitialized] = useState(false);
  const roomRef = useRef<RoomView | null>(null), seatRef = useRef<Seat | null>(null), acting = useRef(false), offset = useRef(0);
  const audio = useRef<AudioContext | null>(null), soundRef = useRef(false), lastPhase = useRef("");
  const game = room?.game ?? (practice ? publicGame(practice) : null), board = game?.board ?? DEMO_BOARD;
  const live = useMemo(() => connectivity(board), [board]);
  const now = clock + offset.current;
  const playSound = useCallback((kind: "turn" | "ping" | "win") => {
    if (!soundRef.current) return;
    try {
      audio.current ??= new AudioContext(); const ctx = audio.current;
      void ctx.resume();
      const tones = kind === "win" ? [261.63, 329.63, 392, 523.25] : kind === "ping" ? [659.25, 880] : [220];
      tones.forEach((f, i) => { const oscillator = ctx.createOscillator(), gain = ctx.createGain(), start = ctx.currentTime + i * .075;
        oscillator.type = "sine"; oscillator.frequency.value = f; gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(.045, start + .015); gain.gain.exponentialRampToValueAtTime(.0001, start + .22);
        oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start + .23); });
    } catch { /* Sound is optional. */ }
  }, []);
  const accept = useCallback((next: RoomView) => {
    const current = roomRef.current;
    if (current && current.code === next.code && current.revision > next.revision) return;
    offset.current = next.serverTime - Date.now(); roomRef.current = next; setRoom(next); setConnection("live");
    const phaseKey = `${next.game.match}:${next.game.level}:${next.game.phase}`;
    if (lastPhase.current && lastPhase.current !== phaseKey && ["between", "complete"].includes(next.game.phase)) playSound("win");
    lastPhase.current = phaseKey;
  }, [playSound]);
  const installSeat = useCallback((auth: Seat, next?: RoomView) => {
    seatRef.current = auth; setSeat(auth); setPractice(null); setError("");
    if (next) {
      const remembered = { ...auth, name: next.players[next.role]!.name };
      saveStorage("localStorage", `relay-seat:${auth.code}`, remembered); saveStorage("localStorage", "relay-last-seat", remembered); setSaved(remembered);
    }
    saveStorage("sessionStorage", "relay-active-seat", auth);
    window.history.replaceState(null, "", `?room=${auth.code}`);
    if (next) accept(next);
  }, [accept]);
  useEffect(() => {
    setClock(Date.now());
    const tick = window.setInterval(() => setClock(Date.now()), 1000);
    const query = new URLSearchParams(window.location.search).get("room")?.toUpperCase() ?? ""; setCode(query);
    const previous = fromStorage<SavedSeat>("localStorage", query ? `relay-seat:${query}` : "relay-last-seat");
    if (previous?.code && previous?.token) { setSaved(previous); if (!query) setName(current => current || previous.name || ""); }
    const active = fromStorage<Seat>("sessionStorage", "relay-active-seat");
    if (active?.code && active?.token && (!query || query === active.code)) installSeat(active);
    const audioEnabled = fromStorage<boolean>("localStorage", "relay-sound") === true; setSound(audioEnabled); soundRef.current = audioEnabled;
    setInitialized(true);
    return () => window.clearInterval(tick);
  }, [installSeat]);
  useEffect(() => {
    if (!seat) return;
    let stopped = false, timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try { const data = await api(`/api/rooms/${seat.code}`, "GET", undefined, seat.token); if (!stopped) { accept(data.room); setError(""); } }
      catch (e) { if (!stopped) { setConnection("offline"); if (!roomRef.current) setError((e as Error).message); } }
      if (!stopped) timer = setTimeout(poll, document.hidden ? 4500 : 1000);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [seat, accept]);
  const begin = async (kind: "create" | "join", event: FormEvent) => {
    event.preventDefault(); if (acting.current) return;
    acting.current = true; setBusy(true); setError("");
    try {
      const data = await api(kind === "create" ? "/api/rooms" : `/api/rooms/${encodeURIComponent(code.trim().toUpperCase())}/join`, "POST", { name });
      roomRef.current = null; installSeat({ code: data.room.code, token: data.token }, data.room); playSound("ping");
    } catch (e) { setError((e as Error).message); } finally { acting.current = false; setBusy(false); }
  };
  const act = useCallback(async (action: Action) => {
    const current = roomRef.current, auth = seatRef.current;
    if (!current || !auth || acting.current) return { error: "Wait for your current move to finish." };
    acting.current = true; setBusy(true); setError("");
    try {
      const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
      const payload = { id, round: roundKey(current.game), action };
      const data = await api(`/api/rooms/${auth.code}`, "POST", payload, auth.token);
      if (seatRef.current?.code === auth.code) accept(data.room);
      playSound(action.type === "ping" ? "ping" : "turn"); return { status: "ok", revision: data.room.revision };
    } catch (e) {
      const message = (e as Error).message; setError(message); toast.error(message); return { error: message };
    } finally { acting.current = false; setBusy(false); }
  }, [accept, playSound]);
  // An optional standard interface for assistive agents; the same ownership rules and API apply.
  const actRef = useRef(act); actRef.current = act;
  useEffect(() => {
    type ToolContext = { registerTool: (tool: { name: string; title: string; description: string; inputSchema: object; annotations: object; execute: (input: unknown) => unknown }, options: { signal: AbortSignal }) => void | Promise<void> };
    const context = (document as Document & { modelContext?: ToolContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<ToolContext["registerTool"]>[0]) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); } catch { /* Optional browser API. */ }
    };
    register({ name: "read_relay_board", title: "Read Relay board", description: "Read this player's current shared circuit, role and rules. Does not reveal the solution or seat credentials.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => {
      const r = roomRef.current; return r ? { role: ROLE_NAMES[r.role], phase: r.game.phase, round: r.game.level + 1, size: r.game.board.size, tiles: r.game.board.tiles, rule: "Rotate only your role's tiles. Connect IN at top-left west through all numbered relays to OUT at bottom-right east." } : { status: "Join a room first." };
    } });
    register({ name: "rotate_relay_tile", title: "Rotate your Relay tile", description: "Rotate one tile owned by the current player clockwise. This changes the shared game for both players.", inputSchema: { type: "object", properties: { coordinate: { type: "string", pattern: "^[A-F][1-6]$" } }, required: ["coordinate"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: async (input) => {
      const value = input as { coordinate?: unknown }; const r = roomRef.current;
      if (!r || typeof value?.coordinate !== "string" || !/^[A-F][1-6]$/.test(value.coordinate)) throw new Error("Choose a valid tile coordinate in an active room.");
      const x = value.coordinate.charCodeAt(0) - 65, y = Number(value.coordinate[1]) - 1, size = r.game.board.size, index = y * size + x;
      if (x >= size || y >= size || r.game.board.tiles[index].owner !== r.role || r.game.phase !== "playing") throw new Error("You can rotate only your own tiles during play.");
      return actRef.current({ type: "rotate", index });
    } });
    return () => lifecycle.abort();
  }, []);
  const startPractice = () => {
    offset.current = 0;
    const p = newGame(497 + practiceCount * 73); Object.assign(p, makePuzzle(497 + practiceCount * 73, 3), { phase: "playing", startedAt: Date.now() });
    setPractice(p); setPracticeWon(false); setError(""); setPracticeCount(n => n + 1);
  };
  const onTile = (index: number) => {
    if (practice) {
      if (practiceWon) return;
      const p = structuredClone(practice); p.board.tiles[index].mask = rotate(p.board.tiles[index].mask); p.moves[0]++;
      if (p.hint?.index === index && p.board.tiles[index].mask === p.hint.mask) p.hint = null;
      if (connectivity(p.board).solved) { setPracticeWon(true); p.solvedAt = Date.now(); playSound("win"); } else playSound("turn");
      setPractice(p);
    } else if (room) void act({ type: room.game.board.tiles[index].owner === room.role ? "rotate" : "ping", index });
  };
  const practiceHint = () => {
    if (!practice) return; const p = structuredClone(practice), index = p.board.tiles.findIndex((t, i) => t.mask !== p.solution[i]);
    if (index >= 0) { p.hint = { index, mask: p.solution[index], until: Date.now() + 18000 }; p.hints++; setPractice(p); }
  };
  const home = () => {
    setRoom(null); roomRef.current = null; setSeat(null); seatRef.current = null; setPractice(null); setError(""); setConnection("connecting"); lastPhase.current = "";
    try { window.sessionStorage.removeItem("relay-active-seat"); } catch { /* No stored session. */ }
    window.history.replaceState(null, "", "/");
  };
  const copyInvite = async () => {
    if (!room) return; const url = `${window.location.origin}/?room=${room.code}`; setLink(url);
    try { await navigator.clipboard.writeText(url); toast.success("Room link copied. Send it to your partner."); }
    catch { setInvite(true); }
  };
  const toggleSound = () => { const enabled = !sound; setSound(enabled); soundRef.current = enabled; saveStorage("localStorage", "relay-sound", enabled); if (enabled) playSound("ping"); };
  const hint = game?.hint && game.hint.until > now ? game.hint : null;
  const ping = game?.ping && game.ping.until > now ? game.ping : null;
  const isPlaying = game?.phase === "playing", solved = game?.phase === "between" || game?.phase === "complete";
  const elapsed = game?.startedAt ? ((game.solvedAt ?? now) - game.startedAt) / 1000 : 0;
  const totalMoves = room?.game.results.reduce((s, r) => s + r.moves[0] + r.moves[1], 0) ?? 0;
  const totalTime = room?.game.results.reduce((s, r) => s + r.seconds, 0) ?? 0;
  const partner = room?.players[room.role === 0 ? 1 : 0];
  const partnerAway = !!partner && now - partner.seen > 18000;

  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to game</a>
    <header className="site-header">
      <button className="wordmark" onClick={home} aria-label="Relay home" disabled={busy}><img src="/favicon.svg" alt="" width="35" height="35" /><span>RELAY<span className="wordmark-period">.</span></span></button>
      <div className="header-caption">A GAME FOR TWO MINDS</div>
      <nav className="header-actions" aria-label="Game controls"><button className="text-button rules-button" onClick={() => setRules(true)}><CircleHelp size={17} /><span>How to play</span></button><span className="header-divider" /><button className="icon-button" onClick={toggleSound} aria-label={sound ? "Mute sound" : "Enable sound"} aria-pressed={sound}>{sound ? <Volume2 size={19} /> : <VolumeX size={19} />}</button></nav>
    </header>
    <main id="main" className={room || practice ? "play-main" : "start-main"}>
      {!room && !practice && <>
        <section className="start-circuit" aria-label="Relay game preview">
          <div className="surface-heading"><span className="eyebrow">COOPERATIVE SIGNAL PUZZLE</span><span className="micro-tag">01—03</span></div>
          <div className="display-board"><CircuitBoard board={DEMO_BOARD} /><div className="display-annotation"><span className="annotation-dash" /><span>Different hands.<br />Same wavelength.</span></div></div>
          <div className="preview-legend"><span><Glyph role={0} /> You turn one half.</span><span><Glyph role={1} /> A friend turns the other.</span></div>
        </section>
        <section className="start-panel">
          <div className="eyebrow"><span className="small-cross">+</span> BETTER, TOGETHER</div>
          <h1>Two minds.<br />One <span>signal.</span></h1>
          <p className="intro">You own half the circuit. Your partner owns the rest. Find a shared path through three puzzles.</p>
          <div className="entry-forms">
            <label className="input-label" htmlFor="player-name">Your name</label>
            <input id="player-name" autoComplete="nickname" maxLength={20} value={name} onChange={e => setName(e.target.value)} placeholder="What should your partner call you?" disabled={busy || !!seat || !initialized} />
            <form onSubmit={e => void begin("create", e)}><button className="primary-button" disabled={busy || !name.trim() || !!seat || !initialized}>{busy || seat ? <Loader2 className="spin" size={18} /> : <Users size={18} />}{seat ? "Restoring your seat…" : busy ? "Connecting…" : "Create a room"}<ArrowUpRight size={19} /></button></form>
            <div className="or-divider"><span />or join your partner<span /></div>
            <form className="join-form" onSubmit={e => void begin("join", e)}><label className="sr-only" htmlFor="room-code">Six-character room code</label><input id="room-code" maxLength={6} autoCapitalize="characters" autoComplete="off" spellCheck={false} value={code} onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} placeholder="ROOM CODE" disabled={busy || !!seat || !initialized} /><button className="secondary-button" disabled={busy || !name.trim() || code.length !== 6 || !!seat || !initialized}>Join <ArrowRight size={18} /></button></form>
          </div>
          {error && <p className="error-message" role="alert">{error}{seat && <button className="text-button" onClick={home}>Back to start</button>}</p>}
          {saved && !seat && <button className="resume-link" onClick={() => installSeat(saved)} disabled={busy}>Return as {saved.name} · {saved.code} <ArrowRight size={15} /></button>}
          <button className="practice-link" onClick={startPractice} disabled={busy || !!seat || !initialized}><Radio size={17} /><span>Solo for now? <b>Try the practice circuit</b></span><ArrowRight size={16} /></button>
          <div className="start-facts"><span>2 players</span><span>Separate devices</span><span>No sign-up</span></div>
        </section>
      </>}
      {(room || practice) && <>
        <div className="play-topline"><button className="text-button" onClick={home} disabled={busy}>← Back to start</button>{room ? <button className="room-label" onClick={copyInvite} aria-label={`Copy invitation to room ${room.code}`}><Link2 size={15} /><span>ROOM</span><b>{room.code}</b><Copy size={14} /></button> : <span className="micro-tag">SOLO PRACTICE · BOTH ROLES</span>}</div>
        <div className="play-heading"><div><div className="eyebrow">{practice ? "GET A FEEL FOR THE FLOW" : `SECTOR 0${game!.level + 1} / 03`}</div><h1>{practice ? (practiceWon ? "You’ve got the signal." : "A little practice.") : game!.phase === "lobby" ? "Find your other half." : game!.phase === "complete" ? "In perfect resonance." : solved ? "Connection made." : SECTORS[game!.level].name}</h1></div>
          {room && <div className={`sync-badge ${connection}`} role="status">{connection === "live" ? <><span />Room connected</> : connection === "offline" ? <><WifiOff size={15} />Reconnecting…</> : <><Loader2 size={15} className="spin" />Connecting…</>}</div>}
        </div>
        <div className="game-layout">
          <section className={`game-surface ${solved || practiceWon ? "won-surface" : ""}`} aria-label="Play area">
            <div className="surface-heading"><span className="eyebrow">{practice ? "LEARNING CIRCUIT" : `${board.size} × ${board.size} SIGNAL NETWORK`}</span><div className="board-stats"><span><RotateCw size={14} />{game!.moves[0] + game!.moves[1]} turns</span><span>{timeText(elapsed)}</span></div></div>
            <CircuitBoard key={practice ? `practice-${practiceCount}` : `${game!.match}-${game!.level}`} board={board} role={room?.role ?? null} interactive={!!practice ? !practiceWon : !!isPlaying && connection === "live"} busy={busy} game={game!} now={now} onTile={onTile} />
            <div className="board-bottom"><span><span className="signal-swatch" />Live signal</span><p>{practice ? "Tap any tile to rotate it." : isPlaying ? <><Glyph role={room!.role} /> Your tiles rotate. Your partner’s tiles ping.</> : solved ? "A shared circuit. A shared victory." : "The circuit opens when you are both ready."}</p></div>
            <div className="board-notice" aria-live="polite">{hint ? <><Lightbulb size={16} /> Match the dashed wires at <b>{coordinates(hint.index, board.size)}</b>.</> : ping ? <><Radio size={16} />{room?.players[ping.from]?.name ?? ROLE_NAMES[ping.from]} pinged <b>{coordinates(ping.index, board.size)}</b>.</> : <><span className="quiet-cross">+</span> Follow the signal from IN. Bring every relay and OUT online.</>}</div>
          </section>
          <aside className="game-sidebar">
            {practice ? <>
              <div className="sidebar-title"><span className="eyebrow">YOUR FIRST CONNECTION</span><Radio size={20} /></div>
              <h2>{practiceWon ? "Ready for your other half?" : "Start at IN. Follow the glow."}</h2>
              <p className="muted">{practiceWon ? "That’s the idea. In a shared room, you and your partner each control half the board." : "In practice you control every tile. Turn the wire at the top-left until it faces IN, then build outward. Light both numbered relays and OUT."}</p>
              <div className="role-pair"><span><Glyph role={0} /> Pulse</span><span>+</span><span><Glyph role={1} /> Echo</span></div>
              <Objective beacons={live.beacons} output={live.output} />
              {practiceWon ? <><button className="primary-button" onClick={home}>Play with a friend <ArrowRight size={18} /></button><button className="text-button centered" onClick={startPractice}>Another practice circuit</button></> : <button className="secondary-button full-width" onClick={practiceHint}><Lightbulb size={17} />Show a useful turn</button>}
              <p className="sidebar-note">No timer to beat. Experiment as much as you like.</p>
            </> : <>
              <div className="sidebar-title"><span className="eyebrow">YOUR CREW</span><Users size={19} /></div>
              <div className="crew-list">{([0, 1] as Role[]).map(r => <div className={`crew-member ${r === room!.role ? "is-you" : ""}`} key={r}><div className={`crew-avatar ${r === 0 ? "pulse" : "echo"}`}><Glyph role={r} /></div><div><b>{room!.players[r]?.name ?? "Waiting for a partner"}{r === room!.role && <span className="you-label">YOU</span>}</b><span>{ROLE_NAMES[r]} · {room!.players[r] ? game!.ready[r] ? "Ready" : r !== room!.role && partnerAway ? "Away · seat saved" : r === 0 ? "Amber tiles" : "Blue tiles" : "Send them your room link"}</span></div>{game!.ready[r] && <Check size={18} className="mint" />}</div>)}</div>
              {game!.phase === "lobby" ? <div className="lobby-panel"><h2>{room!.players[1] ? "Your crew is here." : "One room. Two devices."}</h2><p className="muted">{room!.players[1] ? "You each control your own tiles. Ready to find your first connection?" : "Send this link to a friend. They can join in any modern browser, wherever they are."}</p><button className="secondary-button full-width" onClick={copyInvite}><Copy size={17} />Copy room link</button><div className="large-room-code" aria-label={`Room code ${room!.code}`}>{room!.code}</div><button className="primary-button" disabled={!room!.players[1] || game!.ready[room!.role] || busy} onClick={() => void act({ type: "ready" })}>{game!.ready[room!.role] ? <><Check size={18} />Waiting for your partner</> : room!.players[1] ? <>I’m ready <ArrowRight size={18} /></> : <>Waiting for player two…</>}</button><p className="sidebar-note">Rooms stay available for 7 days. Reopen on the same browser to restore your seat.</p></div> : solved ? <div className="result-panel"><div className="result-symbol"><CheckCheck size={32} /></div><h2>{game!.phase === "complete" ? "Two minds. One team." : "A little more in sync."}</h2><p className="muted">{game!.phase === "complete" ? "All three networks are alive. You did that together." : `Sector ${game!.level + 1} is online. ${SECTORS[game!.level + 1].subtitle}`}</p><div className="result-stats"><div><strong>{game!.phase === "complete" ? totalMoves : game!.moves[0] + game!.moves[1]}</strong><span>shared turns</span></div><div><strong>{timeText(game!.phase === "complete" ? totalTime : elapsed)}</strong><span>time together</span></div></div><div className="sector-progress">{SECTORS.map((s, i) => <div key={s.name} className={i <= game!.level ? "done" : ""}><span>{i <= game!.level ? <Check size={13} /> : i + 1}</span>{s.name}</div>)}</div><button className="primary-button" onClick={() => void act({ type: "ready" })} disabled={game!.ready[room!.role] || busy}>{game!.ready[room!.role] ? <>Waiting for your partner <Loader2 size={16} className="spin" /></> : game!.phase === "complete" ? <>Play a new set <Sparkles size={17} /></> : <>Ready for sector 0{game!.level + 2}<ArrowRight size={18} /></>}</button><p className="sidebar-note">{game!.phase === "complete" ? `${game!.results.reduce((s, r) => s + r.hints, 0)} hints used · A fresh set awaits you.` : "The next round starts when you both press ready."}</p></div> : <>
                <Objective beacons={live.beacons} output={live.output} />
                <div className="quick-signals"><div className="eyebrow">SEND A SIGNAL</div><div>{MESSAGES.map(m => <button key={m} disabled={busy || connection !== "live"} onClick={() => void act({ type: "message", text: m })}>{m}</button>)}</div><div className="signal-message" aria-live="polite">{game!.message && now - game!.message.at < 15000 ? <><Glyph role={game!.message.from} /><b>{room!.players[game!.message.from]!.name}:</b> {game!.message.text}</> : <><Radio size={15} /> A little teamwork goes a long way.</>}</div></div>
                <button className="hint-button" disabled={busy || !!hint || connection !== "live"} onClick={() => void act({ type: "hint" })}><Lightbulb size={17} />{hint ? "Hint is on the board" : "Need a little nudge?"}<span>{game!.hints > 0 ? `${game!.hints} used` : "Hint"}</span></button>
                {partnerAway && <p className="away-note">Your partner seems away. Their seat and your progress are saved.</p>}
              </>}
            </>}
          </aside>
        </div>
        {error && <p className="error-message play-error" role="alert">{error}</p>}
      </>}
    </main>
    <footer className="site-footer"><span>BUILT TO CONNECT.</span><span>Made by Inayat Abbas Malla <span className="footer-separator">/</span> Built with ChatGPT Work</span><button onClick={() => setRules(true)}>The field guide <ArrowUpRight size={13} /></button></footer>
    <Rules open={rules} onOpenChange={setRules} />
    <Dialog open={invite} onOpenChange={setInvite}><DialogContent className="rules-dialog"><DialogTitle>Invite your partner</DialogTitle><DialogDescription>Copy this link, or share the six-character code.</DialogDescription><input aria-label="Room invitation link" value={link} readOnly onFocus={e => e.target.select()} /><strong className="large-room-code">{room?.code}</strong></DialogContent></Dialog>
    <Toaster theme="dark" richColors position="bottom-center" />
  </div>;
}
function Objective({ beacons, output }: { beacons: ReturnType<typeof connectivity>["beacons"]; output: boolean }) {
  const lit = beacons.filter(b => b.lit).length + Number(output), total = beacons.length + 1;
  return <section className="objective"><div className="objective-heading"><h2>Bring them online</h2><span>{lit}/{total}</span></div><p>Connect every relay and the OUT port.</p><div className="beacon-checks">{beacons.map(b => <div className={b.lit ? "active" : ""} key={b.id}><span className="small-beacon">{b.lit ? <Check size={14} /> : b.id}</span><span>Relay {String(b.id).padStart(2, "0")}</span></div>)}<div className={output ? "active" : ""}><span className="small-beacon output-check">{output ? <Check size={14} /> : <ArrowRight size={14} />}</span><span>OUT</span></div></div><Progress value={100 * lit / total} aria-label={`${lit} of ${total} connections online`} className="connection-progress" /></section>;
}
