"use client";

import { PropsWithChildren } from "react";
import { createConfig, http, WagmiProvider } from "wagmi";
import { sepolia } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider, createNetworkConfig } from "@mysten/dapp-kit";
import "@mysten/dapp-kit/dist/index.css";
import { ThemeProvider } from "next-themes";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Toaster } from "sonner";
import { SUI_NETWORK, SUI_RPC_URLS } from "@/lib/sui";

// Sui networks for @mysten/dapp-kit.
const { networkConfig } = createNetworkConfig({
  testnet: { url: SUI_RPC_URLS.testnet, network: "testnet" },
  mainnet: { url: SUI_RPC_URLS.mainnet, network: "mainnet" },
  devnet: { url: SUI_RPC_URLS.devnet, network: "devnet" },
  localnet: { url: SUI_RPC_URLS.localnet, network: "localnet" },
});

// Dormant, connector-less wagmi config. The EVM wallet (RainbowKit / MetaMask)
// has been REMOVED — XORR now connects via Sui (@mysten/dapp-kit). This empty
// config (no connectors) only keeps the legacy EVM pages that haven't been
// ported to Sui yet (credit/borrow/vaults/positions/...) from throwing
// "useAccount must be used within WagmiProvider". Delete it once those pages
// are migrated to Sui.
const wagmiConfig = createConfig({
  chains: [sepolia],
  transports: { [sepolia.id]: http() },
});

const queryClient = new QueryClient();

export function Providers({ children }: PropsWithChildren) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <WagmiProvider config={wagmiConfig}>
          <SuiClientProvider networks={networkConfig} defaultNetwork={SUI_NETWORK}>
            <WalletProvider autoConnect>
              {children}
              <Toaster position="top-right" theme="dark" />
              <ToastContainer
                position="top-right"
                autoClose={5000}
                hideProgressBar={false}
                newestOnTop={false}
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
                theme="light"
              />
            </WalletProvider>
          </SuiClientProvider>
        </WagmiProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
