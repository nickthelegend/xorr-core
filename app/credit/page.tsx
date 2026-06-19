"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import {
  ShieldCheck, Lock, Loader2, Wallet, CreditCard, TrendingUp, RefreshCw, ArrowUpRight,
} from "lucide-react"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { toast } from "sonner"
import { readCreditProfile, openProfileTx, applyTeeScoreTx, type CreditProfileView } from "@/lib/bnpl"
import { readPositions, type OnChainPosition } from "@/lib/positions"
import { SUI_NETWORK } from "@/lib/sui"
import { useTx, findCreated } from "@/lib/use-tx"

const LS_PROFILE = "xorr_bnpl_profile"
const MIN_SCORE = 600

export default function CreditPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()
  const runTx = useTx()

  const [profile, setProfile] = useState<CreditProfileView | null>(null)
  const [profileId, setProfileId] = useState<string | null>(null)
  const [loans, setLoans] = useState<OnChainPosition[]>([])
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)

  const refresh = useCallback(async () => {
    if (!account) return
    setLoading(true)
    try {
      const id = typeof window !== "undefined" ? localStorage.getItem(LS_PROFILE) : null
      setProfileId(id)
      const [prof, pos] = await Promise.all([
        id ? readCreditProfile(client, id).catch(() => null) : Promise.resolve(null),
        readPositions(client, account.address),
      ])
      setProfile(prof)
      setLoans(pos.filter((p) => p.kind === "bnpl" || p.kind === "unsecured"))
    } finally {
      setLoading(false)
    }
  }, [account, client])

  useEffect(() => { refresh() }, [refresh])

  // Open (share) a CreditProfile for the connected wallet, then remember its id.
  const openProfile = async () => {
    setWorking(true)
    try {
      const res = await runTx("Open credit profile", openProfileTx())
      const id = findCreated(res, "::credit::CreditProfile")
      if (id) { localStorage.setItem(LS_PROFILE, id); setProfileId(id); await refresh() }
    } catch { /* toast shown by runTx */ } finally { setWorking(false) }
  }

  // Ask the credit enclave to sign a score, then verify+apply it on-chain.
  const requestTeeScore = async () => {
    if (!profileId || !account) return
    setWorking(true)
    try {
      const r = await fetch("/api/credit-score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ borrower: account.address, profileId }),
      })
      const data = await r.json()
      if (!r.ok || data.error) { toast.error(data.error || "Enclave request failed"); return }
      await runTx("TEE score — verified vs attested enclave key ✓", applyTeeScoreTx({
        profileId,
        score: data.score,
        approvedLimit: data.approvedLimit,
        nonce: data.nonce,
        timestampMs: data.timestampMs,
        signatureHex: data.signatureHex,
      }))
      toast.success("Score attested by the audited TEE enclave", {
        description: "Verified on-chain against the AWS Nitro–attestation-bound key (PCR-gated). Your financial data never left the enclave.",
      })
      await refresh()
    } catch { /* toast shown by runTx */ } finally { setWorking(false) }
  }

  if (!account) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-6 font-mono">
        <div className="glass-card rounded-lg border border-primary/20 p-10 flex flex-col items-center gap-6 shadow-[0_0_30px_rgba(166,242,74,0.08)]">
          <div className="size-16 bg-primary/10 rounded-full flex items-center justify-center border border-primary/30"><Wallet className="size-7 text-primary" /></div>
          <div className="text-center">
            <h1 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Connect_Wallet</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.15em] max-w-[240px] leading-relaxed">Connect your Sui wallet to view your XORR credit profile.</p>
          </div>
        </div>
      </div>
    )
  }

  const score = profile?.score ?? 0
  const scorePct = Math.min(100, (score / 850) * 100)

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Private_Credit · sui_{SUI_NETWORK}</span>
          <h1 className="text-3xl tracking-tighter font-black uppercase italic">Credit Dashboard</h1>
        </div>
        <button onClick={refresh} disabled={loading}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Sync
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          ["Credit_Limit", profile ? `${profile.creditLimit} USDC` : "—"],
          ["Available", profile ? `${profile.available} USDC` : "—"],
          ["Outstanding", profile ? `${profile.outstanding} USDC` : "—"],
          ["Repaid_Total", profile ? `${profile.repaidTotal} USDC` : "—"],
        ].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span>
            <span className="text-2xl font-light tracking-tighter">{v}</span>
          </div>
        ))}
      </div>

      {/* TEE score */}
      <div className="glass-card rounded-lg border border-purple-500/20 overflow-hidden shadow-[0_0_20px_rgba(168,85,247,0.05)]">
        <div className="bg-purple-500/5 px-5 py-2.5 border-b border-purple-500/10 flex justify-between items-center">
          <div className="flex items-center gap-2"><Lock className="size-3.5 text-purple-400" /><span className="text-[10px] text-purple-400/80 uppercase tracking-widest font-bold">Private_TEE_Credit_Score</span></div>
          <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-green-400 bg-green-500/10 border border-green-500/30 rounded-full px-2 py-1">
            <ShieldCheck className="size-3" /> Enclave Attested · On-chain PCR
          </span>
        </div>
        <div className="p-6 space-y-5">
          <p className="text-[10px] text-white/40 leading-relaxed max-w-2xl">
            Your XORR credit score is computed inside a confidential TEE and attested on-chain to your
            <span className="text-purple-400 font-bold"> CreditProfile</span>. A score of at least {MIN_SCORE} unlocks
            unsecured (collateral-free) borrowing in the money market.
          </p>
          {profile ? (
            <div className="flex items-center gap-6 flex-wrap">
              <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-4 py-2">
                <ShieldCheck className="size-3.5 text-purple-400" />
                <span className="text-purple-400 text-xl font-black tracking-tighter">{score}</span>
                <span className="text-[9px] text-purple-400/50 ml-1">/ 850</span>
              </div>
              <div className="flex-1 min-w-[120px]">
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400 transition-all duration-700" style={{ width: `${scorePct}%` }} />
                </div>
              </div>
              <span className={`text-[10px] uppercase font-bold ${score >= MIN_SCORE ? "text-green-400" : "text-amber-400"}`}>
                {score >= MIN_SCORE ? "Unsecured borrowing unlocked" : `Needs ≥ ${MIN_SCORE} for unsecured`}
              </span>
              <button onClick={requestTeeScore} disabled={working}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/30 disabled:opacity-40 transition-all">
                {working ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />}
                {working ? "Signing in enclave…" : score > 0 ? "Refresh TEE Score" : "Request TEE Score"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-[11px] text-amber-400/80">No credit profile yet — open one to start building your TEE-attested score.</p>
              <button onClick={openProfile} disabled={working}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-200 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/30 disabled:opacity-40 transition-all">
                {working ? <Loader2 className="size-3 animate-spin" /> : <ShieldCheck className="size-3" />}
                {working ? "Opening…" : "Open Credit Profile"}
              </button>
            </div>
          )}
          {profileId && (
            <a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${profileId}`} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[9px] text-purple-400/50 hover:text-purple-400 font-mono pt-1">
              CreditProfile object <ArrowUpRight size={10} />
            </a>
          )}
        </div>
      </div>

      {/* Open credit lines */}
      <div className="glass-card rounded-lg border border-white/10 overflow-hidden">
        <div className="bg-white/5 px-5 py-2.5 border-b border-white/10 flex justify-between items-center">
          <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold">Open_Credit_Lines</span>
          <span className="text-[9px] text-primary/50 font-bold">{loans.length} active</span>
        </div>
        {loans.length === 0 ? (
          <div className="p-8 text-center"><p className="text-[10px] text-white/20 uppercase tracking-widest">No active credit lines</p></div>
        ) : (
          <div className="divide-y divide-white/5">
            {loans.map((l) => (
              <div key={l.id} className="px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  {l.kind === "bnpl" ? <CreditCard size={14} className="text-primary/70" /> : <ShieldCheck size={14} className="text-primary/70" />}
                  <span className="text-xs text-white font-bold">{l.label}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-white tabular-nums">{l.amount.toLocaleString()} USDC</span>
                  <a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${l.id}`} target="_blank" rel="noopener noreferrer"
                    className="text-[10px] text-primary/60 hover:text-primary underline">view</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link href="/bnpl" className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center justify-between hover:bg-primary/10 transition-colors group">
          <div className="flex items-center gap-4">
            <CreditCard className="text-primary" size={22} />
            <div>
              <div className="text-sm font-black uppercase tracking-widest text-primary">Buy Now, Pay Never</div>
              <p className="text-[11px] text-foreground/50 mt-1">Checkout with credit and auto-repay from yield.</p>
            </div>
          </div>
          <ArrowUpRight className="text-primary group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={18} />
        </Link>
        <Link href="/lend-borrow" className="bg-white/5 border border-border/40 rounded-3xl p-6 flex items-center justify-between hover:border-primary/40 transition-colors group">
          <div className="flex items-center gap-4">
            <TrendingUp className="text-primary" size={22} />
            <div>
              <div className="text-sm font-black uppercase tracking-widest">Lend / Borrow</div>
              <p className="text-[11px] text-foreground/50 mt-1">Supply, borrow, repay & manage your TEE credit line.</p>
            </div>
          </div>
          <ArrowUpRight className="text-foreground/40 group-hover:text-primary transition-colors" size={18} />
        </Link>
      </div>
    </div>
  )
}
