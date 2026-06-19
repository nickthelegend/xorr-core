"use client"

import { use } from "react"
import Link from "next/link"
import { ArrowLeft, TrendingUp, ChevronRight } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"

export default function PoolPairPage({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = use(params)
  const symbol = (pair || "usdc").toUpperCase()

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <Link href="/pools" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-widest text-foreground/40 hover:text-primary transition-colors w-fit">
        <ArrowLeft size={14} /> Back to Pools
      </Link>

      <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-10 flex flex-col items-center text-center gap-6 max-w-2xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <TokenIcon symbol={symbol} size={36} className="flex-shrink-0" />
          <div className="text-left">
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">{symbol} Pool</h1>
            <p className="text-[10px] text-foreground/40 uppercase tracking-widest">XORR Money Market</p>
          </div>
        </div>

        <p className="text-sm text-foreground/50 leading-relaxed max-w-md">
          XORR runs a single unified USDC lending pool on Sui. Supply, borrow, repay, and manage collateral —
          including unsecured TEE-backed credit — all happen in the money market.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <Link href="/lend-borrow" className="flex items-center justify-center gap-2 bg-primary text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(166,242,74,0.2)] w-full sm:w-auto">
            <TrendingUp size={15} /> Open Money Market
          </Link>
          <Link href="/pools" className="flex items-center justify-center gap-2 bg-white/5 border border-border/40 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-primary/40 transition-all w-full sm:w-auto">
            Pool Stats <ChevronRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  )
}
