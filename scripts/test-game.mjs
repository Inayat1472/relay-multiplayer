import assert from 'node:assert/strict';
import { makePuzzle, connectivity, rotate, newGame, applyAction, publicGame } from '../lib/game.ts';
let puzzles = 0;
for (const size of [3, 4, 5, 6]) {
  for (let seed = 0; seed < 250; seed++) {
    const { board, solution } = makePuzzle(seed * 7919, size);
    const solved = { size, tiles: board.tiles.map((t, i) => ({ ...t, mask: solution[i] })) };
    assert.equal(connectivity(solved).solved, true, `solvable ${seed}/${size}`);
    assert.equal(connectivity(board).solved, false, `starts unsolved ${seed}/${size}`);
    assert.equal(new Set(board.tiles.map(t => t.owner)).size, 2);
    assert.equal(new Set(board.tiles.filter(t => t.beacon).map(t => t.beacon)).size, size <= 4 ? 2 : 3);
    for (let i = 0; i < board.tiles.length; i++) assert.ok([0, 1, 2, 3].some(t => rotate(board.tiles[i].mask, t) === solution[i]));
    puzzles++;
  }
}
for (let m = 1; m < 16; m++) assert.equal(rotate(m, 4), m);
const game = newGame(19229);
assert.throws(() => applyAction(game, 0, { type: 'ready' }, 10, false), /partner/);
applyAction(game, 0, { type: 'ready' }, 10, true);
assert.equal(game.phase, 'lobby');
applyAction(game, 1, { type: 'ready' }, 20, true);
assert.equal(game.phase, 'playing');
const other = game.board.tiles.findIndex(t => t.owner === 1);
const before = JSON.stringify(game);
assert.throws(() => applyAction(game, 0, { type: 'rotate', index: other }, 30, true), /partner/);
assert.equal(JSON.stringify(game), before);
assert.throws(() => applyAction(game, 0, { type: 'rotate', index: -1 }, 30, true), /tile/);
assert.throws(() => applyAction(game, 0, { type: 'message', text: '<script>' }, 30, true), /signals/);
applyAction(game, 0, { type: 'ping', index: other }, 40, true);
assert.equal(game.ping.index, other);
applyAction(game, 1, { type: 'hint' }, 50, true);
assert.ok(game.hint && game.hints === 1);
const hints = game.hints; applyAction(game, 0, { type: 'hint' }, 60, true); assert.equal(game.hints, hints);
assert.ok(!('solution' in publicGame(game)) && !('seed' in publicGame(game)) && !('recentActions' in publicGame(game)));
let now = 100;
for (let level = 0; level < 3; level++) {
  assert.equal(game.level, level);
  for (let i = 0; i < game.board.tiles.length && game.phase === 'playing'; i++) {
    for (let j = 0; j < 4 && game.board.tiles[i].mask !== game.solution[i] && game.phase === 'playing'; j++) {
      applyAction(game, game.board.tiles[i].owner, { type: 'rotate', index: i }, now += 100, true);
    }
  }
  assert.equal(connectivity(game.board).solved, true);
  assert.equal(game.results.length, level + 1);
  assert.equal(game.phase, level === 2 ? 'complete' : 'between');
  assert.throws(() => applyAction(game, 0, { type: 'rotate', index: 0 }, now, true), /start/);
  if (level < 2) { applyAction(game, 0, { type: 'ready' }, now + 1, true); applyAction(game, 1, { type: 'ready' }, now + 2, true); }
}
const oldSeed = game.seed;
applyAction(game, 0, { type: 'ready' }, now + 3, true); applyAction(game, 1, { type: 'ready' }, now + 4, true);
assert.equal(game.phase, 'playing'); assert.equal(game.match, 1); assert.equal(game.level, 0); assert.equal(game.results.length, 0); assert.notEqual(game.seed, oldSeed);
console.log(`PASS: ${puzzles} solvable, initially unsolved puzzles; ownership; bounds; hints; public-state privacy; three rounds and rematch.`);
