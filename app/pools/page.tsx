"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, TrendingUp, Info, ChevronRight, Loader2, Lock, ArrowUpRight } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { useSuiClient } from "@mysten/dapp-kit"
import { readLendingPool, type LendingPoolStats } from "@/lib/positions"
import { BNPL_POOL_ID } from "@/lib/bnpl"
import { SUI_NETWORK } from "@/lib/sui"

function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function PoolsPage() {
  const client = useSuiClient()
  const [stats, setStats] = useState<LendingPoolStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    readLendingPool(client)
      .then((s) => { if (active) { setStats(s); if (!s) setError("Pool object not found") } })
      .catch((e) => { if (active) setError(e instanceof Error ? e.message : "Failed to read pool") })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [client])

  const utilization =
    stats && stats.totalSupplied > 0 ? Math.min(100, (stats.totalBorrowed / stats.totalSupplied) * 100) : 0

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Markets · sui_{SUI_NETWORK}</span>
        <h1 className="text-white text-3xl tracking-tighter font-black uppercase italic">Lending Pool</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-[#05080f]/40 border border-primary/20 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-2 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5"><ShieldCheck size={80} /></div>
          <span className="text-[10px] text-foreground/40 uppercase tracking-widest">Total_Supplied</span>
          <div className="text-3xl font-bold tracking-tight">
            {loading ? <Loader2 size={22} className="animate-spin text-foreground/30" /> : stats ? `${fmt(stats.totalSupplied)} USDT` : "—"}
          </div>
          <div className="text-[10px] text-primary/60 flex items-center gap-1 mt-2">
            <TrendingUp size={12} /> Pooled liquidity
          </div>
        </div>
        <div className="bg-[#05080f]/40 border border-border/40 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-2">
          <span className="text-[10px] text-foreground/40 uppercase tracking-widest">Total_Borrowed</span>
          <div className="text-3xl font-bold tracking-tight text-red-400">
            {loading ? <Loader2 size={22} className="animate-spin text-foreground/30" /> : stats ? `${fmt(stats.totalBorrowed)} USDT` : "—"}
          </div>
        </div>
        <div className="bg-[#05080f]/40 border border-border/40 rounded-2xl p-6 backdrop-blur-md flex flex-col gap-2">
          <span className="text-[10px] text-foreground/40 uppercase tracking-widest">Available</span>
          <div className="text-3xl font-bold tracking-tight text-primary">
            {loading ? <Loader2 size={22} className="animate-spin text-foreground/30" /> : stats ? `${fmt(stats.available)} USDT` : "—"}
          </div>
        </div>
      </div>

      {/* Pool row */}
      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="grid grid-cols-12 bg-white/5 border-b border-border/20 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
          <div className="col-span-4">Asset</div>
          <div className="col-span-2 text-right">Supplied</div>
          <div className="col-span-2 text-right">Borrowed</div>
          <div className="col-span-2 text-right">Utilization</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>
        <div className="divide-y divide-border/10">
          {error && !stats && (
            <div className="px-8 py-10 text-center text-sm text-foreground/40">
              {error}. The demo pool may not be reachable on {SUI_NETWORK}.
            </div>
          )}
          {(!error || stats) && (
            <div className="grid grid-cols-12 px-8 py-6 items-center hover:bg-primary/5 transition-colors">
              <div className="col-span-4 flex items-center gap-3">
                <TokenIcon symbol="USDT" size={24} className="flex-shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white">USDT</div>
                  <div className="text-[10px] text-foreground/40 italic">XORR Demo Pool</div>
                </div>
              </div>
              <div className="col-span-2 text-right text-sm font-bold text-green-400">
                {stats ? fmt(stats.totalSupplied) : "—"}
              </div>
              <div className="col-span-2 text-right text-sm font-bold text-red-400">
                {stats ? fmt(stats.totalBorrowed) : "—"}
              </div>
              <div className="col-span-2 text-right text-sm font-mono text-white/80">
                {stats ? `${utilization.toFixed(1)}%` : "—"}
              </div>
              <div className="col-span-2 flex justify-end items-center gap-2">
                <Link href="/lend-borrow"
                  className="px-3 py-1.5 rounded-lg border border-primary/20 bg-primary/5 text-primary text-[10px] font-bold uppercase tracking-wider hover:bg-primary/20 transition-all">
                  Supply
                </Link>
                <Link href="/lend-borrow"
                  className="px-3 py-1.5 rounded-lg border border-border/30 bg-secondary/20 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-secondary/40 transition-all">
                  Borrow
                </Link>
                <ChevronRight size={14} className="text-foreground/20" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pool object link + utilization bar */}
      {stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-[#0d0f14] border border-border/30 rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Utilization</span>
              <span className="text-[10px] text-primary font-bold">{utilization.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-secondary/40 rounded-full overflow-hidden border border-border/10">
              <div className="h-full bg-primary transition-all" style={{ width: `${utilization}%` }} />
            </div>
            <a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${BNPL_POOL_ID}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] text-primary/60 hover:text-primary font-bold underline pt-2">
              <Lock size={11} /> View pool object on Suiscan <ArrowUpRight size={11} />
            </a>
          </div>
          <Link href="/lend-borrow" className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex flex-col justify-between hover:bg-primary/10 transition-colors group">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Open the Money Market</p>
              <p className="text-[11px] text-foreground/50 leading-relaxed mt-2">
                Supply USDT to earn yield, or borrow against collateral or your private TEE credit score.
              </p>
            </div>
            <div className="flex items-center justify-end mt-4">
              <ChevronRight size={18} className="text-primary group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      )}

      <div className="flex items-start gap-4 p-6 rounded-2xl bg-primary/5 border border-primary/10">
        <Info className="text-primary flex-shrink-0" size={20} />
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">Protocol Notice</p>
          <p className="text-[11px] text-foreground/50 leading-relaxed">
            Pool figures are read live from the on-chain LendingPool object on Sui {SUI_NETWORK}. All supply, borrow, and repay actions execute as Sui transactions from the Lend / Borrow market.
          </p>
        </div>
      </div>
    </div>
  )
}
