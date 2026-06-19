import type { Metadata } from "next";
import JsonLd from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Private TEE Credit Score",
  description: "A secure, confidential credit score computed inside an AWS Nitro enclave and attested on-chain.",
  alternates: {
    canonical: "/credit",
  },
};

export default function CreditLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd type="faq" />
      {children}
    </>
  );
}
