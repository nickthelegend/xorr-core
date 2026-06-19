import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Testnet USDC Faucet",
  description: "Mint test USDC to try XORR's private credit and BNPL flows on the Sui testnet.",
  alternates: {
    canonical: "/faucet",
  },
};

export default function FaucetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
