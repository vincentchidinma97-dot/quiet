# CLAUDE.md

## Project Context

- **Product:** quiet. — a privacy-first crypto chat + trading app. Core thesis: no accounts, no data farming, encrypted messaging, self-custodied wallets via Privy.
- **Stack:** React Native (Expo) mobile app + Next.js web app, monorepo
- **Design system:** paper/eclipse/white/black themes, Fraunces (serif display), Inter (sans), JetBrains Mono (data)
- **Wallet:** Privy embedded wallets (ETH + SOL + BTC), Sepolia testnet for now
- **Messaging:** XMTP for end-to-end encrypted DMs
- **Status:** mobile has real login + balance + receive. Web has login + balance + terminal layout, XMTP messaging in progress.
- **Naming:** the product was previously called "Vault" — some old files/comments may still reference Vault, treat as legacy naming to be cleaned up
