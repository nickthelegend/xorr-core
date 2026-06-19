"use client"

import { useState } from "react"
import { Info, Loader2, AlertTriangle, ShieldCheck } from "lucide-react"
import { TokenIcon } from "@/components/token-icon"
import { cn } from "@/lib/utils"
import { useCurrentAccount } from "@mysten/dapp-kit"
import { Transaction } from "@mysten/sui/transactions"
import { isValidSuiAddress } from "@mysten/sui/utils"
import { useTx } from "@/lib/use-tx"
import {
  USDT_PACKAGE_ID,
  USDT_FAUCET_ID,
  USDT_DECIMALS,
  FAUCET_MAX_USDT,
  SUI_NETWORK,
} from "@/lib/sui"

const CONFIGURED = USDT_PACKAGE_ID !== "" && USDT_FAUCET_ID !== ""

export default function FaucetPage() {
  const account = useCurrentAccount()
  const runTx = useTx()

  const [amount, setAmount] = useState("")
  const [recipient, setRecipient] = useState("")
  const [busy, setBusy] = useState(false)

  const effectiveRecipient = (recipient.trim() || account?.address) ?? ""
  const parsed = parseFloat(amount)
  const isOverMax = !isNaN(parsed) && parsed > FAUCET_MAX_USDT
  const isValidAmount = !isNaN(parsed) && parsed > 0 && !isOverMax
  const isValidRecipient = effectiveRecipient !== "" && isValidSuiAddress(effectiveRecipient)
  const canSubmit = isValidAmount && isValidRecipient && !!account && CONFIGURED && !busy

  const handleDispense = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      const raw = BigInt(Math.floor(parsed * 10 ** USDT_DECIMALS))
      const tx = new Transaction()
      // usdt::faucet_mint(faucet, amount) -> Coin<USDT>, then send to recipient.
      const [coin] = tx.moveCall({
        target: `${USDT_PACKAGE_ID}::usdt::faucet_mint`,
        arguments: [tx.object(USDT_FAUCET_ID), tx.pure.u64(raw)],
      })
      tx.transferObjects([coin], tx.pure.address(effectiveRecipient))
      await runTx(`Mint ${parsed} USDC`, tx) // clickable Suiscan toast
      setAmount("")
    } catch { /* toast already shown */ }
    finally { setBusy(false) }
  }
  const status = busy ? "loading" : "idle"

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase animate-pulse">XORR_Faucet // sui_{SUI_NETWORK}</span>
        <h1 className="text-white text-3xl md:text-5xl tracking-tighter font-black uppercase italic">Testnet_Resources</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 bg-[#0d0f14] border border-border/30 rounded-3xl overflow-hidden">
          <div className="p-8 space-y-5">
            <div className="space-y-1">
              <h3 className="text-xl font-black uppercase tracking-widest text-white">Mint_Test_USDC</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-foreground/30">
                Sui_Move_Faucet // Gas_In_SUI
              </p>
            </div>

            {!CONFIGURED && (
              <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3">
                <AlertTriangle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span className="text-[10px] font-bold uppercase tracking-tight text-amber-400/90">
                  Faucet not configured. Publish xorr-contracts, then set NEXT_PUBLIC_USDT_PACKAGE_ID and NEXT_PUBLIC_USDT_FAUCET_ID in .env.local
                </span>
              </div>
            )}

            {!account && (
              <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                <Info size={14} className="text-primary/40 flex-shrink-0" />
                <span className="text-[10px] font-black uppercase tracking-tighter text-primary/40">Connect_your_Sui_wallet_to_mint</span>
              </div>
            )}

            {/* Recipient */}
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-2 group focus-within:border-primary/40 transition-all">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Recipient_Address (defaults to you)</label>
              <input type="text" value={recipient} onChange={e => setRecipient(e.target.value.trim())}
                placeholder={account?.address ?? "0x... sui address"}
                className={`w-full bg-transparent text-sm font-mono placeholder:text-foreground/20 focus:outline-none ${effectiveRecipient && !isValidRecipient ? "text-red-400" : "text-foreground/70"}`} />
              {effectiveRecipient !== "" && !isValidRecipient && <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest">INVALID_SUI_ADDRESS</p>}
            </div>

            {/* Amount */}
            <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 space-y-3 group focus-within:border-primary/40 transition-all">
              <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Amount_To_Mint</label>
              <div className="flex items-center gap-3">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0"
                  className={`flex-1 bg-transparent text-4xl font-light tracking-tighter placeholder:text-foreground/20 focus:outline-none min-w-0 ${isOverMax ? "text-red-400" : "text-foreground/60"}`} />
                <div className="flex items-center gap-2 bg-[#1a1d24] border border-border/40 rounded-xl px-3 py-2.5 min-w-[110px]">
                  <TokenIcon symbol="USDC" size={20} className="flex-shrink-0" />
                  <span className="text-sm font-semibold text-white">USDC</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-foreground/30">Max_Per_Request</span>
                <button type="button" onClick={() => setAmount(FAUCET_MAX_USDT.toString())}
                  className="text-primary/70 hover:text-primary font-black transition-colors">
                  {FAUCET_MAX_USDT.toLocaleString()} USDC
                </button>
              </div>
              {isOverMax && (
                <div className="flex items-center gap-2 text-red-400 text-[11px]">
                  <AlertTriangle size={12} />
                  Max is {FAUCET_MAX_USDT.toLocaleString()} USDC per request
                </div>
              )}
            </div>

            <button
              onClick={handleDispense}
              disabled={status === "loading" || !canSubmit}
              className={cn(
                "w-full py-5 rounded-2xl font-black text-sm uppercase tracking-tighter transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(166,242,74,0.1)]",
                status === "loading" || !canSubmit ? "bg-white/5 text-foreground/20" : "bg-primary text-black"
              )}
            >
              {status === "loading"
                ? <><Loader2 size={16} className="animate-spin" /> MINTING_RESOURCES...</>
                : `MINT_${amount ? Number(amount).toLocaleString() : "—"}_USDC`}
            </button>

          </div>
        </div>

        <div className="lg:col-span-5 space-y-6">
          <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-8 backdrop-blur-md space-y-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground/50">How_It_Works</span>
            </div>
            <div className="space-y-2 text-[11px] text-foreground/40 leading-relaxed font-mono">
              <p className="text-foreground/60">Calls usdt::faucet_mint on the shared Faucet object.</p>
              <p>The mint transaction is signed by your connected Sui wallet (gas paid in SUI).</p>
              <p className="mt-3">Network: <span className="text-primary/60">Sui {SUI_NETWORK}</span></p>
              <p>Status: <span className="text-primary/60">{CONFIGURED ? "LIVE" : "AWAITING_CONFIG"}</span></p>
            </div>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 space-y-4">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">DISPENSE_POLICY</h3>
            <div className="space-y-3 font-mono text-[10px]">
              <div className="flex justify-between border-b border-primary/10 pb-2">
                <span className="text-foreground/40">Asset</span>
                <span className="text-white font-bold">USDC (test)</span>
              </div>
              <div className="flex justify-between border-b border-primary/10 pb-2">
                <span className="text-foreground/40">Decimals</span>
                <span className="text-foreground/60">{USDT_DECIMALS}</span>
              </div>
              <div className="flex justify-between border-b border-primary/10 pb-2 last:border-0">
                <span className="text-foreground/40">Max per request</span>
                <span className="text-primary font-bold">{FAUCET_MAX_USDT.toLocaleString()} USDC</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
