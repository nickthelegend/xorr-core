"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ShieldCheck, Zap, AlertCircle, CheckCircle2, Loader2, ArrowLeft, CreditCard, Wallet,
} from "lucide-react"
import Link from "next/link"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { isValidSuiAddress } from "@mysten/sui/utils"
import { useTx } from "@/lib/use-tx"
import { USDT_COIN_TYPE } from "@/lib/bnpl"
import { USDT_PACKAGE_ID, USDT_DECIMALS, SUI_NETWORK, suiscanTxUrl } from "@/lib/sui"

// Optional Sui merchant/treasury address that bills settle to (override per env).
const SETTLE_ADDRESS = process.env.NEXT_PUBLIC_XORR_MERCHANT_ADDRESS ?? ""

interface Bill {
  amount?: number | string
  asset?: string
  description?: string
  status?: string
  tx_hash?: string
  merchant?: {
    name?: string
    category?: string
    escrow_contract?: string
    user?: { wallet_address?: string }
    sui_address?: string
  }
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
  const [paying, setPaying] = useState(false)
  const [success, setSuccess] = useState(false)
  const [digest, setDigest] = useState("")
  const [usdt, setUsdt] = useState(0)
  const [primaryCoin, setPrimaryCoin] = useState<string | null>(null)

  const billAmount = bill ? Number(bill.amount) || 0 : 0
  // Prefer an explicit Sui address from the bill; fall back to the env merchant.
  const recipient =
    bill?.merchant?.sui_address ||
    bill?.metadata?.sui_address ||
    SETTLE_ADDRESS
  const recipientValid = !!recipient && isValidSuiAddress(recipient)
  // Prefer the merchant's on-chain MerchantEscrow object if the bill carries one.
  const escrowId = bill?.merchant?.escrow_contract
  const settleViaEscrow = !!escrowId && isValidSuiAddress(escrowId)
  const configured = USDT_PACKAGE_ID !== ""

  useEffect(() => {
    if (!hash) { setFetching(false); return }
    let active = true
    // Mongo-free fallback: a /pay/<anything>?amount=&escrow=&to=&merchant=&desc=
    // URL settles directly with no DB bill record. Used by the demo shop and any
    // time the merchant DB is unavailable, so checkout never hard-depends on Mongo.
    const fromQuery = (): Bill | null => {
      if (typeof window === "undefined") return null
      const sp = new URLSearchParams(window.location.search)
      const amt = sp.get("amount")
      if (!amt) return null
      return {
        amount: Number(amt),
        asset: "USDC",
        description: sp.get("desc") || "Direct payment via XORR",
        status: "pending",
        merchant: {
          name: sp.get("merchant") || "Merchant",
          escrow_contract: sp.get("escrow") || undefined,
          sui_address: sp.get("to") || undefined,
        },
      }
    }
    fetch(`/api/bills/${hash}`)
      .then((r) => r.json())
      .then((d) => { if (active) setBill(d && !d.error ? d : fromQuery()) })
      .catch(() => { if (active) setBill(fromQuery()) })
      .finally(() => { if (active) setFetching(false) })
    return () => { active = false }
  }, [hash])

  useEffect(() => {
    if (!account) return
    client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE }).then((coins) => {
      let total = BigInt(0), best: string | null = null, bestBal = BigInt(0)
      for (const c of coins.data) {
        const b = BigInt(c.balance)
        total += b
        if (b > bestBal) { bestBal = b; best = c.coinObjectId }
      }
      setUsdt(Number(total) / 1e6)
      setPrimaryCoin(best)
    }).catch(() => {})
  }, [account, client])

  const handlePay = async () => {
    if (!account || !primaryCoin || !(settleViaEscrow || recipientValid) || billAmount <= 0) return
    setPaying(true)
    try {
      const raw = BigInt(Math.floor(billAmount * 10 ** USDT_DECIMALS))
      const tx = new Transaction()
      const [pay] = tx.splitCoins(tx.object(primaryCoin), [tx.pure.u64(raw)])
      const orderBytes = Array.from(new TextEncoder().encode(hash ?? "xorr-bill"))
      if (settleViaEscrow) {
        // Proper escrow settlement: pay into the merchant's on-chain MerchantEscrow.
        tx.moveCall({
          target: `${USDT_PACKAGE_ID}::merchant_escrow::settle_payment`,
          typeArguments: [USDT_COIN_TYPE],
          arguments: [tx.object(escrowId!), pay, tx.pure.vector("u8", orderBytes)],
        })
      } else {
        // Fallback: direct transfer to the merchant's Sui address.
        tx.transferObjects([pay], tx.pure.address(recipient))
      }
      const res = await runTx(`Pay ${billAmount} USDC`, tx)
      setDigest(res.digest)
      setSuccess(true)
      // Notify the opener (e.g. a merchant/shop checkout popup) that we settled.
      if (typeof window !== "undefined" && window.opener) {
        window.opener.postMessage(
          { type: "POLARIS_PAYMENT_RESULT", success: true, txHash: res.digest, amount: billAmount, paymentMode: "bnpl" },
          "*",
        )
      }
      // Best-effort backend sync (non-blocking, ignore failures).
      try {
        await fetch("/api/bills/pay", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ billHash: hash, txHash: res.digest, userAddress: account.address, paymentMode: "sui" }),
        })
      } catch { /* ignore */ }
    } catch { /* toast already shown */ } finally {
      setPaying(false)
    }
  }

  if (fetching) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Loading bill…</p>
      </div>
    )
  }

  if (!bill) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center text-white">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-black uppercase tracking-tighter">Bill Not Found</h1>
          <p className="text-[10px] text-white/40 uppercase">This payment link may be expired or invalid.</p>
        </div>
        <Link href="/" className="bg-white/5 px-6 py-2 rounded border border-white/10 text-[10px] font-bold uppercase hover:bg-white/10 transition-all">
          Return to XORR
        </Link>
      </div>
    )
  }

  if (success) {
    return (
      <div className="max-w-md mx-auto mt-12 glass-card rounded-lg border border-primary/30 p-8 flex flex-col items-center text-center gap-6 shadow-[0_0_50px_-12px_rgba(34,197,94,0.3)] text-white">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center"><CheckCircle2 className="w-10 h-10 text-primary" /></div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black uppercase tracking-tighter">Payment_Settled</h1>
          <p className="text-[10px] text-white/40 uppercase">Settled in USDC on XORR · Sui {SUI_NETWORK}.</p>
        </div>
        <div className="w-full bg-white/5 border border-white/10 p-4 rounded flex flex-col gap-3">
          <div className="flex justify-between items-center text-[10px] uppercase font-bold">
            <span className="text-white/40">Merchant</span><span className="text-white font-black">{bill.merchant?.name || "Merchant"}</span>
          </div>
          <div className="flex justify-between items-center text-[10px] uppercase font-bold">
            <span className="text-white/40">Amount</span><span className="text-primary font-black">{billAmount} USDC</span>
          </div>
        </div>
        <div className="flex flex-col w-full gap-2">
          <a href={suiscanTxUrl(digest)} target="_blank" rel="noopener noreferrer"
            className="w-full bg-primary py-3 rounded text-[10px] font-black uppercase text-black hover:opacity-90 transition-all text-center">
            View on Suiscan
          </a>
          {bill.metadata?.redirect_url ? (
            <a href={bill.metadata.redirect_url} className="w-full bg-white/5 border border-white/10 py-3 rounded text-[10px] font-black uppercase text-white hover:bg-white/10 transition-all text-center">Return to Merchant</a>
          ) : (
            <Link href="/positions" className="w-full bg-white/5 border border-white/10 py-3 rounded text-[10px] font-black uppercase text-white hover:bg-white/10 transition-all text-center">View Positions</Link>
          )}
        </div>
      </div>
    )
  }

  const alreadyPaid = bill.status === "paid"
  const canPay = !!account && !!primaryCoin && (settleViaEscrow || recipientValid) && configured && billAmount > 0 && usdt >= billAmount && !paying && !alreadyPaid

  return (
    <div className="max-w-md mx-auto mt-12 flex flex-col gap-8 text-white font-mono">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 bg-white/5 hover:bg-white/10 rounded transition-all"><ArrowLeft className="w-4 h-4 text-white" /></button>
        <h1 className="text-lg font-black uppercase tracking-tighter">Confirm_Payment</h1>
      </div>

      <div className="glass-card rounded-lg border border-white/10 overflow-hidden shadow-2xl">
        <div className="bg-white/5 p-6 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center font-bold text-primary italic uppercase">{bill.merchant?.name?.[0] || "M"}</div>
            <div className="flex flex-col">
              <span className="text-xs font-black uppercase tracking-tight">{bill.merchant?.name || "Merchant"}</span>
              <span className="text-[9px] text-white/40 uppercase font-bold">{bill.merchant?.category || "General"}</span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-lg font-black text-white">{billAmount}</span>
            <span className="text-[10px] text-white/40 font-bold uppercase">USDC</span>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-white/40 uppercase font-bold tracking-widest italic">Description</span>
            <p className="text-xs text-white/80 leading-relaxed font-medium">{bill.description || "Payment settled in USDC via XORR on Sui."}</p>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-white uppercase tracking-wide">Pay_With_XORR</span>
                <span className="text-[9px] text-primary font-bold uppercase tracking-widest">Your USDC: {usdt.toLocaleString()}</span>
              </div>
            </div>
            <Zap className="w-4 h-4 text-primary animate-pulse" />
          </div>

          {!account && (
            <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-4 py-3 text-[10px] uppercase tracking-widest font-bold text-white/50">
              <Wallet size={14} /> Connect your Sui wallet to pay
            </div>
          )}
          {account && !settleViaEscrow && !recipientValid && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded px-4 py-3 text-[10px] uppercase tracking-wide font-bold text-amber-400/90">
              <AlertCircle size={14} className="flex-shrink-0" /> No Sui settlement address on this bill. Set NEXT_PUBLIC_XORR_MERCHANT_ADDRESS or a merchant sui_address.
            </div>
          )}
          {account && recipientValid && usdt < billAmount && (
            <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded px-4 py-3 text-[10px] uppercase tracking-wide font-bold text-amber-400/90">
              <AlertCircle size={14} className="flex-shrink-0" /> Insufficient USDC — get test USDC from the <Link href="/faucet" className="underline">faucet</Link>.
            </div>
          )}

          <div className="flex flex-col gap-4">
            <button onClick={handlePay} disabled={!canPay}
              className={`w-full py-4 rounded font-black text-xs uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${canPay ? "bg-primary text-black hover:scale-[1.02]" : "bg-zinc-800 text-white/20 cursor-not-allowed"}`}>
              {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
              {paying ? "Settling…" : alreadyPaid ? "Already_Settled" : !account ? "Wallet_Needs_Link" : `Pay_${billAmount}_USDC`}
            </button>
            <p className="text-[8px] text-center text-white/20 uppercase font-bold tracking-[0.1em] leading-relaxed">
              By paying, you transfer {billAmount} USDC to the merchant on Sui {SUI_NETWORK}. The transaction is signed by your wallet (gas in SUI).
            </p>
          </div>
        </div>
      </div>

      {alreadyPaid && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500" />
          <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest leading-loose">
            This bill was already settled{bill.tx_hash ? `. Ref: ${bill.tx_hash.slice(0, 12)}…` : "."}
          </span>
        </div>
      )}
    </div>
  )
}
