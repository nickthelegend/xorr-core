import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Liquidity Pools",
  description: "Provide USDC liquidity to earn yield, check pool TVL, utilization rate, and historical APR.",
  alternates: {
    canonical: "/pools",
  },
};

export default function PoolsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
