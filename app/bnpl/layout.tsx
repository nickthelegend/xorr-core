import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buy Now, Pay Never",
  description: "Checkout with on-chain credit on Sui. Collateral is deployed to earn yield that auto-repays the BNPL loan.",
  alternates: {
    canonical: "/bnpl",
  },
};

export default function BnplLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
