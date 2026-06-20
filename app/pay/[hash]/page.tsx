"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ShieldCheck, Zap, AlertCircle, CheckCircle2, Loader2, ArrowLeft, CreditCard, Wallet, Lock,
} from "lucide-react"
import Link from "next/link"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { isValidSuiAddress } from "@mysten/sui/utils"
import { useTx, findCreated } from "@/lib/use-tx"
import {
  USDT_COIN_TYPE, openProfileTx, openPurchaseTx, readCreditProfile, type CreditProfileView,
} from "@/lib/bnpl"
import { USDT_PACKAGE_ID, USDT_DECIMALS, SUI_NETWORK, suiscanTxUrl } from "@/lib/sui"
import { buyNowUnsecuredTx } from "@/lib/market"

const SETTLE_ADDRESS = process.env.NEXT_PUBLIC_XORR_MERCHANT_ADDRESS ?? ""
const LS_PROFILE = "xorr_bnpl_profile"
const LS_LOANS = "xorr_bnpl_loans"

interface Bill {
  amount?: number | string
  asset?: string
  description?: string
  status?: string
  tx_hash?: string
  merchant?: { name?: string; category?: string; escrow_contract?: string; user?: { wallet_address?: string }; sui_address?: string }
  metadata?: { redirect_url?: string; sui_address?: string }
}

export default function PayPage() {
  const params = useParams()
  const hash = params?.hash as string | undefined
  const router = useRouter()
  const account = useCurrentAccount()
  const client = useSuiClient()
  const runTx = useTx()

  const [bill, setBill] = useState<Bill | null>(null)
  const [fetching, setFetching] = useState(true)
  const [busy, setBusy] = useState<"bnpl" | "direct" | "profile" | null>(null)
  const [success, setSuccess] = useState<null | { mode: "bnpl" | "direct"; digest: string }>(null)
  const [usdc, setUsdc] = useState(0)
  const [primaryCoin, setPrimaryCoin] = useState<string | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [profile, setProfile] = useState<CreditProfileView | null>(null)

  const billAmount = bill ? Number(bill.amount) || 0 : 0
  const recipient = bill?.merchant?.sui_address || bill?.metadata?.sui_address || SETTLE_ADDRESS
  const recipientValid = !!recipient && isValidSuiAddress(recipient)
  const escrowId = bill?.merchant?.escrow_contract
  const settleViaEscrow = !!escrowId && isValidSuiAddress(escrowId)
  const configured = USDT_PACKAGE_ID !== ""
  const available = profile?.available ?? 0

  useEffect(() => {
    if (!hash) { setFetching(false); return }
    let active = true
    const fromQuery = (): Bill | null => {
      if (typeof window === "undefined") return null
      const sp = new URLSearchParams(window.location.search)
      const amt = sp.get("amount")
      if (!amt) return null
      return {
        amount: Number(amt), asset: "USDC", description: sp.get("desc") || "Direct payment via XORR", status: "pending",
        merchant: { name: sp.get("merchant") || "Merchant", escrow_contract: sp.get("escrow") || undefined, sui_address: sp.get("to") || undefined },
      }
    }
    fetch(`/api/bills/${hash}`).then((r) => r.json())
      .then((d) => { if (active) setBill(d && !d.error ? d : fromQuery()) })
      .catch(() => { if (active) setBill(fromQuery()) })
      .finally(() => { if (active) setFetching(false) })
    return () => { active = false }
  }, [hash])

  const loadWallet = async () => {
    if (!account) return
    const coins = await client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE }).catch(() => ({ data: [] }))
    let total = BigInt(0), best: string | null = null, bestBal = BigInt(0)
    for (const c of coins.data) { const b = BigInt(c.balance); total += b; if (b > bestBal) { bestBal = b; best = c.coinObjectId } }
    setUsdc(Number(total) / 1e6)
    setPrimaryCoin(best)
    const id = typeof window !== "undefined" ? localStorage.getItem(LS_PROFILE) : null
    setProfileId(id)
    setProfile(id ? await readCreditProfile(client, id).catch(() => null) : null)
  }
  useEffect(() => { loadWallet() }, [account, client]) // eslint-disable-line react-hooks/exhaustive-deps

  const notifyOpener = (digest: string, mode: "bnpl" | "direct") => {
    if (typeof window !== "undefined" && window.opener) {
      window.opener.postMessage({ type: "POLARIS_PAYMENT_RESULT", success: true, txHash: digest, amount: billAmount, paymentMode: mode }, "*")
    }
  }
  const syncBackend = async (digest: string, mode: string) => {
    try { await fetch("/api/bills/pay", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billHash: hash, txHash: digest, userAddress: account?.address, paymentMode: mode }) }) } catch { /* ignore */ }
  }

  const onOpenProfile = async () => {
    if (!account) return
    setBusy("profile")
    try {
      const res = await runTx("Open credit profile", openProfileTx())
      const id = findCreated(res, "::credit::CreditProfile")
      if (id) { localStorage.setItem(LS_PROFILE, id); setProfileId(id); await loadWallet() }
    } catch { /* toast */ } finally { setBusy(null) }
  }

  // True BNPL: borrow UNSECURED against your TEE credit (no collateral); the pool
  // pays the merchant and you owe the loan. Repay anytime on /credit.
  const onPayBNPL = async () => {
    if (!account || !profileId || !escrowId || billAmount <= 0) return
    setBusy("bnpl")
    try {
      const res = await runTx(`Buy now, pay never · ${billAmount} USDC`, buyNowUnsecuredTx({
        profileId, escrowId, amountUsdt: billAmount, orderId: hash,
      }))
      const posId = findCreated(res, "::market::UnsecuredPosition")
      if (posId) {
        const loans = JSON.parse(localStorage.getItem(LS_LOANS) || "[]")
        loans.push({ id: posId, kind: "unsecured", n: 1, perAmount: 0, startMs: Date.now(), paid: 0 })
        localStorage.setItem(LS_LOANS, JSON.stringify(loans))
      }
      setSuccess({ mode: "bnpl", digest: res.digest })
      notifyOpener(res.digest, "bnpl"); syncBackend(res.digest, "bnpl")
    } catch { /* toast */ } finally { setBusy(null) }
  }

  // Direct: pay the merchant outright from your USDC balance.
  const onPayDirect = async () => {
    if (!account || !primaryCoin || !(settleViaEscrow || recipientValid) || billAmount <= 0) return
    setBusy("direct")
    try {
      const raw = BigInt(Math.floor(billAmount * 10 ** USDT_DECIMALS))
      const tx = new Transaction()
      const [pay] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(raw)])
      const orderBytes = Array.from(new TextEncoder().encode(hash ?? "xorr-bill"))
      if (settleViaEscrow) {
        tx.moveCall({ target: `${USDT_PACKAGE_ID}::merchant_escrow::settle_payment`, typeArguments: [USDT_COIN_TYPE], arguments: [tx.object(escrowId!), pay, tx.pure.vector("u8", orderBytes)] })
      } else {
        tx.transferObjects([pay], tx.pure.address(recipient))
      }
      const res = await runTx(`Pay ${billAmount} USDC`, tx)
      setSuccess({ mode: "direct", digest: res.digest })
      notifyOpener(res.digest, "direct"); syncBackend(res.digest, "direct")
    } catch { /* toast */ } finally { setBusy(null) }
  }

  if (fetching) {
    return <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4"><Loader2 className="w-8 h-8 text-primary animate-spin" /><p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Loading bill…</p></div>
  }
  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center text-white">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div className="flex flex-col gap-1"><h1 className="text-xl font-black uppercase tracking-tighter">Bill Not Found</h1><p className="text-[10px] text-white/40 uppercase">This payment link may be expired or invalid.</p></div>
        <Link href="/" className="bg-white/5 px-6 py-2 rounded border border-white/10 text-[10px] font-bold uppercase hover:bg-white/10 transition-all">Return to XORR</Link>
      </div>
    )
  }
  if (success) {
    return (
      <div className="max-w-md mx-auto mt-12 glass-card rounded-lg border border-primary/30 p-8 flex flex-col items-center text-center gap-6 shadow-[0_0_50px_-12px_rgba(34,197,94,0.3)] text-white">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-primary" /></div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter">{success.mode === "bnpl" ? "Bought_On_Credit" : "Payment_Settled"}</h1>
          <p className="text-[10px] text-white/40 uppercase">{success.mode === "bnpl" ? "Merchant paid from the pool · repay anytime on /credit" : "Settled in USDC on Sui"} {SUI_NETWORK}.</p>
        </div>
        <div className="w-full bg-white/5 border border-white/10 p-4 rounded flex flex-col gap-3">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold"><span className="text-white/40">Merchant</span><span className="text-white font-black">{bill.merchant?.name || "Merchant"}</span></div>
          <div className="flex justify-between items-center text-[10px] uppercase font-bold"><span className="text-white/40">Amount</span><span className="text-primary font-black">{billAmount} USDC</span></div>
        </div>
        <div className="flex flex-col w-full gap-2">
          <a href={suiscanTxUrl(success.digest)} target="_blank" rel="noopener noreferrer" className="w-full bg-primary py-3 rounded text-[10px] font-black uppercase text-black hover:opacity-90 text-center">View on Suiscan</a>
          {success.mode === "bnpl"
            ? <Link href="/credit" className="w-full bg-white/5 border border-white/10 py-3 rounded text-[10px] font-black uppercase text-white hover:bg-white/10 text-center">Manage / Repay Loan</Link>
            : <Link href="/positions" className="w-full bg-white/5 border border-white/10 py-3 rounded text-[10px] font-black uppercase text-white hover:bg-white/10 text-center">View Positions</Link>}
        </div>
      </div>
    )
  }

  const alreadyPaid = bill.status === "paid"
  const escrowOk = settleViaEscrow || recipientValid
  const score = profile?.score ?? 0
  const canBNPL = !!account && !!profileId && billAmount > 0 && available >= billAmount && score >= 600 && !!escrowId && !busy && !alreadyPaid
  const canDirect = !!account && !!primaryCoin && escrowOk && configured && billAmount > 0 && usdc >= billAmount && !busy && !alreadyPaid

  return (
    <div className="max-w-md mx-auto mt-12 flex flex-col gap-6 text-white font-mono">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 bg-white/5 hover:bg-white/10 rounded transition-all"><ArrowLeft className="w-4 h-4 text-white" /></button>
        <h1 className="text-lg font-black uppercase tracking-tighter">Checkout</h1>
      </div>

      <div className="glass-card rounded-lg border border-white/10 overflow-hidden shadow-2xl">
        <div className="bg-white/5 p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary uppercase">{bill.merchant?.name?.[0] || "M"}</div>
            <div className="flex flex-col"><span className="text-xs font-black uppercase tracking-tight">{bill.merchant?.name || "Merchant"}</span><span className="text-[9px] text-white/40 uppercase font-bold">{bill.merchant?.category || "General"}</span></div>
          </div>
          <div className="flex flex-col items-end"><span className="text-lg font-black text-white">{billAmount}</span><span className="text-[10px] text-white/40 font-bold uppercase">USDC</span></div>
        </div>

        <div className="p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Description</span>
            <p className="text-xs text-white/80 leading-relaxed font-medium">{bill.description || "Purchase via XORR on Sui."}</p>
          </div>

          {/* Credit panel */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white uppercase tracking-wide">XORR Credit</span>
                <span className="text-[9px] text-primary font-bold uppercase tracking-widest">
                  {profile ? `Limit ${profile.creditLimit} · Available ${available} USDC` : profileId ? "Loading…" : "No credit profile yet"}
                </span>
              </div>
            </div>
            <Zap className="w-4 h-4 text-primary animate-pulse" />
          </div>

          {!account && <Warn icon={<Wallet size={14} />}>Connect your Sui wallet to check out.</Warn>}
          {account && !profileId && <Warn icon={<CreditCard size={14} />}>Open a credit profile to buy now, pay never.</Warn>}
          {account && profileId && profile && score < 600 && <Warn icon={<AlertCircle size={14} />}>TEE score {score} — need ≥ 600 for collateral-free BNPL. <Link href="/credit" className="underline">Refresh your TEE score</Link>, or pay in full.</Warn>}
          {account && profileId && profile && score >= 600 && available < billAmount && <Warn icon={<AlertCircle size={14} />}>Credit available ({available}) is below {billAmount} USDC. Raise your limit with a higher <Link href="/credit" className="underline">TEE score</Link>, or pay in full.</Warn>}
          {account && !escrowId && <Warn icon={<AlertCircle size={14} />}>This merchant hasn&apos;t deployed an escrow yet — BNPL needs one. You can still pay in full.</Warn>}

          {/* Actions */}
          <div className="flex flex-col gap-3">
            {!profileId && account ? (
              <button onClick={onOpenProfile} disabled={busy === "profile"} className="w-full py-4 rounded-xl bg-primary/10 border border-primary/30 text-primary font-black text-xs uppercase tracking-[0.2em] hover:bg-primary/20 disabled:opacity-40 flex items-center justify-center gap-2">
                {busy === "profile" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />} Open Credit Profile
              </button>
            ) : (
              <button onClick={onPayBNPL} disabled={!canBNPL} className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${canBNPL ? "bg-primary text-black hover:scale-[1.02]" : "bg-zinc-800 text-white/20 cursor-not-allowed"}`}>
                {busy === "bnpl" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Buy Now, Pay Never · {billAmount} USDC
              </button>
            )}

            <button onClick={onPayDirect} disabled={!canDirect} className="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-white/10 disabled:opacity-30 flex items-center justify-center gap-2">
              {busy === "direct" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Pay in full now
            </button>

            <p className="text-[8px] text-center text-white/25 uppercase font-bold tracking-[0.1em] leading-relaxed">
              Buy Now, Pay Never borrows against your unsecured TEE credit line — no collateral. The pool pays the merchant and you owe the loan. Repay anytime on /credit.
            </p>
          </div>
        </div>
      </div>

      {alreadyPaid && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">This bill was already settled{bill.tx_hash ? `. Ref: ${bill.tx_hash.slice(0, 12)}…` : "."}</span>
        </div>
      )}
    </div>
  )
}

function Warn({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded px-4 py-3 text-[10px] uppercase tracking-wide font-bold text-amber-400/90">
      <span className="flex-shrink-0">{icon}</span> {children}
    </div>
  )
}
