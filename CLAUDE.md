# Vibe Wallet Dashboard

Web dashboard for monitoring and managing Vibe Wallet instances, accounts, and on-chain activity across EVM and Solana networks.

## Tech Stack

- Vite 7 + React 19 + TypeScript 5.9
- Tailwind CSS 4 (via PostCSS plugin)
- viem for EVM chain interactions
- lucide-react for icons
- clsx + tailwind-merge for class utilities

## Commands

```bash
pnpm dev          # Start dev server on http://localhost:5173
pnpm build        # Type-check (tsc -b) then Vite production build
pnpm lint         # ESLint
pnpm preview      # Preview production build locally
```

## Architecture

- **Single-page app** — all UI lives in `src/App.tsx` (single-file architecture).
- **Extension bridge** — connects to the Vibe Wallet browser extension via its injected provider (`window.ethereum` / `window.solana`). No backend server.
- **Multi-chain** — supports EVM testnets (Sepolia, Base Sepolia, Arbitrum Sepolia) and Solana networks (Devnet, Testnet, Mainnet).
- **Multi-instance** — can monitor multiple browser profiles / connected devices.

## Conventions

- Use TypeScript strict mode.
- Styling via Tailwind utility classes; use `clsx` and `tailwind-merge` (`cn()` pattern) for conditional classes.
- Prefer functional React components with hooks.
- Dark-mode-first cyberpunk aesthetic.
