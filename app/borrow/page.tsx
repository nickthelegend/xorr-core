"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { ShieldCheck, Lock, Loader2, Wallet, X, CreditCard } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { useTx } from "@/lib/use-tx"
import { readPositions, type OnChainPosition } from "@/lib/positions"
import { readCreditProfile, type CreditProfileView } from "@/lib/bnpl"
import { TOKEN_POOLS, borrowFromPoolTx, repayCollateralizedToPoolTx, poolForType, type TokenPool } from "@/lib/token-pools"
import { borrowUncollateralizedTx, repayUncollateralizedTx } from "@/lib/market"
import { SUI_NETWORK } from "@/lib/sui"

const LS_PROFILE = "xorr_bnpl_profile"
const fmt = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toLocaleString(undefined, { maximumFractionDigits: 2 }))
type Bal = { total: number; primary: string | null }

export default function BorrowPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const runTx = useTx()

  const [bals, setBals] = useState<Record<string, Bal>>({})
  const [positions, setPositions] = useState<OnChainPosition[]>([])
  const [profile, setProfile] = useState<CreditProfileView | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [pool, setPool] = useState<TokenPool>(TOKEN_POOLS[0])
  const [mode, setMode] = useState<"collateralized" | "unsecured">("collateralized")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!account) { setLoading(false); return }
    setLoading(true)
    const id = localStorage.getItem(LS_PROFILE)
    setProfileId(id)
    const b: Record<string, Bal> = {}
    await Promise.all(TOKEN_POOLS.map(async (p) => {
      const coins = await client.getCoins({ owner: account.address, coinType: p.coinType }).catch(() => ({ data: [] }))
      let total = BigInt(0), best: string | null = null, bestBal = BigInt(0)
      for (const c of coins.data) { const x = BigInt(c.balance); total += x; if (x > bestBal) { bestBal = x; best = c.coinObjectId } }
      b[p.symbol] = { total: Number(total) / 10 ** p.decimals, primary: best }
    }))
    setBals(b)
    const pos = await readPositions(client, account.address).catch(() => [])
    setPositions(pos.filter((p) => p.kind === "collateralized" || p.kind === "unsecured"))
    if (id) setProfile(await readCreditProfile(client, id).catch(() => null))
    setLoading(false)
  }, [client, account])

  useEffect(() => { refresh() }, [refresh])

  const score = profile?.score ?? 0
  const canUnsecured = mode === "unsecured" && pool.symbol === "USDC" && !!profileId && score >= 600

  const onBorrow = async () => {
    if (!account) return
    const amt = Number(amount)
    if (!(amt > 0)) return
    setBusy(true)
    try {
      if (mode === "unsecured") {
        if (!profileId) return
        await runTx(`Borrow ${fmt(amt)} USDC (unsecured · TEE)`, borrowUncollateralizedTx(profileId, amt, account.address))
      } else {
        const bal = bals[pool.symbol]
        if (!bal?.primary) return
        await runTx(`Borrow ${fmt(amt)} ${pool.symbol} (collateralized)`, borrowFromPoolTx(pool, bal.primary, amt, Math.ceil(amt * 1.5 * 100) / 100, account.address))
      }
      setOpen(false); await refresh()
    } catch { /* toast */ } finally { setBusy(false) }
  }

  const onRepay = async (p: OnChainPosition) => {
    if (!account || !profileId) return
    const tp = poolForType(p.objectType)
    const bal = bals[tp.symbol]
    if (!bal?.primary) return
    setBusy(true)
    try {
      const tx = p.kind === "unsecured"
        ? repayUncollateralizedTx(p.id, profileId, bal.primary, p.amount, account.address)
        : repayCollateralizedToPoolTx(tp, p.id, profileId, bal.primary, p.amount, account.address)
      await runTx(`Repay ${fmt(p.amount)} ${tp.symbol}`, tx); await refresh()
    } catch { /* toast */ } finally { setBusy(false) }
  }

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Borrow · sui_{SUI_NETWORK}</span>
          <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Borrow</h1>
        </div>
        <button onClick={() => { setOpen(true); setAmount(""); setMode("collateralized"); setPool(TOKEN_POOLS[0]) }} disabled={!account}
          className="px-6 h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 flex items-center gap-2">
          <CreditCard size={15} /> New Borrow
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["TEE_Score", profile ? `${score}` : "—"], ["Credit_Limit", profile ? `${fmt(profile.creditLimit)} USDC` : "—"], ["Available", profile ? `${fmt(profile.available)} USDC` : "—"], ["Outstanding", profile ? `${fmt(profile.outstanding)} USDC` : "—"]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1"><span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span><span className="text-2xl font-light tracking-tighter">{v}</span></div>
        ))}
      </div>

      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden">
        <div className="px-8 py-4 border-b border-border/20 text-[10px] font-black uppercase tracking-widest text-foreground/40">Open Borrows</div>
        {!account ? (
          <div className="px-8 py-12 text-center flex flex-col items-center gap-3"><Wallet size={32} className="text-foreground/20" /><p className="text-sm text-foreground/40 uppercase tracking-widest">Connect your wallet to borrow</p></div>
        ) : loading ? (
          <div className="px-8 py-12 text-center"><Loader2 className="mx-auto animate-spin text-primary/60" /></div>
        ) : positions.length === 0 ? (
          <div className="px-8 py-12 text-center text-sm text-foreground/40">No open borrows. Hit <span className="text-primary">New Borrow</span> to start, or <Link href="/lend" className="text-primary underline">lend</Link> to earn.</div>
        ) : (
          <div className="divide-y divide-border/10">
            {positions.map((p) => {
              const tp = poolForType(p.objectType)
              return (
                <div key={p.id} className="px-8 py-5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border ${p.kind === "unsecured" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-primary/10 text-primary border-primary/20"}`}>
                      {p.kind === "unsecured" ? <ShieldCheck size={15} /> : <Lock size={15} />}
                    </div>
                    <div>
                      <div className="text-sm font-bold">{p.label}</div>
                      <a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${p.id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary/50 hover:text-primary font-mono">{p.id.slice(0, 10)}… ↗</a>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold tabular-nums">{fmt(p.amount)} {tp.symbol}</span>
                    <button onClick={() => onRepay(p)} disabled={busy}
                      className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40">Repay</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <p className="text-[11px] text-foreground/40 leading-relaxed max-w-2xl">
        Borrow over-collateralized against any market token (lock 150%), or unsecured against your private
        <Link href="/credit" className="text-purple-400 hover:underline"> TEE credit score</Link> (≥600 unlocks collateral-free USDC). Repayments grow your credit limit.
      </p>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-md bg-[#0d0f14] border border-primary/20 rounded-3xl p-6 font-mono shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5"><h2 className="text-lg font-black uppercase tracking-tighter">New Borrow</h2><button onClick={() => !busy && setOpen(false)} className="text-foreground/40 hover:text-white"><X size={18} /></button></div>

            <div className="flex gap-2 mb-4">
              <button onClick={() => setMode("collateralized")} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${mode === "collateralized" ? "bg-primary text-black border-primary" : "bg-white/5 border-border/40"}`}>Collateralized</button>
              <button onClick={() => { setMode("unsecured"); setPool(TOKEN_POOLS[0]) }} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border ${mode === "unsecured" ? "bg-purple-500 text-white border-purple-500" : "bg-white/5 border-border/40"}`}>Unsecured · TEE</button>
            </div>

            {mode === "collateralized" && (
              <div className="flex gap-2 mb-4">
                {TOKEN_POOLS.map((p) => (
                  <button key={p.symbol} onClick={() => setPool(p)} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-bold border ${pool.symbol === p.symbol ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/5 border-border/40"}`}>
                    <TokenIcon symbol={p.symbol} size={16} /> {p.symbol}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 focus-within:border-primary/40 mb-3">
              <input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent text-3xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none" />
            </div>

            {mode === "collateralized"
              ? <p className="text-[10px] text-amber-400/70 mb-4 flex items-center gap-1.5"><Lock size={12} /> Locks {fmt((Number(amount) || 0) * 1.5)} {pool.symbol} collateral (150%). You hold {fmt(bals[pool.symbol]?.total ?? 0)} {pool.symbol}.</p>
              : <p className="text-[10px] text-purple-400/70 mb-4 flex items-center gap-1.5"><ShieldCheck size={12} /> Collateral-free USDC, gated by your TEE score ({score}). {!profileId ? "Open a credit profile first." : score < 600 ? "Need ≥600 — request a TEE score on /credit." : "Unlocked."}</p>}

            <button onClick={onBorrow} disabled={busy || !(Number(amount) > 0) || (mode === "unsecured" && !canUnsecured) || (mode === "collateralized" && !bals[pool.symbol]?.primary)}
              className="w-full py-4 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 transition-all flex items-center justify-center gap-2">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null} Confirm Borrow
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
