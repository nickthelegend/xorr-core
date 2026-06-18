"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Database, ShieldCheck, ExternalLink, History, Loader2, RefreshCw,
  ArrowUpRight, CheckCircle2, XCircle, Wallet,
} from "lucide-react"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { suiscanTxUrl, SUI_NETWORK } from "@/lib/sui"

type TxRow = {
  digest: string
  timestampMs: number | null
  status: "success" | "failure" | "unknown"
  kind: string
  gasUsed: number | null
}

const short = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`

function formatTimeAgo(ms: number | null): string {
  if (!ms) return "—"
  const seconds = Math.floor((Date.now() - ms) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function TransactionsPage() {
  const account = useCurrentAccount()
  const client = useSuiClient()

  const [txns, setTxns] = useState<TxRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!account) return
    setLoading(true)
    setError(null)
    try {
      const res = await client.queryTransactionBlocks({
        filter: { FromAddress: account.address },
        options: { showEffects: true, showInput: true },
        limit: 30,
        order: "descending",
      })
      const rows: TxRow[] = res.data.map((t) => {
        const effects = t.effects as unknown as
          | { status?: { status?: string }; gasUsed?: Record<string, string> }
          | undefined
        const statusStr = effects?.status?.status
        const gas = effects?.gasUsed
        const gasUsed = gas
          ? (Number(gas.computationCost ?? 0) + Number(gas.storageCost ?? 0) - Number(gas.storageRebate ?? 0)) / 1e9
          : null
        // Derive a coarse "kind" label from the first programmable command.
        let kind = "Transaction"
        const tx = (t.transaction as { data?: { transaction?: { kind?: string } } } | undefined)?.data?.transaction
        if (tx?.kind) kind = tx.kind
        return {
          digest: t.digest,
          timestampMs: t.timestampMs ? Number(t.timestampMs) : null,
          status: statusStr === "success" ? "success" : statusStr === "failure" ? "failure" : "unknown",
          kind,
          gasUsed,
        }
      })
      setTxns(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to query transactions")
    } finally {
      setLoading(false)
    }
  }, [account, client])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="flex flex-col gap-8 py-8 font-mono text-white">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Activity · sui_{SUI_NETWORK}</span>
          <h1 className="text-white text-3xl tracking-tighter font-black uppercase italic">Transaction History</h1>
        </div>
        <button onClick={refresh} disabled={loading || !account}
          className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] uppercase tracking-widest font-bold transition-all disabled:opacity-40">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <section className="lg:col-span-8 flex flex-col gap-4">
          <div className="space-y-4">
            {!account && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center">
                <Wallet size={48} className="mx-auto text-foreground/20 mb-4" />
                <p className="text-sm text-foreground/40">Connect your Sui wallet to view transaction history</p>
              </div>
            )}
            {account && loading && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center">
                <Loader2 size={28} className="mx-auto text-primary animate-spin mb-4" />
                <p className="text-sm text-foreground/40">Querying Sui fullnode…</p>
              </div>
            )}
            {account && !loading && error && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center"><p className="text-sm text-red-400">{error}</p></div>
            )}
            {account && !loading && !error && txns.length === 0 && (
              <div className="bg-card/20 border border-border/40 rounded-2xl p-12 text-center">
                <History size={48} className="mx-auto text-foreground/20 mb-4" />
                <p className="text-sm text-foreground/40">No transactions found</p>
                <p className="text-xs text-foreground/30 mt-2">Your Sui activity will appear here once you transact.</p>
              </div>
            )}
            {account && !loading && !error && txns.map((t) => (
              <a key={t.digest} href={suiscanTxUrl(t.digest)} target="_blank" rel="noopener noreferrer"
                className="bg-card/20 border border-border/40 rounded-2xl p-6 flex items-center justify-between hover:bg-white/[0.04] transition-all group backdrop-blur-sm shadow-xl">
                <div className="flex items-center gap-6">
                  <div className="size-14 rounded-2xl bg-white/5 border border-border/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {t.status === "success" ? <CheckCircle2 className="w-5 h-5 text-primary" /> : t.status === "failure" ? <XCircle className="w-5 h-5 text-red-400" /> : <Database className="w-5 h-5 text-foreground/40" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-white font-bold text-lg tracking-tight">{t.kind}</span>
                      <span className={`text-[9px] px-2 py-0.5 rounded border font-black tracking-widest uppercase italic ${t.status === "success" ? "bg-primary/10 text-primary border-primary/20" : t.status === "failure" ? "bg-red-500/10 text-red-400 border-red-500/20" : "bg-white/5 text-foreground/40 border-border/20"}`}>
                        {t.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 font-mono">
                      <span className="text-[10px] text-foreground/40 uppercase font-black">{formatTimeAgo(t.timestampMs)}</span>
                      <span className="text-[10px] text-foreground/20">|</span>
                      <span className="text-[10px] text-primary/60 group-hover:text-primary flex items-center gap-1 font-bold underline">
                        {short(t.digest)} <ExternalLink size={10} />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-foreground/40 uppercase font-black">Gas (SUI)</div>
                  <div className="text-white font-black text-lg tabular-nums tracking-tighter">
                    {t.gasUsed != null ? t.gasUsed.toFixed(5) : "—"}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="lg:col-span-4 space-y-6">
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 space-y-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-primary flex items-center gap-2">
              <ShieldCheck size={16} /> On_Chain_Ledger
            </h3>
            <p className="text-[10px] text-foreground/60 leading-relaxed font-mono">
              Every action settles on Sui {SUI_NETWORK}. This view queries the fullnode directly for transactions sent from your connected address — tap any row to inspect it on Suiscan.
            </p>
            <div className="pt-4 border-t border-primary/10 space-y-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-foreground/40">NETWORK</span>
                <span className="text-white font-bold uppercase">Sui {SUI_NETWORK}</span>
              </div>
              <div className="flex justify-between text-[10px]">
                <span className="text-foreground/40">SHOWING</span>
                <span className="text-primary font-bold">{txns.length} most recent</span>
              </div>
            </div>
          </div>

          <a href={account ? `https://suiscan.xyz/${SUI_NETWORK}/account/${account.address}` : "#"}
            target="_blank" rel="noopener noreferrer"
            className={`block bg-[#05080f]/40 border border-border/40 rounded-3xl p-6 ${account ? "hover:border-primary/40" : "opacity-50 pointer-events-none"} transition-all`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-foreground/50">View full account</span>
              <ArrowUpRight size={16} className="text-primary" />
            </div>
          </a>
        </section>
      </div>
    </div>
  )
}
