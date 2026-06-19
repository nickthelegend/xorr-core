"use client"

import Link from "next/link"
import { TrendingUp, ShieldCheck, ArrowUpRight, Coins } from "lucide-react"
import { SUI_NETWORK } from "@/lib/sui"

export default function VaultsPage() {
  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Yield · sui_{SUI_NETWORK}</span>
        <h1 className="text-white text-3xl tracking-tighter font-black uppercase italic">Vaults</h1>
      </div>

      <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-10 flex flex-col items-center text-center gap-6 max-w-2xl mx-auto w-full">
        <div className="size-16 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
          <TrendingUp className="size-7 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black uppercase tracking-tighter">Yield is managed in Lend / Borrow</h2>
          <p className="text-sm text-foreground/50 leading-relaxed max-w-md">
            XORR consolidates yield into a single USDC lending pool on Sui. Supply USDC to earn interest from
            borrowers and routed DeepBook yield — no separate vault deposits required.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <Link href="/lend-borrow" className="flex items-center justify-center gap-2 bg-primary text-black px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] transition-all shadow-[0_0_20px_rgba(166,242,74,0.2)] w-full sm:w-auto">
            <TrendingUp size={15} /> Supply in Lend / Borrow
          </Link>
          <Link href="/pools" className="flex items-center justify-center gap-2 bg-white/5 border border-border/40 px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:border-primary/40 transition-all w-full sm:w-auto">
            View Pool Stats <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
        {[
          { icon: TrendingUp, title: "Earn Yield", desc: "Supply USDC, earn from borrower interest." },
          { icon: ShieldCheck, title: "Unlock Credit", desc: "Activity feeds your private TEE credit score." },
          { icon: Coins, title: "Test It Free", desc: "Mint testnet USDC from the faucet." },
        ].map((c) => (
          <div key={c.title} className="bg-[#05080f]/40 border border-border/40 rounded-2xl p-6 flex flex-col gap-2">
            <c.icon className="text-primary" size={20} />
            <div className="text-sm font-black uppercase tracking-widest mt-1">{c.title}</div>
            <p className="text-[11px] text-foreground/40">{c.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
