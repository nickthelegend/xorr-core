import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: { hash: string };
}): Promise<Metadata> {
  const hash = params.hash;
  const shortHash = hash ? `${hash.slice(0, 8)}...` : "";
  return {
    title: `Payment Invoice ${shortHash}`,
    description: `Pay this invoice securely using XORR Finance on Sui.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
