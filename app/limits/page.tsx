"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { ShieldCheck, Scale, Wallet, ArrowUpRight, Lock } from "lucide-react"
import { ConnectGate } from "@/components/connect-gate"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { readCreditProfile, type CreditProfileView } from "@/lib/bnpl"
import { SUI_NETWORK } from "@/lib/sui"

const LS_PROFILE = "xorr_bnpl_profile"

export default function LimitsPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const [profile, setProfile] = useState<CreditProfileView | null>(null)

  const refresh = useCallback(async () => {
    if (!account) return
    const id = typeof window !== "undefined" ? localStorage.getItem(LS_PROFILE) : null
    if (id) setProfile(await readCreditProfile(client, id).catch(() => null))
  }, [account, client])

  useEffect(() => { refresh() }, [refresh])

  const score = profile?.score ?? 0

  return (
    <ConnectGate>
      <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white max-w-5xl mx-auto">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Credit_Limits · sui_{SUI_NETWORK}</span>
          <h1 className="text-white text-3xl tracking-tighter font-black uppercase italic">Credit Identity</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-lg border border-primary/30 overflow-hidden shadow-2xl col-span-1 md:col-span-2 relative group">
            <div className="absolute top-0 right-0 p-6 opacity-5"><ShieldCheck className="w-32 h-32 text-primary" /></div>
            <div className="bg-primary/5 px-4 py-2 border-b border-primary/20 flex justify-between items-center">
              <span className="text-[10px] text-primary font-bold uppercase tracking-widest">Borrowing_Power</span>
              <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" /><span className="text-[10px] text-white/40">ON_CHAIN</span></div>
            </div>
            <div className="p-8 flex flex-col gap-2">
              <span className="text-[10px] text-white/40 uppercase">Available_Credit (USDT)</span>
              <div className="flex items-baseline gap-3">
                <span className="text-5xl md:text-6xl font-black tracking-tighter text-white">{profile ? profile.available.toLocaleString() : "—"}</span>
                <span className="text-primary font-bold text-sm tracking-widest uppercase">Available</span>
              </div>
              <p className="text-[10px] text-white/30 max-w-md mt-4 leading-relaxed">
                Your limit grows as you repay on time. It is attested to your on-chain CreditProfile by the XORR
                credit enclave — no manual increase requests needed.
              </p>
            </div>
          </div>

          <div className="glass-card rounded-lg border border-white/10 overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-white/5 px-4 py-2 border-b border-white/10 flex justify-between"><span className="text-[10px] text-white/40 uppercase tracking-widest">TEE_Score</span><Lock className="w-3 h-3 text-purple-400" /></div>
            <div className="p-8 flex flex-col items-center justify-center flex-1 gap-2">
              <div className="relative"><div className="text-5xl font-black tracking-tighter text-purple-400">{profile ? score : "—"}</div><div className="text-[10px] text-white/20 absolute -bottom-4 right-0 font-bold">MAX 850</div></div>
              <div className="mt-8 w-full bg-white/5 h-2 rounded-full overflow-hidden"><div className="h-full bg-purple-400 transition-all duration-1000" style={{ width: `${(score / 850) * 100}%` }} /></div>
              <span className="text-[10px] text-white/40 uppercase mt-2 tracking-[0.2em]">Private_Rating</span>
            </div>
          </div>
        </div>

        {!profile && (
          <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-8 flex flex-col items-center text-center gap-4">
            <Wallet className="size-8 text-primary/60" />
            <p className="text-sm text-foreground/50 max-w-sm">No credit profile detected. Open one in the money market to start building your limit and TEE score.</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link href="/lend-borrow" className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center justify-between hover:bg-primary/10 transition-colors group">
            <div className="flex items-center gap-4">
              <Scale className="text-primary" size={22} />
              <div>
                <div className="text-sm font-black uppercase tracking-widest text-primary">Open / Manage Credit</div>
                <p className="text-[11px] text-foreground/50 mt-1">Borrow against collateral or your TEE score.</p>
              </div>
            </div>
            <ArrowUpRight className="text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={18} />
          </Link>
          <Link href="/credit" className="bg-white/5 border border-border/40 rounded-3xl p-6 flex items-center justify-between hover:border-primary/40 transition-colors group">
            <div className="flex items-center gap-4">
              <ShieldCheck className="text-primary" size={22} />
              <div>
                <div className="text-sm font-black uppercase tracking-widest">Credit Dashboard</div>
                <p className="text-[11px] text-foreground/50 mt-1">See your score, limit, and open credit lines.</p>
              </div>
            </div>
            <ArrowUpRight className="text-foreground/40 group-hover:text-primary transition-colors" size={18} />
          </Link>
        </div>
      </div>
    </ConnectGate>
  )
}
