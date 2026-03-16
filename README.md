# Vibe Wallet Dashboard

A premium web visualization suite for the Vibe Wallet ecosystem. Monitor your AI-controlled wallets in real-time.

## ⚡ Features

- **Real-time Monitoring**: Connects directly to the extension via the injected provider.
- **Multi-Instance View**: See all your browser profiles and connected devices.
- **Multi-Chain View**: Toggle between Ethereum (EVM) and Solana (SPL) portfolios seamlessly.
- **Account Management**: Interactive switcher for your named accounts (Main, Bot, Trading, etc.).
- **Transaction History**: View recent on-chain activity with status indicators.
- **Cyberpunk UI**: High-performance dark mode interface with Framer Motion animations.

## 🛠️ Tech Stack

- **Vite 7** + **React 19** + **TypeScript 5.9**
- **Tailwind CSS 4** — utility-first styling
- **viem** — EVM blockchain interactions
- **lucide-react** — icon library
- **clsx** + **tailwind-merge** — conditional class utilities

## 🚀 Quick Start

```bash
cd mcp-wallet/dashboard
pnpm install
pnpm run dev
```

The dashboard will be available at [http://localhost:5173](http://localhost:5173).

## 💻 Development

```bash
pnpm install      # Install dependencies
pnpm dev          # Start dev server (http://localhost:5173)
pnpm build        # Type-check and build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
```

## 🔗 Requirements

- **Vibe Wallet Extension** must be installed and active in the browser.
- **EVM Networks**: Ethereum Sepolia, Base Sepolia, Arbitrum Sepolia.
- **Solana Networks**: Devnet, Testnet, Mainnet.

## 📜 License

MIT
