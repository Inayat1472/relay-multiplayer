import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import ts from 'typescript';
await mkdir('.sites-runtime/tests', { recursive: true });
const dir = resolve('.sites-runtime/tests');
await writeFile(`${dir}/database.mjs`, `import { DatabaseSync } from 'node:sqlite';\nexport const raw = new DatabaseSync(':memory:');\nexport function database() { return { prepare(sql) { let args=[]; return { bind(...values) { args=values; return this; }, async first() { return raw.prepare(sql).get(...args) ?? null; }, async run() { const r=raw.prepare(sql).run(...args); return {success:true,meta:{changes:Number(r.changes)}}; } }; }, async batch(statements) { return Promise.all(statements.map(s=>s.run())); } }; }`);
const server = (await readFile('lib/server.ts', 'utf8')).replace('"@/db"', '"./database.mjs"').replace('"./game"', JSON.stringify(new URL('../lib/game.ts', import.meta.url).href));
await writeFile(`${dir}/server.mjs`, ts.transpileModule(server, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const { raw } = await import(`${dir}/database.mjs`);
raw.exec(await readFile('drizzle/0000_amusing_spyke.sql', 'utf8'));
const { createRoom, joinRoom, readRoom, actOnRoom, respond } = await import(`${dir}/server.mjs`);
const origin = 'https://relay.test';
function req(body, token, extra = {}) { return new Request(origin + '/api/rooms', { method: body ? 'POST' : 'GET', headers: { ...(body ? {'content-type':'application/json','origin':origin} : {}), ...(token ? { authorization:`Bearer ${token}` } : {}), ...extra }, ...(body ? { body:JSON.stringify(body) } : {}) }); }
const a = await createRoom(req({name:'Tester A'}));
assert.equal(a.room.role, 0); assert.equal(a.token.length, 64);
const readState = () => JSON.parse(raw.prepare('SELECT state FROM rooms WHERE code=?').get(a.room.code).state);
const joinResults = await Promise.all([respond(()=>joinRoom(req({name:'Tester B'}),a.room.code)),respond(()=>joinRoom(req({name:'Tester C'}),a.room.code))]);
assert.deepEqual(joinResults.map(r=>r.status).sort(),[200,409]);
const b = await joinResults.find(r=>r.status===200).json();
assert.equal(b.room.role,1);
assert.equal((await respond(()=>readRoom(req(null,'f'.repeat(64)),a.room.code))).status,401);
assert.equal((await respond(()=>createRoom(req({name:' ' })))).status,400);
assert.equal((await respond(()=>createRoom(req({name:'X'},undefined,{origin:'https://other.test'})))).status,403);
const send = (token, action, id=crypto.randomUUID(), round='0:0') => actOnRoom(req({id,round,action},token),a.room.code);
await Promise.all([send(a.token,{type:'ready'}),send(b.token,{type:'ready'})]);
assert.equal(readState().phase,'playing');
const version0 = (await readRoom(req(null,a.token),a.room.code)).room.revision;
const actionId=crypto.randomUUID();
await Promise.all([send(a.token,{type:'rotate',index:0},actionId),send(a.token,{type:'rotate',index:0},actionId)]);
assert.equal(readState().moves[0],1,'replayed move applied once');
const current = await readRoom(req(null,b.token),a.room.code);
assert.equal(current.room.revision,version0+1);
assert.ok(!('solution' in current.room.game) && !('seed' in current.room.game));
const currentState=JSON.stringify(readState());
assert.equal((await respond(()=>send(a.token,{type:'rotate',index:1}))).status,409);
assert.equal(JSON.stringify(readState()),currentState,'unauthorised move did not mutate');
await Promise.all([send(a.token,{type:'rotate',index:0}),send(b.token,{type:'rotate',index:1})]);
assert.deepEqual(readState().moves,[2,1],'simultaneous moves retained');
await send(a.token,{type:'ping',index:1});
assert.equal((await readRoom(req(null,b.token),a.room.code)).room.game.ping.index,1);
await send(b.token,{type:'message',text:'Working on it'});
assert.equal((await readRoom(req(null,a.token),a.room.code)).room.game.message.text,'Working on it');
for(let level=0;level<3;level++){
 let state=readState();
 for(let i=0;i<state.board.tiles.length;i++){
  for(let j=0;j<4;j++){
   state=readState(); if(state.phase!=='playing'||state.board.tiles[i].mask===state.solution[i])break;
   await send(state.board.tiles[i].owner===0?a.token:b.token,{type:'rotate',index:i},crypto.randomUUID(),`0:${level}`);
  }
 }
 state=readState(); assert.equal(state.phase,level===2?'complete':'between');assert.equal(state.results.length,level+1);
 if(level<2) await Promise.all([send(a.token,{type:'ready'},crypto.randomUUID(),`0:${level}`),send(b.token,{type:'ready'},crypto.randomUUID(),`0:${level}`)]);
}
await Promise.all([send(a.token,{type:'ready'},crypto.randomUUID(),'0:2'),send(b.token,{type:'ready'},crypto.randomUUID(),'0:2')]);
assert.equal(readState().match,1);assert.equal(readState().phase,'playing');
assert.equal((await respond(()=>send(a.token,{type:'rotate',index:0},crypto.randomUUID(),'0:0'))).status,409);
raw.prepare('UPDATE rooms SET expires_at=0 WHERE code=?').run(a.room.code);
assert.equal((await respond(()=>readRoom(req(null,a.token),a.room.code))).status,404);
console.log('PASS: real SQLite migration and API handlers; racing joins; concurrent ready/moves; duplicate requests; auth and role isolation; cross-origin denial; shared pings/messages; three rounds; rematch; stale actions; room expiry.');
