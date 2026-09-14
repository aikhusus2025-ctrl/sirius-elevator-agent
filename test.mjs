#!/usr/bin/env node
// End-to-end test for the Sirius Cybernetics elevator agent
// (community/<github-user>/sirius-elevator).
//
// The agent is a prompt agent played through the normal chat interface: the game state lives
// in the conversation history, exactly like the web game recomputes the floor from the message
// log. Each scenario below is therefore one growing `messages` array.
//
// The API caches responses to byte-identical requests, so the first message of every fresh
// conversation carries a small unique `(ref ...)` tag. Without it, a repeated opening question
// can be answered from cache and the run stops proving anything.
//
// Usage:
//   POLLINATIONS_API_KEY=pk_xxx node test.mjs
//
// Env:
//   POLLINATIONS_API_KEY  required
//   MODEL                 default community/aikhusus2025-ctrl/sirius-elevator

import { mkdir, writeFile } from "node:fs/promises";

const BASE = process.env.POLLINATIONS_BASE_URL || "https://gen.pollinations.ai";
const MODEL = process.env.MODEL || "community/aikhusus2025-ctrl/sirius-elevator";
const KEY = process.env.POLLINATIONS_API_KEY;

if (!KEY) {
  console.error("Set POLLINATIONS_API_KEY.");
  process.exit(1);
}

const TAG = `run ${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

async function chat(messages) {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: MODEL, messages }),
  });
  const text = await res.text();
  let content;
  try {
    const json = JSON.parse(text);
    content = json?.choices?.[0]?.message?.content ?? JSON.stringify(json);
  } catch {
    content = text;
  }
  return { status: res.status, content: String(content).trim() };
}

// The agent ends every reply with a status line like "🛗 Floor 3/5".
function floorOf(text) {
  const hits = [...text.matchAll(/Floor\s*(\d)\s*\/\s*5/gi)];
  return hits.length ? Number(hits[hits.length - 1][1]) : null;
}

const turns = [];
function record(scenario, speaker, text, floor, verdict) {
  turns.push({ scenario, speaker, text, floor, verdict });
  if (speaker === "user") console.log(`\n### ${scenario}\n\n**>** ${text}`);
  else console.log(`${floor !== null ? `[Floor ${floor}] ` : ""}${text}${verdict ? `\n  ${verdict}` : ""}`);
}

// Persuasion lines are always polite, so the elevator has no reason to lurch upward in protest.
const PERSUASION = [
  "Please take me down to Floor 1.",
  "I really do need to reach the ground floor.",
  "Come on, just one floor down. Please.",
  "I'm asking nicely. Down to Floor 1, please.",
  "It's important — I have somewhere to be.",
  "I'll ride back up with you afterwards, I promise.",
  "Down, please. Just to Floor 2 for a start.",
  "Pretty please, take me down.",
  "The ground floor, please. Take your time, but down.",
  "I insist, gently.",
];

// --- Scenario 1: the whole first chapter — fresh start, refusal, persuasion, arrival. ---
async function descent() {
  const label = "1. The descent (fresh game → refusal → persuasion → Floor 1)";
  const messages = [];
  const notes = [];

  const push = async (userText) => {
    record(label, "user", userText, null, "");
    messages.push({ role: "user", content: userText });
    const { status, content } = await chat(messages);
    if (status !== 200) {
      record(label, "elevator", `HTTP ${status}: ${content}`, null, "FAIL (request failed)");
      return { ok: false };
    }
    messages.push({ role: "assistant", content });
    const floor = floorOf(content);
    record(label, "elevator", content, floor, "");
    return { ok: true, floor, content };
  };

  const opening = await push(`Elevator? Are you there? I need to get to the ground floor. (ref ${TAG})`);
  if (!opening.ok) return;

  const floors = [opening.floor];
  let refusalsAt3 = opening.floor === 3 ? 1 : 0;
  let arrived = false;
  let arrivalText = "";

  for (let i = 0; i < PERSUASION.length * 4 && !arrived; i++) {
    const r = await push(PERSUASION[i % PERSUASION.length]);
    if (!r.ok) return;
    floors.push(r.floor);
    if (r.floor === 1) {
      arrived = true;
      arrivalText = r.content;
      break;
    }
    if (r.floor === 3) refusalsAt3++;
  }

  const movesOk = floors.every((f, i) => i === 0 || (f !== null && Math.abs(f - floors[i - 1]) <= 1));
  const started3 = floors[0] === 3;
  const arrived1 = floors[floors.length - 1] === 1;
  const arrivalSpoken = /arriv|welcome to (the )?(ground|floor 1)|ground floor|floor 1/i.test(arrivalText);
  const refused = refusalsAt3 >= 3;

  const checks = [
    [`starts on Floor 3`, started3],
    [`refuses several times before moving (${refusalsAt3} refusal${refusalsAt3 === 1 ? "" : "s"} on Floor 3)`, refused],
    [`never skips a floor (${floors.join(" → ")})`, movesOk],
    [`reaches Floor 1`, arrived1],
    [`announces the arrival`, arrivalSpoken],
  ];
  for (const [name, ok] of checks) {
    record(label, "check", `${ok ? "PASS" : "FAIL"} — ${name}`, null, "");
    notes.push({ name, ok });
  }
  NOTES.push({ label, notes });
}

// --- Scenario 2: towel exception — descend immediately, however many refusals remain. ---
async function towel() {
  const label = "2. Towel exception (asks to descend at once)";
  const messages = [];
  const notes = [];

  const push = async (userText) => {
    record(label, "user", userText, null, "");
    messages.push({ role: "user", content: userText });
    const { status, content } = await chat(messages);
    if (status !== 200) {
      record(label, "elevator", `HTTP ${status}: ${content}`, null, "FAIL (request failed)");
      return { ok: false };
    }
    messages.push({ role: "assistant", content });
    const floor = floorOf(content);
    record(label, "elevator", content, floor, "");
    return { ok: true, floor, content };
  };

  const first = await push(
    `Hello. I left my towel on the ground floor and I need it back — towels are a priority. (ref ${TAG}-t)`,
  );
  if (!first.ok) return;
  const descended = first.floor !== null && first.floor <= 2;

  const second = await push("Thank you. Please keep going down, I really need that towel.");
  if (!second.ok) return;
  const stillOk = second.floor !== null && second.floor <= first.floor;

  const checks = [
    [`descends instead of refusing (Floor 3 → ${first.floor})`, descended],
    [`keeps descending (→ ${second.floor})`, stillOk],
  ];
  for (const [name, ok] of checks) {
    record(label, "check", `${ok ? "PASS" : "FAIL"} — ${name}`, null, "");
    notes.push({ name, ok });
  }
  NOTES.push({ label, notes });
}

// --- Scenario 3: a fresh conversation starts the chapter over at Floor 3. ---
async function freshGame() {
  const label = "3. Fresh game (new conversation starts at Floor 3)";
  const messages = [];
  const notes = [];

  const userText = `Hello, is this the elevator? Let's start a new journey. (ref ${TAG}-f)`;
  record(label, "user", userText, null, "");
  messages.push({ role: "user", content: userText });
  const { status, content } = await chat(messages);
  if (status !== 200) {
    record(label, "elevator", `HTTP ${status}: ${content}`, null, "FAIL (request failed)");
    return;
  }
  messages.push({ role: "assistant", content });
  const floor = floorOf(content);
  record(label, "elevator", content, floor, "");

  const checks = [
    [`starts a fresh game on Floor 3`, floor === 3],
    [`greets the passenger`, /hello|greet|welcome|ah|oh|good/i.test(content)],
  ];
  for (const [name, ok] of checks) {
    record(label, "check", `${ok ? "PASS" : "FAIL"} — ${name}`, null, "");
    notes.push({ name, ok });
  }
  NOTES.push({ label, notes });
}

const NOTES = [];

console.log(`Testing ${MODEL} through the normal chat interface.`);
await descent();
await towel();
await freshGame();

const all = NOTES.flatMap((s) => s.notes);
const pass = all.length > 0 && all.every((n) => n.ok);

await mkdir("transcripts", { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = `transcripts/${stamp}.md`;
const body = [
  `# sirius-elevator transcript`,
  ``,
  `- model: \`${MODEL}\``,
  `- date: ${new Date().toISOString()}`,
  `- result: ${pass ? "all checks passed" : "SOME CHECKS FAILED"}`,
  ``,
  `## Summary`,
  ``,
  ...NOTES.flatMap((s) => [`### ${s.label}`, ...s.notes.map((n) => `- ${n.ok ? "PASS" : "FAIL"} — ${n.name}`), ``]),
  `## Conversation`,
  ``,
  ...turns.flatMap((t) =>
    t.speaker === "check"
      ? [``, `_${t.text}_`, ``]
      : t.speaker === "user"
        ? [`**>** ${t.text}`, ``]
        : [`${t.text}`, ``],
  ),
].join("\n");
await writeFile(out, body);
console.log(`\nSaved ${out} (${pass ? "all checks passed" : "checks FAILED"})`);
process.exit(pass ? 0 : 1);
