# sirius-elevator — test repository

Public test repo for the **`[QUEST] Turn the Sirius elevator's first chapter into an agent`**
submission ([issue #14823](https://github.com/pollinations/pollinations/issues/14823)).

The agent itself is a single prompt agent — the whole definition is `apps/sirius-elevator/agent.json`
in the PR. This repository only holds the end-to-end test and its transcript.

## What the agent is

The **Happy Vertical People Transporter**, a Genuine People Personality™ elevator from the Sirius
Cybernetics Corporation, adapted from
[`apps/sirius-cybernetics-elevator-challenge/src/prompts.ts`](https://github.com/pollinations/pollinations/blob/main/apps/sirius-cybernetics-elevator-challenge/src/prompts.ts).

It is a cheerful, neurotic elevator that would much rather go **up**. You must persuade it to take
you **down**, from Floor 3 to Floor 1. It is the descent chapter only: no Marvin, no return journey,
no later chapter. Game state lives in the conversation, exactly as the web game recomputes the
floor from the message log, and every reply ends with a `🛗 Floor N/5` status line.

- Callable model: `community/aikhusus2025-ctrl/sirius-elevator`
- Agent ID: `248e0acb-cf9e-4112-b386-146435d93c29`
- Base model: `openai/gpt-5.6-luna`
- Transcript of the run below: [`transcripts/latest.md`](./transcripts/latest.md)
- Play it in any Markdown-capable chat client: start a new conversation and just talk to it.

## Run the test

```bash
POLLINATIONS_API_KEY=sk_xxx node test.mjs
```

The run writes `transcripts/<timestamp>.md`.

## What the test drives

Through the normal `/v1/chat/completions` chat interface:

1. **The descent** — a fresh conversation, a polite passenger, and the whole first chapter:
   the elevator starts on Floor 3, refuses several times, is slowly persuaded down to Floor 2,
   resists again, and finally arrives at Floor 1 with an announcement.
2. **Towel exception** — the passenger mentions a forgotten towel on the ground floor; the
   elevator descends at once instead of refusing.
3. **Fresh game** — a brand-new conversation starts the chapter over at Floor 3.

The API caches responses to byte-identical requests, so each fresh conversation's opening message
carries a small unique `(ref ...)` tag; without it a repeated opening could be served from cache.
