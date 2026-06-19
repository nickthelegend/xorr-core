"use client"

import Link from "next/link"
import { Store, ShieldCheck, CreditCard, ArrowUpRight } from "lucide-react"
import { ConnectGate } from "@/components/connect-gate"
import { useCurrentAccount } from "@mysten/dapp-kit"
import { SUI_NETWORK } from "@/lib/sui"

export default function MerchantPage() {
  const account = useCurrentAccount()

  return (
    <ConnectGate>
      <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Merchant · sui_{SUI_NETWORK}</span>
          <h1 className="text-white text-3xl tracking-tighter font-black uppercase italic">Merchant Hub</h1>
        </div>

        <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-10 flex flex-col items-center text-center gap-6 max-w-2xl mx-auto w-full">
          <div className="size-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Store className="size-7 text-primary" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black uppercase tracking-tighter">Accept BNPL on Sui</h2>
            <p className="text-sm text-foreground/50 leading-relaxed max-w-md">
              Customers settle bills in USDC directly to your Sui address. Payments confirm on-chain and are
              auditable on Suiscan — no custodial escrow, no EVM bridge.
            </p>
          </div>

          {account && (
            <div className="w-full bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex items-center justify-between">
              <span className="text-[10px] text-foreground/40 uppercase tracking-widest">Your_Sui_Address</span>
              <span className="text-[11px] text-white font-bold truncate ml-3">{account.address.slice(0, 10)}…{account.address.slice(-8)}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
            <Link href="/bnpl" className="flex items-center justify-center gap-2 bg-primary text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(166,242,74,0.2)] w-full sm:w-auto">
              <CreditCard size={15} /> Try the BNPL Flow
            </Link>
            <Link href="/transactions" className="flex items-center justify-center gap-2 bg-white/5 border border-border/40 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-primary/40 transition-all w-full sm:w-auto">
              View Settlements <ArrowUpRight size={15} />
            </Link>
          </div>
        </div>

        <div className="flex items-start gap-4 p-6 rounded-2xl bg-primary/5 border border-primary/10 max-w-2xl mx-auto w-full">
          <ShieldCheck className="text-primary flex-shrink-0" size={20} />
          <p className="text-[11px] text-foreground/50 leading-relaxed">
            Bill links open the checkout at <span className="text-primary">/pay/&lt;hash&gt;</span>, where the customer
            pays you in USDC on Sui {SUI_NETWORK}. Configure your settlement address per bill or via
            NEXT_PUBLIC_XORR_MERCHANT_ADDRESS.
          </p>
        </div>
      </div>
    </ConnectGate>
  )
}
