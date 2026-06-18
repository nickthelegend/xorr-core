// Sui configuration for XORR (migrated from EVM/Sepolia).
// Set these in .env.local after publishing xorr-contracts to testnet:
//   NEXT_PUBLIC_SUI_NETWORK=testnet
//   NEXT_PUBLIC_USDT_PACKAGE_ID=0x...   (published xorr-contracts package id)
//   NEXT_PUBLIC_USDT_FAUCET_ID=0x...    (the shared usdt::Faucet object id)

export type SuiNetwork = "testnet" | "mainnet" | "devnet" | "localnet";

export const SUI_NETWORK: SuiNetwork =
  (process.env.NEXT_PUBLIC_SUI_NETWORK as SuiNetwork) ?? "testnet";

// Hardcoded fullnode RPC URLs (the @mysten/sui 2.19 `getFullnodeUrl` helper was
// removed; these endpoints are stable and version-proof).
export const SUI_RPC_URLS: Record<SuiNetwork, string> = {
  testnet: "https://fullnode.testnet.sui.io:443",
  mainnet: "https://fullnode.mainnet.sui.io:443",
  devnet: "https://fullnode.devnet.sui.io:443",
  localnet: "http://127.0.0.1:9000",
};

/** Published `xorr_contracts` package id (holds the `usdt` module). */
export const USDT_PACKAGE_ID = process.env.NEXT_PUBLIC_USDT_PACKAGE_ID ?? "";

/** Shared `usdt::Faucet` object id (wraps the TreasuryCap for capped minting). */
export const USDT_FAUCET_ID = process.env.NEXT_PUBLIC_USDT_FAUCET_ID ?? "";

export const USDT_DECIMALS = 6;

/** Matches `usdt::MAX_FAUCET_MINT` (10,000 USDT). */
export const FAUCET_MAX_USDT = 10_000;

export const suiscanTxUrl = (digest: string) =>
  `https://suiscan.xyz/${SUI_NETWORK}/tx/${digest}`;
