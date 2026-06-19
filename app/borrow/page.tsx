"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Info, ShieldAlert, ChevronRight, Lock, Loader2, Wallet, Coins } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { useTx, findCreated } from "@/lib/use-tx"
import { faucetTx, USDT_COIN_TYPE } from "@/lib/bnpl"
import { borrowCollateralizedTx } from "@/lib/market"
import { SUI_NETWORK } from "@/lib/sui"

const LS_COLLAT = "xorr_market_collat"
const COLLAT_RATIO = 1.5

export default function BorrowPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const runTx = useTx()

  const [usdt, setUsdt] = useState(0)
  const [primaryCoin, setPrimaryCoin] = useState<string | null>(null)
  const [borrowAmount, setBorrowAmount] = useState("50")
  const [busy, setBusy] = useState(false)
  const [lastTx, setLastTx] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!account) return
    const coins = await client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE })
    let total = BigInt(0), best: string | null = null, bestBal = BigInt(0)
    for (const c of coins.data) {
      const b = BigInt(c.balance)
      total += b
      if (b > bestBal) { bestBal = b; best = c.coinObjectId }
    }
    setUsdt(Number(total) / 1e6)
    setPrimaryCoin(best)
  }, [account, client])

  useEffect(() => { refresh() }, [refresh])

  const amt = Number(borrowAmount) || 0
  const collateral = Math.ceil(amt * COLLAT_RATIO)
  const repay = +(amt * 1.05).toFixed(2)
  const sender = account?.address ?? ""

  const guard = async (fn: () => Promise<void>) => {
    if (!account || busy) return
    setBusy(true)
    try { await fn(); await refresh() } catch { /* toast shown */ } finally { setBusy(false) }
  }

  const onFaucet = () => guard(async () => { await runTx("Mint 500 USDC", faucetTx(500)) })

  const onBorrow = () => guard(async () => {
    if (!primaryCoin || amt <= 0) return
    const res = await runTx(`Borrow ${amt} USDC (collateralized)`, borrowCollateralizedTx(primaryCoin, amt, collateral, sender))
    const id = findCreated(res, "::market::CollateralizedPosition<")
    const lockId = findCreated(res, "::collateral::CollateralLock<")
    if (id && lockId && typeof window !== "undefined") {
      try {
        const prev = JSON.parse(localStorage.getItem(LS_COLLAT) || "[]")
        localStorage.setItem(LS_COLLAT, JSON.stringify([...prev, { id, lockId, repay }]))
      } catch { /* ignore */ }
    }
    setLastTx(res.digest)
  })

  if (!account) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 font-mono text-white">
        <Wallet className="w-8 h-8 text-primary/60" />
        <p className="text-sm text-foreground/50 uppercase tracking-widest">Connect your Sui wallet to borrow</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Borrow · sui_{SUI_NETWORK}</span>
        <h1 className="text-white text-3xl tracking-tighter font-black uppercase italic">Execute Borrow</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-[#0d0f14] border border-border/30 rounded-3xl overflow-hidden">
          <div className="p-8 space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Collateralized Borrow</h3>
                <p className="text-xs text-foreground/40 mt-1 leading-relaxed">Lock {Math.round(COLLAT_RATIO * 100)}% USDC collateral and borrow USDC instantly — settled on Sui.</p>
              </div>
              <button onClick={onFaucet} disabled={busy}
                className="flex items-center gap-2 px-4 h-9 rounded-xl bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40">
                <Coins size={13} /> Get_500
              </button>
            </div>

            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-2">
              <label className="text-xs text-foreground/40">{"You're borrowing"}</label>
              <div className="flex items-center gap-3">
                <input type="number" value={borrowAmount} onChange={(e) => setBorrowAmount(e.target.value)} placeholder="0"
                  className="flex-1 bg-transparent text-4xl font-light text-foreground/60 placeholder:text-foreground/20 focus:outline-none min-w-0" />
                <div className="flex items-center gap-2 bg-[#1a1d24] border border-border/40 rounded-xl px-3 py-2.5 min-w-[110px]">
                  <TokenIcon symbol="USDC" size={20} className="flex-shrink-0" />
                  <span className="text-sm font-semibold text-white">USDC</span>
                </div>
              </div>
            </div>

            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-2">
              <label className="text-xs text-foreground/40">Collateral required (USDC)</label>
              <div className="flex items-center gap-3">
                <span className="flex-1 text-4xl font-light text-foreground/60">{collateral.toLocaleString()}</span>
                <div className="flex items-center gap-2 bg-[#1a1d24] border border-border/40 rounded-xl px-3 py-2.5 min-w-[110px]">
                  <Lock size={16} className="text-primary/70" />
                  <span className="text-sm font-semibold text-white">USDC</span>
                </div>
              </div>
              <p className="text-[10px] text-foreground/30">Your balance: {usdt.toLocaleString()} USDC · repay {repay} USDC (5% fee)</p>
            </div>

            <div className="flex items-center gap-2 bg-[#05080f]/40 border border-border/20 rounded-xl px-4 py-3">
              <Info size={14} className="text-foreground/30 flex-shrink-0" />
              <span className="text-xs text-foreground/40">For unsecured (collateral-free) borrowing backed by your TEE credit score, use the money market.</span>
            </div>

            {lastTx && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-xs text-green-400 font-mono truncate">
                Borrowed — tx {lastTx.slice(0, 12)}… · check <Link href="/positions" className="underline">Positions</Link>
              </div>
            )}

            <button onClick={onBorrow} disabled={busy || !primaryCoin || amt <= 0 || usdt < collateral}
              className="w-full py-4 rounded-2xl bg-primary text-black font-black text-sm uppercase tracking-tighter transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 hover:scale-[1.01]">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Submitting…</> : usdt < collateral ? "Insufficient_USDC" : `Borrow_${amt}_USDC`}
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-8 backdrop-blur-md space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/50 flex items-center gap-2">
              <ShieldAlert size={16} className="text-yellow-400" />Position_Summary
            </h3>
            <div className="space-y-4">
              {[
                ["Borrow Amount", `${amt.toLocaleString()} USDC`],
                ["Collateral Locked", `${collateral.toLocaleString()} USDC`],
                ["Repay Total", `${repay} USDC`],
                ["Collateral Ratio", `${Math.round(COLLAT_RATIO * 100)}%`],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center text-[11px] border-b border-border/10 pb-4 last:border-0 last:pb-0">
                  <span className="text-foreground/40">{label}</span>
                  <span className="font-bold text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <Link href="/lend-borrow" className="block bg-primary/5 border border-primary/20 rounded-3xl p-8 space-y-4 group hover:bg-primary/10 transition-colors">
            <div className="flex justify-between items-center">
              <h3 className="text-xs font-bold uppercase tracking-widest text-primary">Full_Money_Market</h3>
              <ChevronRight size={16} className="text-primary group-hover:translate-x-1 transition-transform" />
            </div>
            <p className="text-[11px] text-foreground/60 leading-relaxed italic">
              Supply liquidity, manage collateral, repay, and access unsecured TEE-backed credit lines.
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
