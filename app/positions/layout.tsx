import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Positions",
  description: "Manage your active loans, collateral, supplied assets, and credit status.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PositionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
