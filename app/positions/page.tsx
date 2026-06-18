"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ShieldCheck, Lock, TrendingUp, Database, Loader2,
  Coins, CreditCard, ArrowUpRight, RefreshCw, Wallet,
} from "lucide-react"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { readPositions, type OnChainPosition } from "@/lib/positions"
import { readCreditProfile, USDT_COIN_TYPE, type CreditProfileView } from "@/lib/bnpl"
import { SUI_NETWORK } from "@/lib/sui"

const LS_PROFILE = "xorr_bnpl_profile"

const ICONS: Record<OnChainPosition["kind"], React.ReactNode> = {
  bnpl: <CreditCard size={16} />,
  collateralized: <Lock size={16} />,
  unsecured: <ShieldCheck size={16} />,
  supply: <TrendingUp size={16} />,
}

const short = (id: string) => (id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id)

export default function PositionsPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()

  const [positions, setPositions] = useState<OnChainPosition[]>([])
  const [profile, setProfile] = useState<CreditProfileView | null>(null)
  const [usdt, setUsdt] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)
    try {
      const [pos, coins] = await Promise.all([
        readPositions(client, account.address),
        client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE }),
      ])
      let total = BigInt(0)
      for (const c of coins.data) total += BigInt(c.balance)
      setUsdt(Number(total) / 1e6)
      setPositions(pos)
      const profileId = typeof window !== "undefined" ? localStorage.getItem(LS_PROFILE) : null
      if (profileId) {
        try { setProfile(await readCreditProfile(client, profileId)) } catch { setProfile(null) }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read on-chain positions")
    } finally {
      setLoading(false)
    }
  }, [account, client])

  useEffect(() => { refresh() }, [refresh])

  const supplies = positions.filter((p) => p.kind === "supply")
  const borrows = positions.filter((p) => p.kind !== "supply")
  const totalBorrowed = borrows.reduce((s, p) => s + p.amount, 0)
  const totalSupplied = supplies.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // On_Chain_Positions · sui_{SUI_NETWORK}</span>
          <h1 className="text-3xl tracking-tighter font-black uppercase italic">Your Positions</h1>
        </div>
        <button onClick={refresh} disabled={loading || !account}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          ["USDT_Balance", usdt.toLocaleString()],
          ["Total_Supplied", totalSupplied.toLocaleString()],
          ["Total_Borrowed", totalBorrowed.toLocaleString()],
          ["TEE_Score", profile ? `${profile.score}` : "—"],
        ].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span>
            <span className="text-2xl font-light tracking-tighter">{v}</span>
          </div>
        ))}
      </div>

      {/* positions table */}
      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="grid grid-cols-12 bg-white/5 border-b border-border/20 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40 items-center">
          <div className="col-span-5">Position</div>
          <div className="col-span-3 text-right">Outstanding / Principal</div>
          <div className="col-span-2 text-right">Detail</div>
          <div className="col-span-2 text-right">Object</div>
        </div>
        <div className="divide-y divide-border/10">
          {!account && (
            <div className="px-8 py-14 text-center">
              <Wallet size={40} className="mx-auto text-foreground/20 mb-4" />
              <p className="text-sm text-foreground/40 uppercase tracking-widest">Connect your Sui wallet to view positions</p>
            </div>
          )}
          {account && loading && (
            <div className="px-8 py-14 text-center">
              <Loader2 size={28} className="mx-auto text-primary animate-spin mb-4" />
              <p className="text-sm text-foreground/40">Reading on-chain objects…</p>
            </div>
          )}
          {account && !loading && error && (
            <div className="px-8 py-14 text-center"><p className="text-sm text-red-400">{error}</p></div>
          )}
          {account && !loading && !error && positions.length === 0 && (
            <div className="px-8 py-14 text-center">
              <Database size={40} className="mx-auto text-foreground/20 mb-4" />
              <p className="text-sm text-foreground/40">No positions yet.</p>
              <div className="flex items-center justify-center gap-3 mt-5">
                <Link href="/bnpl" className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20">Try BNPL</Link>
                <Link href="/lend-borrow" className="px-4 py-2 rounded-xl bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40">Lend / Borrow</Link>
              </div>
            </div>
          )}
          {account && !loading && !error && positions.map((p) => (
            <div key={p.id} className="grid grid-cols-12 px-8 py-6 items-center hover:bg-primary/5 transition-colors">
              <div className="col-span-5 flex items-center gap-4">
                <div className={`p-2 rounded-lg border ${p.kind === "supply" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-primary/10 text-primary border-primary/20"}`}>
                  {ICONS[p.kind]}
                </div>
                <div>
                  <div className="text-sm font-bold text-white">{p.label}</div>
                  <div className="text-[10px] text-foreground/40 uppercase tracking-tighter mt-0.5">{p.kind}</div>
                </div>
              </div>
              <div className="col-span-3 text-right">
                <span className="text-sm font-bold tabular-nums">{p.amount.toLocaleString()}</span>
                <span className="text-[10px] text-foreground/30 ml-1">USDT</span>
              </div>
              <div className="col-span-2 text-right text-[11px] text-foreground/50 tabular-nums">
                {p.secondary != null ? `${p.secondary.toLocaleString()} USDT` : "—"}
              </div>
              <div className="col-span-2 flex justify-end">
                <a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${p.id}`} target="_blank" rel="noopener noreferrer"
                  className="text-[10px] text-primary/60 hover:text-primary flex items-center gap-1 font-bold underline">
                  {short(p.id)} <ArrowUpRight size={10} />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* manage links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/lend-borrow" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all group">
          <TrendingUp className="text-primary mb-3" size={20} />
          <div className="text-sm font-black uppercase tracking-widest">Manage Borrows</div>
          <p className="text-[11px] text-foreground/40 mt-1">Repay or reclaim collateral, open new positions.</p>
        </Link>
        <Link href="/bnpl" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all group">
          <CreditCard className="text-primary mb-3" size={20} />
          <div className="text-sm font-black uppercase tracking-widest">BNPL Checkout</div>
          <p className="text-[11px] text-foreground/40 mt-1">Buy now, repay from yield. Build your TEE score.</p>
        </Link>
        <Link href="/faucet" className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 hover:border-primary/40 transition-all group">
          <Coins className="text-primary mb-3" size={20} />
          <div className="text-sm font-black uppercase tracking-widest">Get Test USDT</div>
          <p className="text-[11px] text-foreground/40 mt-1">Mint testnet USDT to try the flows.</p>
        </Link>
      </div>
    </div>
  )
}
