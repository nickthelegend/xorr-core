"use client"

import { useCallback, useEffect, useState } from "react"
import { TrendingUp, Info, Loader2, ArrowUpRight, Wallet, X, Sparkles } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { useTx } from "@/lib/use-tx"
import { readLendingPool, readPositions, type LendingPoolStats, type OnChainPosition } from "@/lib/positions"
import { TOKEN_POOLS, supplyToPoolTx, harvestYieldTx, withdrawFromPoolTx, type TokenPool } from "@/lib/token-pools"
import { SUI_NETWORK } from "@/lib/sui"

const fmt = (v: number) => (v >= 1_000 ? `${(v / 1_000).toFixed(1)}K` : v.toLocaleString(undefined, { maximumFractionDigits: 2 }))
type Bal = { total: number; primary: string | null }
type Action = "supply" | "harvest"

export default function LendPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const runTx = useTx()

  const [stats, setStats] = useState<Record<string, LendingPoolStats | null>>({})
  const [bals, setBals] = useState<Record<string, Bal>>({})
  const [supplies, setSupplies] = useState<OnChainPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<{ pool: TokenPool; action: Action } | null>(null)
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
    setStats(s); setBals(b)
    if (account) setSupplies((await readPositions(client, account.address).catch(() => [])).filter((p) => p.kind === "supply"))
    setLoading(false)
  }, [client, account])

  useEffect(() => { refresh() }, [refresh])

  const poolFor = (objectType: string) => TOKEN_POOLS.find((p) => objectType.includes(p.coinType)) ?? TOKEN_POOLS[0]

  const confirm = async () => {
    if (!modal || !account) return
    const { pool, action } = modal
    const amt = Number(amount)
    const bal = bals[pool.symbol]
    if (!(amt > 0) || !bal?.primary) return
    setBusy(true)
    try {
      const tx = action === "supply" ? supplyToPoolTx(pool, bal.primary, amt, account.address) : harvestYieldTx(pool, bal.primary, amt)
      await runTx(`${action === "supply" ? "Supply" : "Harvest DeepBook yield"} ${fmt(amt)} ${pool.symbol}`, tx)
      setModal(null); await refresh()
    } catch { /* toast */ } finally { setBusy(false) }
  }

  const onWithdraw = async (pos: OnChainPosition) => {
    if (!account) return
    const pool = poolFor(pos.objectType)
    setBusy(true)
    try { await runTx(`Withdraw ${pool.symbol}`, withdrawFromPoolTx(pool, pos.id, account.address)); await refresh() }
    catch { /* toast */ } finally { setBusy(false) }
  }

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Lend · sui_{SUI_NETWORK}</span>
        <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase">Lend &amp; Earn</h1>
      </div>

      {account && (
        <div className="grid grid-cols-3 gap-4">
          {TOKEN_POOLS.map((p) => (
            <div key={p.symbol} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex items-center gap-3">
              <TokenIcon symbol={p.symbol} size={28} className="flex-shrink-0" />
              <div><div className="text-[10px] text-foreground/40 uppercase tracking-widest">Your {p.symbol}</div><div className="text-lg font-bold">{loading ? "…" : fmt(bals[p.symbol]?.total ?? 0)}</div></div>
            </div>
          ))}
        </div>
      )}

      {/* Supply markets */}
      <div className="bg-card/20 border border-border/40 rounded-3xl overflow-hidden backdrop-blur-sm shadow-2xl">
        <div className="grid grid-cols-12 bg-white/5 border-b border-border/20 px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
          <div className="col-span-5">Asset</div>
          <div className="col-span-2 text-right">Supplied</div>
          <div className="col-span-2 text-right">Available</div>
          <div className="col-span-3 text-right">Actions</div>
        </div>
        <div className="divide-y divide-border/10">
          {TOKEN_POOLS.map((p) => {
            const st = stats[p.symbol]
            return (
              <div key={p.symbol} className="grid grid-cols-12 px-8 py-6 items-center hover:bg-primary/5 transition-colors">
                <div className="col-span-5 flex items-center gap-3">
                  <TokenIcon symbol={p.symbol} size={28} className="flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">{p.symbol}
                      {p.strategy === "DeepBook" && <span className="text-[8px] font-black uppercase tracking-widest text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 rounded px-1.5 py-0.5">DeepBook</span>}
                    </div>
                    <div className="text-[10px] text-foreground/40 max-w-[280px] leading-tight mt-0.5">{p.note}</div>
                  </div>
                </div>
                <div className="col-span-2 text-right text-sm font-bold text-green-400">{loading ? "…" : st ? fmt(st.totalSupplied) : "—"}</div>
                <div className="col-span-2 text-right text-sm font-bold text-primary">{loading ? "…" : st ? fmt(st.available) : "—"}</div>
                <div className="col-span-3 flex justify-end items-center gap-2">
                  <button onClick={() => { setModal({ pool: p, action: "supply" }); setAmount("") }} disabled={!account}
                    className="px-4 py-1.5 rounded-lg border border-primary/30 bg-primary/10 text-primary text-[10px] font-black uppercase tracking-wider hover:bg-primary/20 disabled:opacity-40 transition-all">Supply</button>
                  {p.strategy === "DeepBook" && (
                    <button onClick={() => { setModal({ pool: p, action: "harvest" }); setAmount("") }} disabled={!account} title="Inject realized DeepBook fees as yield"
                      className="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-300 text-[10px] font-black uppercase tracking-wider hover:bg-cyan-500/20 disabled:opacity-40 transition-all flex items-center gap-1"><Sparkles size={11} /> Harvest</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Your supply positions */}
      {account && supplies.length > 0 && (
        <div className="bg-[#0d0f14] border border-border/30 rounded-3xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/20 text-[10px] font-black uppercase tracking-widest text-foreground/40">Your Supply Positions</div>
          <div className="divide-y divide-border/10">
            {supplies.map((s) => {
              const pool = poolFor(s.objectType)
              return (
                <div key={s.id} className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={pool.symbol} size={22} />
                    <div><div className="text-sm font-bold">{pool.symbol} supply</div><a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${s.id}`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-primary/50 hover:text-primary font-mono">{s.id.slice(0, 10)}… ↗</a></div>
                  </div>
                  <button onClick={() => onWithdraw(s)} disabled={busy}
                    className="px-4 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40">Withdraw + yield</button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!account && (
        <div className="flex items-center gap-3 p-6 rounded-2xl bg-primary/5 border border-primary/10"><Wallet className="text-primary flex-shrink-0" size={18} /><p className="text-[11px] text-foreground/50">Connect your Sui wallet to supply and earn.</p></div>
      )}

      <div className="flex items-start gap-4 p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10">
        <Info className="text-cyan-300 flex-shrink-0" size={20} />
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">DeepBook strategy</p>
          <p className="text-[11px] text-foreground/50 leading-relaxed">DUSDC &amp; DEEP supplied here are routed to the DeepBook market-making strategy. Realized trading fees are harvested back into the pool via <span className="text-cyan-300">Harvest</span>, lifting every supplier&apos;s share value — withdraw to claim principal + yield.</p>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !busy && setModal(null)}>
          <div className="w-full max-w-md bg-[#0d0f14] border border-primary/20 rounded-3xl p-6 font-mono shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3"><TokenIcon symbol={modal.pool.symbol} size={28} />
                <h2 className="text-lg font-black uppercase tracking-tighter">{modal.action === "supply" ? "Supply" : "Harvest yield"} {modal.pool.symbol}</h2>
              </div>
              <button onClick={() => !busy && setModal(null)} className="text-foreground/40 hover:text-white"><X size={18} /></button>
            </div>
            <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-foreground/40 mb-2">
              <span>Your balance</span>
              <button onClick={() => setAmount(String(bals[modal.pool.symbol]?.total ?? 0))} className="text-primary/70 hover:text-primary font-bold">{fmt(bals[modal.pool.symbol]?.total ?? 0)} {modal.pool.symbol}</button>
            </div>
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 focus-within:border-primary/40 transition-all mb-4">
              <input type="number" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-transparent text-3xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none" />
            </div>
            {modal.action === "harvest" && <p className="text-[10px] text-cyan-300/70 mb-4 flex items-center gap-1.5"><Sparkles size={12} /> Injects this {modal.pool.symbol} as realized DeepBook fees — all suppliers&apos; shares appreciate.</p>}
            {modal.action === "supply" && modal.pool.strategy === "DeepBook" && <p className="text-[10px] text-cyan-300/70 mb-4 flex items-center gap-1.5"><TrendingUp size={12} /> Routed to the DeepBook market-making strategy.</p>}
            <button onClick={confirm} disabled={busy || !(Number(amount) > 0) || !bals[modal.pool.symbol]?.primary || Number(amount) > (bals[modal.pool.symbol]?.total ?? 0)}
              className="w-full py-4 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 transition-all flex items-center justify-center gap-2">
              {busy ? <Loader2 size={16} className="animate-spin" /> : null}{modal.action === "supply" ? "Confirm Supply" : "Harvest Yield"}
            </button>
            {!bals[modal.pool.symbol]?.primary && <p className="text-[10px] text-foreground/40 text-center mt-3">You have no {modal.pool.symbol}.{modal.pool.symbol === "USDC" ? " Mint some from the faucet." : ""}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
