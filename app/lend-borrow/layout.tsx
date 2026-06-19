import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lend & Borrow",
  description: "Supply USDC to earn yield or borrow over- and under-collateralized assets against on-chain credit.",
  alternates: {
    canonical: "/lend-borrow",
  },
};

export default function LendBorrowLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
