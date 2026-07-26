# âš¡ Spacze Nex

> Open-source autonomous AI coding agents. Deploy AI engineers to write code, run tests, and open pull requests.

![License](https://img.shields.io/badge/license-AGPL--3.0-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)
![Next.js](https://img.shields.io/badge/Next.js-14-black)

## What is Spacze Nex?

Spacze Nex is a platform where you describe a coding task and an AI agent autonomously completes it in a sandboxed environment. It clones your repo, understands the codebase, makes changes, runs tests, and pushes a branch for your review.

## Quick Start

```bash
# Clone
git clone https://github.com/Spacze-Tesleem/spacze-agents.git
cd spacze-agents

# Install
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your keys

# Database
pnpm db:push

# Run
pnpm dev
```

## Architecture

```
Dashboard (Next.js) â†’ API (Fastify) â†’ Queue (BullMQ) â†’ Worker â†’ Docker Sandbox
                                                              â†“
                                                        AI Reasoning (ReAct)
                                                              â†“
                                                        Tools (read/write/exec)
```

## SDK Usage

```typescript
import { SpaczAgent } from '@spacze/agent-sdk';

const agent = new SpaczAgent({ apiKey: 'your-key' });

const run = await agent.execute({
  repo: 'https://github.com/you/project',
  task: 'Add dark mode toggle to the settings page',
});

const result = await agent.waitForCompletion(run.id);
console.log(result.prUrl); // PR ready for review!
```

## Tech Stack

- **Frontend:** Next.js 14, TypeScript, Tailwind CSS, Framer Motion
- **Backend:** Fastify, Prisma, PostgreSQL, BullMQ, Redis
- **AI:** Anthropic Claude (ReAct pattern with tool-calling)
- **Sandbox:** Docker (isolated containers per agent)
- **SDK:** TypeScript, published to npm

## Project Structure

```
spacze-agents/
â”œâ”€â”€ apps/web/          # Next.js dashboard
â”œâ”€â”€ apps/api/          # Fastify API + workers
â”œâ”€â”€ packages/sdk/      # @spacze/agent-sdk
â”œâ”€â”€ packages/shared/   # Shared types
â”œâ”€â”€ packages/ui/       # Shared UI components
â””â”€â”€ docker/            # Agent sandbox images
```

## License

AGPL-3.0 Â© Spacze Software Enterprise