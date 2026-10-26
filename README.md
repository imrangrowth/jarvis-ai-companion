# Jarvis AI Companion

An experimental multi-agent assistant interface exploring conversation, voice, contextual memory, and task-specific AI workflows.

## Project scope

The source includes an assistant interface with several agent roles and server functions for:

- Agent-directed conversations
- Speech synthesis
- Knowledge recall and interaction logging
- Website-building workflows
- Identity and live-context assembly

The application is an exploration rather than a verified production-ready assistant. Features that rely on external services require their own credentials and configuration.

## Stack

TypeScript · React · TanStack Router / Start · Vite

## Getting started

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Available checks:

```bash
npm run build
npm run lint
```

Do not commit API keys or other secrets. Inspect the server functions for service-specific configuration requirements.

## Code map

- `src/routes/index.tsx` — main assistant screen and agent roles
- `src/lib/jarvis.functions.ts` — assistant functions
- `src/lib/jarvis-self-model.ts` — identity and contextual data
- `src/lib/jarvis-pillars.functions.ts` — knowledge and interaction helpers

## Status

**Prototype / ongoing experimentation.** Zeero is a related, later personal-assistant project: [view Zeero](https://github.com/imrangrowth/Zeero).
