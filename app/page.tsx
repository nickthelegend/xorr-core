"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  Zap, History, ShieldCheck, TrendingUp, CreditCard, Target,
  Loader2, Coins, ArrowUpRight, Shield, Wallet, Lock,
} from "lucide-react"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { readCreditProfile, USDT_COIN_TYPE, type CreditProfileView } from "@/lib/bnpl"
import { readLendingPool, readPositions, type LendingPoolStats, type OnChainPosition } from "@/lib/positions"
import { SUI_NETWORK, suiscanTxUrl } from "@/lib/sui"

const LS_PROFILE = "xorr_bnpl_profile"

const ACTIONS = [
  { href: "/bnpl", label: "Buy Now, Pay Never", desc: "Checkout with credit, repay from yield.", icon: CreditCard },
  { href: "/lend-borrow", label: "Lend / Borrow", desc: "Supply USDT or borrow on Sui.", icon: TrendingUp },
  { href: "/faucet", label: "Get Test USDT", desc: "Mint testnet USDT to try the flows.", icon: Coins },
]

export default function Page() {
  const account = useCurrentAccount()
  const client = useSuiClient()

  const [usdt, setUsdt] = useState(0)
  const [profile, setProfile] = useState<CreditProfileView | null>(null)
  const [pool, setPool] = useState<LendingPoolStats | null>(null)
  const [positions, setPositions] = useState<OnChainPosition[]>([])
  const [recent, setRecent] = useState<{ digest: string; status: string }[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const poolStats = await readLendingPool(client).catch(() => null)
      setPool(poolStats)
      if (!account) { setUsdt(0); setProfile(null); setPositions([]); setRecent([]); return }
      const [coins, pos, txs] = await Promise.all([
        client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE }),
        readPositions(client, account.address),
        client.queryTransactionBlocks({
          filter: { FromAddress: account.address },
          options: { showEffects: true },
          limit: 3,
          order: "descending",
        }).catch(() => ({ data: [] as Array<{ digest: string; effects?: { status?: { status?: string } } }> })),
      ])
      let total = BigInt(0)
      for (const c of coins.data) total += BigInt(c.balance)
      setUsdt(Number(total) / 1e6)
      setPositions(pos)
      setRecent(txs.data.map((t) => ({ digest: t.digest, status: (t.effects as { status?: { status?: string } } | undefined)?.status?.status ?? "unknown" })))
      const id = typeof window !== "undefined" ? localStorage.getItem(LS_PROFILE) : null
      setProfile(id ? await readCreditProfile(client, id).catch(() => null) : null)
    } finally {
      setLoading(false)
    }
  }, [account, client])

  useEffect(() => { refresh() }, [refresh])

  const totalBorrowed = positions.filter((p) => p.kind !== "supply").reduce((s, p) => s + p.amount, 0)
  const totalSupplied = positions.filter((p) => p.kind === "supply").reduce((s, p) => s + p.amount, 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-mono">
      <div className="lg:col-span-7 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Asset Overview</h2>
            <p className="text-xs text-foreground/40 uppercase tracking-widest">XORR // BNPL · Lend/Borrow · Private Credit · sui_{SUI_NETWORK}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-[10px] text-primary font-bold tracking-wider uppercase backdrop-blur-md">
            <div className={`w-1.5 h-1.5 rounded-full bg-primary ${loading ? "animate-ping" : "animate-pulse"}`} />
            {account ? "Live" : "Connect_Wallet"}
          </div>
        </div>

        <div className="relative group overflow-hidden bg-[#05080f]/50 border border-primary/20 rounded-3xl p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Shield size={120} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
            <div className="space-y-6">
              <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <CreditCard size={12} className="text-primary" />USDT_Balance
                </div>
                <div className="text-5xl font-black tracking-tighter text-foreground font-mono">
                  {account ? usdt.toLocaleString() : "—"}
                </div>
                <p className="text-[10px] text-foreground/20 italic mt-2">Read live from your connected Sui wallet.</p>
              </div>
              <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <History size={12} className="text-primary" />Supplied / Borrowed
                </div>
                <div className="text-3xl font-bold tracking-tight text-white/70">
                  {totalSupplied.toLocaleString()} <span className="text-foreground/30 text-lg">/ {totalBorrowed.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <Target size={12} className="text-primary" />TEE_Credit_Score
                </div>
                <div className="text-3xl font-bold tracking-tighter text-purple-400">
                  {profile ? profile.score : "—"}
                  <span className="text-[10px] text-foreground/20 ml-2">/ 850</span>
                </div>
                {profile && (
                  <p className="text-[10px] text-purple-400/60 uppercase tracking-widest mt-1">Limit: {profile.creditLimit} USDT · Available: {profile.available} USDT</p>
                )}
              </div>
              {!account && (
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-xl text-[10px] font-bold text-primary/60 uppercase tracking-widest w-fit">
                  <Wallet size={12} /> Connect to load your data
                </div>
              )}
            </div>
            <div className="flex flex-col justify-between space-y-8">
              <div className="bg-secondary/20 border border-border/40 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-foreground/50 uppercase tracking-widest">Pool_Available</span>
                  <span className="text-sm font-black text-primary px-2 py-0.5 rounded border border-primary/30">
                    {pool ? `${pool.available.toLocaleString()} USDT` : "—"}
                  </span>
                </div>
                <div className="h-2 bg-secondary/50 rounded-full overflow-hidden border border-border/10">
                  <div className="h-full bg-primary" style={{ width: pool && pool.totalSupplied > 0 ? `${Math.min(100, (pool.totalBorrowed / pool.totalSupplied) * 100)}%` : "0%" }} />
                </div>
                <div className="flex justify-between text-[10px] text-foreground/30 uppercase">
                  <span>Borrowed: {pool ? pool.totalBorrowed.toLocaleString() : "—"}</span>
                  <span>Supplied: {pool ? pool.totalSupplied.toLocaleString() : "—"}</span>
                </div>
              </div>
              <Link href="/pools" className="grid grid-cols-2 gap-4 group/pool">
                <div className="p-4 bg-background/40 border border-border/30 rounded-xl group-hover/pool:border-primary/30 transition-colors">
                  <div className="text-[9px] text-foreground/40 uppercase mb-1">Open Positions</div>
                  <div className="text-sm font-bold text-green-400">{positions.length}</div>
                </div>
                <div className="p-4 bg-background/40 border border-border/30 rounded-xl group-hover/pool:border-primary/30 transition-colors">
                  <div className="text-[9px] text-foreground/40 uppercase mb-1">Network</div>
                  <div className="text-sm font-bold text-primary uppercase">Sui {SUI_NETWORK}</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ACTIONS.map((item) => (
            <Link key={item.href} href={item.href} className="bg-card/30 border border-border/50 rounded-2xl p-6 hover:bg-card/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary"><item.icon size={18} /></div>
                <ArrowUpRight size={14} className="text-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <div className="text-lg font-bold">{item.label}</div>
              <div className="text-xs text-foreground/50 mt-1">{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
        {/* Private credit explainer / CTA */}
        <div className="bg-[#0d0f14] border border-border/30 rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2 p-5 bg-[#05080f]/60 border-b border-border/20">
            <Lock size={14} className="text-purple-400" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-purple-400/80">Private TEE Credit</span>
          </div>
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Borrow against your reputation</h3>
            <p className="text-xs text-foreground/50 leading-relaxed">
              XORR computes your credit score inside a confidential TEE and attests it on-chain. A strong score unlocks
              unsecured, collateral-free borrowing — your financial data never leaves the enclave.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/lend-borrow" className="flex items-center justify-center gap-2 bg-primary text-black py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-all">
                <TrendingUp size={14} /> Start Borrowing
              </Link>
              <Link href="/credit" className="flex items-center justify-center gap-2 bg-white/5 border border-border/40 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:border-primary/40 transition-all">
                <ShieldCheck size={14} /> My Credit
              </Link>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 italic">Recent_Activity</h3>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-foreground/30 uppercase">{account ? "Live" : "Idle"}</span>
              <div className={`w-1 h-1 rounded-full bg-primary ${loading ? "animate-ping" : ""}`} />
            </div>
          </div>
          <div className="space-y-6">
            {!account && <p className="text-[11px] text-foreground/30 uppercase tracking-widest text-center py-6">Connect your wallet to see activity</p>}
            {account && loading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary/60" /></div>}
            {account && !loading && recent.length === 0 && <p className="text-[11px] text-foreground/30 uppercase tracking-widest text-center py-6">No activity yet</p>}
            {account && !loading && recent.map((t) => (
              <a key={t.digest} href={suiscanTxUrl(t.digest)} target="_blank" rel="noopener noreferrer"
                className="flex gap-4 border-l-2 border-primary/20 pl-4 py-1 hover:border-primary transition-colors">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-primary/80 tracking-tighter">{t.digest.slice(0, 14)}…</div>
                  <div className="text-[9px] text-foreground/30 uppercase mt-1">{t.status} · View on Suiscan ↗</div>
                </div>
              </a>
            ))}
          </div>
          <Link href="/transactions" className="mt-8 block text-center text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 hover:text-primary transition-colors">
            View All Activity
          </Link>
        </div>
      </div>
    </div>
  )
}
