import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Activity",
  description: "Review your history of mints, collateral deposits, loan drawdowns, and repayments.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
