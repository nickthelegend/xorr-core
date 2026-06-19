"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck, TrendingUp, Info, Loader2, ArrowUpRight, Wallet, X } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { useTx } from "@/lib/use-tx"
import { readLendingPool, type LendingPoolStats } from "@/lib/positions"
import { TOKEN_POOLS, supplyToPoolTx, borrowFromPoolTx, type TokenPool } from "@/lib/token-pools"
import { SUI_NETWORK } from "@/lib/sui"

function fmt(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

type Bal = { total: number; primary: string | null }

export default function PoolsPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const runTx = useTx()

  const [stats, setStats] = useState<Record<string, LendingPoolStats | null>>({})
  const [bals, setBals] = useState<Record<string, Bal>>({})
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ pool: TokenPool; action: "supply" | "borrow" } | null>(null)
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const s: Record<string, LendingPoolStats | null> = {}
    const b: Record<string, Bal> = {}
    await Promise.all(TOKEN_POOLS.map(async (p) => {
      s[p.symbol] = await readLendingPool(client, p.poolId).catch(() => null)
      if (account) {
        const coins = await client.getCoins({ owner: account.address, coinType: p.coinType }).catch(() => ({ data: [] }))
        let total = BigInt(0), best: string | null = null, bestBal = BigInt(0)
        for (const c of coins.data) { const x = BigInt(c.balance); total += x; if (x > bestBal) { bestBal = x; best = c.coinObjectId } }
        b[p.symbol] = { total: Number(total) / 10 ** p.decimals, primary: best }
      }
    }))
    setStats(s); setBals(b); setLoading(false)
  }, [client, account])

  useEffect(() => { refresh() }, [refresh])

  const openModal = (pool: TokenPool, action: "supply" | "borrow") => { setModal({ pool, action }); setAmount("") }

  const confirm = async () => {
    if (!modal || !account) return
    const { pool, action } = modal
    const amt = Number(amount)
    const bal = bals[pool.symbol]
    if (!(amt > 0) || !bal?.primary) return
    setBusy(true)
    try {
      const tx = action === "supply"
        ? supplyToPoolTx(pool, bal.primary, amt, account.address)
        : borrowFromPoolTx(pool, bal.primary, amt, Math.ceil(amt * 1.5 * 100) / 100, account.address)
      await runTx(`${action === "supply" ? "Supply" : "Borrow"} ${fmt(amt)} ${pool.symbol}`, tx)
      setModal(null)
      await refresh()
    } catch { /* toast shown */ } finally { setBusy(false) }
  }

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Markets · sui_{SUI_NETWORK}</span>
        <h1 className="text-white text-3xl tracking-tighter font-black uppercase">Lending Pools</h1>
      </div>

      {/* Your balances */}
      {account && (
        <div className="grid grid-cols-3 gap-4">
          {TOKEN_POOLS.map((p) => (
            <div key={p.symbol} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex items-center gap-3">
              <TokenIcon symbol={p.symbol} size={28} className="flex-shrink-0" />
              <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-widest">Your {p.symbol}</div>
                <div className="text-lg font-bold">{loading ? "…" : fmt(bals[p.symbol]?.total ?? 0)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pool table */}
      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="grid grid-cols-12 bg-white/5 border-b border-border/20 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
          <div className="col-span-4">Asset</div>
          <div className="col-span-2 text-right">Supplied</div>
          <div className="col-span-2 text-right">Available</div>
          <div className="col-span-4 text-right">Actions</div>
        </div>
        <div className="divide-y divide-border/10">
          {TOKEN_POOLS.map((p) => {
            const st = stats[p.symbol]
            return (
              <div key={p.symbol} className="grid grid-cols-12 px-8 py-6 items-center hover:bg-primary/5 transition-colors">
                <div className="col-span-4 flex items-center gap-3">
                  <TokenIcon symbol={p.symbol} size={28} className="flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      {p.symbol}
                      {p.strategy === "DeepBook" && (
                        <span className="text-[8px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded px-1.5 py-0.5">DeepBook</span>
                      )}
                    </div>
                    <div className="text-[10px] text-foreground/40 max-w-[260px] leading-tight mt-0.5">{p.note}</div>
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm font-bold text-green-400">{loading ? "…" : st ? fmt(st.totalSupplied) : "—"}</div>
                <div className="col-span-2 text-right text-sm font-bold text-primary">{loading ? "…" : st ? fmt(st.available) : "—"}</div>
                <div className="col-span-4 flex justify-end items-center gap-2">
                  <button onClick={() => openModal(p, "supply")} disabled={!account}
                    className="px-4 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 disabled:opacity-40 transition-all">
                    Supply
                  </button>
                  <button onClick={() => openModal(p, "borrow")} disabled={!account}
                    className="px-4 py-1.5 rounded-lg border border-border/30 bg-secondary/20 text-white text-[10px] font-black uppercase tracking-wider hover:bg-secondary/40 disabled:opacity-40 transition-all">
                    Borrow
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {!account && (
        <div className="flex items-center gap-3 p-6 rounded-2xl bg-primary/5 border border-primary/10">
          <Wallet className="text-primary flex-shrink-0" size={18} />
          <p className="text-[11px] text-foreground/50">Connect your Sui wallet to supply or borrow.</p>
        </div>
      )}

      <div className="flex items-start gap-4 p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
        <Info className="text-cyan-300 flex-shrink-0" size={20} />
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">DeepBook strategy</p>
          <p className="text-[11px] text-foreground/50 leading-relaxed">
            DUSDC and DEEP supplied here are earmarked for the DeepBook market-making strategy: the pool routes liquidity
            into DeepBook and the trading yield accrues to suppliers&apos; share value. Pool figures read live from the
            on-chain LendingPool objects on Sui {SUI_NETWORK}.
          </p>
        </div>
      </div>

      {/* Supply / Borrow modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !busy && setModal(null)}>
          <div className="w-full max-w-md bg-[#0d0f14] border border-primary/20 rounded-3xl p-6 font-mono shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <TokenIcon symbol={modal.pool.symbol} size={28} />
                <div>
                  <h2 className="text-lg font-black uppercase tracking-tighter">{modal.action === "supply" ? "Supply" : "Borrow"} {modal.pool.symbol}</h2>
                  {modal.pool.strategy === "DeepBook" && modal.action === "supply" && (
                    <span className="text-[9px] text-cyan-300 uppercase tracking-widest">→ DeepBook strategy</span>
                  )}
                </div>
              </div>
              <button onClick={() => !busy && setModal(null)} className="text-foreground/40 hover:text-white"><X size={18} /></button>
            </div>

            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-foreground/40 mb-2">
              <span>Your balance</span>
              <button onClick={() => setAmount(String(bals[modal.pool.symbol]?.total ?? 0))} className="text-primary/70 hover:text-primary font-bold">
                {fmt(bals[modal.pool.symbol]?.total ?? 0)} {modal.pool.symbol}
              </button>
            </div>
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 focus-within:border-primary/40 transition-all mb-4">
              <input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00"
                className="w-full bg-transparent text-3xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none" />
            </div>

            {modal.action === "borrow" && (
              <p className="text-[10px] text-amber-400/70 mb-4 flex items-center gap-1.5">
                <ShieldCheck size={12} /> Locks {fmt((Number(amount) || 0) * 1.5)} {modal.pool.symbol} as collateral (150%).
              </p>
            )}
            {modal.action === "supply" && modal.pool.strategy === "DeepBook" && (
              <p className="text-[10px] text-cyan-300/70 mb-4 flex items-center gap-1.5">
                <TrendingUp size={12} /> Routed to the DeepBook market-making strategy — yield accrues to your supply.
              </p>
            )}

            <button onClick={confirm}
              disabled={busy || !(Number(amount) > 0) || !bals[modal.pool.symbol]?.primary || Number(amount) > (bals[modal.pool.symbol]?.total ?? 0) * (modal.action === "borrow" ? 1 / 1.5 : 1)}
              className="w-full py-4 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 transition-all flex items-center justify-center gap-2">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}
              {modal.action === "supply" ? "Confirm Supply" : "Confirm Borrow"}
            </button>
            {!bals[modal.pool.symbol]?.primary && (
              <p className="text-[10px] text-foreground/40 text-center mt-3">You have no {modal.pool.symbol}. {modal.pool.symbol === "USDC" ? "Mint some from the faucet." : "Acquire some first."}</p>
            )}
            <a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${modal.pool.poolId}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center justify-center gap-1 text-[9px] text-foreground/30 hover:text-primary">
              pool object <ArrowUpRight size={10} />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
