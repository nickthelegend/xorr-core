"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import {
  Zap, History, ShieldCheck, TrendingUp, CreditCard, Target,
  Loader2, Coins, ArrowUpRight, Shield, Wallet, Lock,
} from "lucide-react"
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit"
import { readCreditProfile, USDT_COIN_TYPE, type CreditProfileView } from "@/lib/bnpl"
import { readLendingPool, readPositions, type LendingPoolStats, type OnChainPosition } from "@/lib/positions"
import { SUI_NETWORK, suiscanTxUrl } from "@/lib/sui"
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button"

const LS_PROFILE = "xorr_bnpl_profile"

const ACTIONS = [
  { href: "/bnpl", label: "Buy Now, Pay Never", desc: "Checkout with credit, repay from yield.", icon: CreditCard },
  { href: "/lend-borrow", label: "Lend / Borrow", desc: "Supply USDC or borrow on Sui.", icon: TrendingUp },
  { href: "/faucet", label: "Get Test USDC", desc: "Mint testnet USDC to try the flows.", icon: Coins },
]

export default function Page() {
  const account = useCurrentAccount()
  const client = useSuiClient()

  const [usdt, setUsdt] = useState(0)
  const [profile, setProfile] = useState<CreditProfileView | null>(null)
  const [pool, setPool] = useState<LendingPoolStats | null>(null)
  const [positions, setPositions] = useState<OnChainPosition[]>([])
  const [recent, setRecent] = useState<{ digest: string; status: string }[]>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const poolStats = await readLendingPool(client).catch(() => null)
      setPool(poolStats)
      if (!account) { setUsdt(0); setProfile(null); setPositions([]); setRecent([]); return }
      const [coins, pos, txs] = await Promise.all([
        client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE }),
        readPositions(client, account.address),
        client.queryTransactionBlocks({
          filter: { FromAddress: account.address },
          options: { showEffects: true },
          limit: 3,
          order: "descending",
        }).catch(() => ({ data: [] as Array<{ digest: string; effects?: { status?: { status?: string } } }> })),
      ])
      let total = BigInt(0)
      for (const c of coins.data) total += BigInt(c.balance)
      setUsdt(Number(total) / 1e6)
      setPositions(pos)
      setRecent(txs.data.map((t) => ({ digest: t.digest, status: (t.effects as { status?: { status?: string } } | undefined)?.status?.status ?? "unknown" })))
      const id = typeof window !== "undefined" ? localStorage.getItem(LS_PROFILE) : null
      setProfile(id ? await readCreditProfile(client, id).catch(() => null) : null)
    } finally {
      setLoading(false)
    }
  }, [account, client])

  useEffect(() => { refresh() }, [refresh])

  const totalBorrowed = positions.filter((p) => p.kind !== "supply").reduce((s, p) => s + p.amount, 0)
  const totalSupplied = positions.filter((p) => p.kind === "supply").reduce((s, p) => s + p.amount, 0)

  // ── Wallet gate: until a Sui wallet is connected, show the hero, not the app ──
  if (!account) {
    return (
      <div className="font-mono relative">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-primary/20 blur-[130px]" />
          <div className="absolute top-32 right-0 h-72 w-72 rounded-full bg-purple-500/15 blur-[130px]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(166,242,74,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(166,242,74,0.045)_1px,transparent_1px)] bg-[size:46px_46px] [mask-image:radial-gradient(ellipse_at_top,black,transparent_72%)]" />
        </div>

        <div className="relative grid lg:grid-cols-2 gap-12 lg:gap-16 items-center min-h-[72dvh] py-10">
          {/* Pitch + connect CTA */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-[10px] text-primary font-bold tracking-widest uppercase backdrop-blur-md">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> XORR // Sui_{SUI_NETWORK} · Live
            </div>

            <div className="space-y-5">
              <h1 className="text-6xl md:text-8xl font-black tracking-[-0.04em] uppercase leading-[0.88] text-foreground">
                Buy Now,<br />
                <span className="bg-gradient-to-r from-primary via-primary to-emerald-300 bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(166,242,74,0.35)]">Pay Never.</span>
              </h1>
              <p className="text-sm md:text-base text-foreground/50 leading-relaxed max-w-md">
                Private consumer credit on Sui. Check out with{" "}
                <Link href="/bnpl" className="text-primary hover:underline font-bold">
                  Buy Now, Pay Never (BNPL)
                </Link>
                , repay from yield, or{" "}
                <Link href="/lend-borrow" className="text-primary hover:underline font-bold">
                  lend & borrow on Sui
                </Link>
                . Borrow against a reputation score computed inside a confidential{" "}
                <Link href="/credit" className="text-primary hover:underline font-bold">
                  private TEE credit
                </Link>{" "}
                enclave — your financial data never leaves the enclave.
              </p>
            </div>

            <div className="space-y-3">
              <div className="[&_button]:h-14 [&_button]:px-8 [&_button]:text-sm [&_button]:rounded-2xl [&_button]:font-black [&_button]:tracking-widest [&_button]:shadow-[0_0_40px_-4px_rgba(166,242,74,0.55)] hover:[&_button]:scale-[1.03] [&_button]:transition-transform inline-block">
                <ConnectWalletButton />
              </div>
              <p className="flex items-center gap-2 text-[10px] text-foreground/35 uppercase tracking-[0.15em]">
                <Wallet size={12} className="text-primary/50" /> No email · no credit check · just your Sui wallet
              </p>
            </div>

            {/* Public, wallet-less stats */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-border/30 max-w-md">
              <div>
                <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Pool Liquidity</div>
                <div className="text-lg font-black text-foreground">{pool ? pool.totalSupplied.toLocaleString() : "—"} <span className="text-[10px] text-foreground/40">USDC</span></div>
              </div>
              <div>
                <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Available</div>
                <div className="text-lg font-black text-primary">{pool ? pool.available.toLocaleString() : "—"} <span className="text-[10px] text-foreground/40">USDC</span></div>
              </div>
              <div>
                <div className="text-[9px] text-foreground/30 uppercase tracking-widest mb-1">Network</div>
                <div className="text-lg font-black text-foreground uppercase">Sui</div>
              </div>
            </div>
          </div>

          {/* Feature pillars */}
          <div className="space-y-4">
            {[
              { icon: CreditCard, title: "Buy Now, Pay Never", tag: "BNPL", href: "/bnpl", desc: "Checkout with on-chain credit. Collateral earns yield that auto-repays your loan." },
              { icon: TrendingUp, title: "Lend & Borrow", tag: "Markets", href: "/lend", desc: "Supply USDC / DUSDC / DEEP for DeepBook yield, or borrow against collateral." },
              { icon: Lock, title: "Private TEE Credit", tag: "Confidential", href: "/credit", desc: "Score computed in a confidential enclave and attested on-chain — data never leaves the TEE." },
            ].map((f) => (
              <Link key={f.title} href={f.href} className="group relative flex items-start gap-4 bg-[#0d0f14]/70 border border-border/40 rounded-2xl p-5 hover:border-primary/40 hover:bg-[#0d0f14] transition-all backdrop-blur-sm overflow-hidden">
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary flex-shrink-0 group-hover:scale-105 transition-transform"><f.icon size={20} /></div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{f.title}</h3>
                    <span className="text-[8px] text-primary/70 uppercase tracking-widest border border-primary/20 rounded px-1.5 py-0.5">{f.tag}</span>
                  </div>
                  <p className="text-[11px] text-foreground/45 leading-relaxed">{f.desc}</p>
                </div>
                <ArrowUpRight size={14} className="text-foreground/20 group-hover:text-primary transition-colors flex-shrink-0 mt-1" />
              </Link>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/20 my-16" />

        {/* How It Works Section */}
        <div className="space-y-12 pb-16">
          <div className="text-center space-y-2">
            <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // WORKFLOW</span>
            <h2 className="text-3xl md:text-4xl tracking-tighter font-black uppercase">How It Works</h2>
            <p className="text-xs text-foreground/40 max-w-md mx-auto">Three simple steps to unlock private decentralized consumer credit on Sui.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: "01",
                title: "Connect Wallet",
                desc: "Securely link your Sui wallet to initialize your private profile. No email or personal identity information required."
              },
              {
                step: "02",
                title: "Attest TEE Credit",
                desc: "Generate a decentralized reputation score computed confidentially inside a secure AWS Nitro TEE enclave. Your private financial data never leaves the enclave. Learn more about our ",
                linkText: "private TEE credit",
                href: "/credit"
              },
              {
                step: "03",
                title: "Buy Now, Pay Never",
                desc: "Checkout with credit. Collateral assets are deployed into Sui lending pools to earn high yield, which auto-repays your BNPL credit line. Try ",
                linkText: "Buy Now, Pay Never",
                href: "/bnpl"
              }
            ].map((s) => (
              <div key={s.step} className="bg-[#0d0f14]/60 border border-border/30 rounded-2xl p-6 relative overflow-hidden group hover:border-primary/20 transition-all">
                <span className="absolute top-2 right-4 text-7xl font-black text-primary/5 font-mono select-none">{s.step}</span>
                <div className="space-y-3 relative z-10">
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase font-mono">{s.step} // STEP</span>
                  <h3 className="text-base font-bold text-white uppercase">{s.title}</h3>
                  <p className="text-xs text-foreground/50 leading-relaxed font-mono">
                    {s.desc}
                    {s.href && s.linkText && (
                      <Link href={s.href} className="text-primary hover:underline font-bold inline-flex items-center gap-0.5">
                        {s.linkText} <ArrowUpRight size={10} />
                      </Link>
                    )}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ Section */}
        <div className="space-y-12 pb-24 border-t border-border/20 pt-16">
          <div className="text-center space-y-2">
            <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // FAQ</span>
            <h2 className="text-3xl md:text-4xl tracking-tighter font-black uppercase">Frequently Asked Questions</h2>
            <p className="text-xs text-foreground/40 max-w-md mx-auto">Get answers to the most common questions about the XORR protocol.</p>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            {[
              {
                q: "What is Buy Now, Pay Never?",
                a: "Buy Now, Pay Never (BNPL) allows users to purchase items on credit by locking USDC collateral. The collateral is automatically routed to yield-generating protocols (such as lending pools or liquidity pools on Sui), and the earned yield pays off the outstanding credit over time."
              },
              {
                q: "How does the TEE credit score work?",
                a: "XORR Finance computes your credit score inside an AWS Nitro TEE (Trusted Execution Environment). It processes off-chain financial data confidentially, issuing an on-chain cryptographic attestation. Your raw financial data never leaves the enclave."
              },
              {
                q: "Is my financial data private?",
                a: "Yes. Because all computations occur inside a confidential enclave (TEE), no one—not even the XORR protocol developers—can inspect your private financial data. Only the final score is attested on-chain."
              },
              {
                q: "What is XORR Finance built on?",
                a: "XORR Finance is built natively on the high-performance Sui blockchain, leveraging its low latency, high throughput, and secure smart contracts to handle collateral management, lending pools, and BNPL checkouts."
              }
            ].map((faq, index) => (
              <div key={index} className="bg-[#05080f]/50 border border-border/20 rounded-2xl p-6 hover:border-primary/10 transition-all">
                <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-2 font-mono">
                  <span className="text-primary text-xs font-black">&gt;</span> {faq.q}
                </h4>
                <p className="text-xs text-foreground/50 leading-relaxed pl-4 border-l border-primary/20 font-mono">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 font-mono">
      <div className="lg:col-span-7 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-foreground">Asset Overview</h2>
            <p className="text-xs text-foreground/40 uppercase tracking-widest">XORR // BNPL · Lend/Borrow · Private Credit · sui_{SUI_NETWORK}</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 text-[10px] text-primary font-bold tracking-wider uppercase backdrop-blur-md">
            <div className={`w-1.5 h-1.5 rounded-full bg-primary ${loading ? "animate-ping" : "animate-pulse"}`} />
            {account ? "Live" : "Connect_Wallet"}
          </div>
        </div>

        <div className="relative group overflow-hidden bg-[#05080f]/50 border border-primary/20 rounded-3xl p-8 backdrop-blur-xl">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Shield size={120} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 relative z-10">
            <div className="space-y-6">
              <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <CreditCard size={12} className="text-primary" />USDC_Balance
                </div>
                <div className="text-5xl font-black tracking-tighter text-foreground font-mono">
                  {account ? usdt.toLocaleString() : "—"}
                </div>
                <p className="text-[10px] text-foreground/20 italic mt-2">Read live from your connected Sui wallet.</p>
              </div>
              <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <History size={12} className="text-primary" />Supplied / Borrowed
                </div>
                <div className="text-3xl font-bold tracking-tight text-white/70">
                  {totalSupplied.toLocaleString()} <span className="text-foreground/30 text-lg">/ {totalBorrowed.toLocaleString()}</span>
                </div>
              </div>
              <div>
                <div className="text-[10px] text-foreground/40 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                  <Target size={12} className="text-primary" />TEE_Credit_Score
                </div>
                <div className="text-3xl font-bold tracking-tighter text-purple-400">
                  {profile ? profile.score : "—"}
                  <span className="text-[10px] text-foreground/20 ml-2">/ 850</span>
                </div>
                {profile && (
                  <p className="text-[10px] text-purple-400/60 uppercase tracking-widest mt-1">Limit: {profile.creditLimit} USDC · Available: {profile.available} USDC</p>
                )}
              </div>
              {!account && (
                <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-xl text-[10px] font-bold text-primary/60 uppercase tracking-widest w-fit">
                  <Wallet size={12} /> Connect to load your data
                </div>
              )}
            </div>
            <div className="flex flex-col justify-between space-y-8">
              <div className="bg-secondary/20 border border-border/40 rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-foreground/50 uppercase tracking-widest">Pool_Available</span>
                  <span className="text-sm font-black text-primary px-2 py-0.5 rounded border border-primary/30">
                    {pool ? `${pool.available.toLocaleString()} USDC` : "—"}
                  </span>
                </div>
                <div className="h-2 bg-secondary/50 rounded-full overflow-hidden border border-border/10">
                  <div className="h-full bg-primary" style={{ width: pool && pool.totalSupplied > 0 ? `${Math.min(100, (pool.totalBorrowed / pool.totalSupplied) * 100)}%` : "0%" }} />
                </div>
                <div className="flex justify-between text-[10px] text-foreground/30 uppercase">
                  <span>Borrowed: {pool ? pool.totalBorrowed.toLocaleString() : "—"}</span>
                  <span>Supplied: {pool ? pool.totalSupplied.toLocaleString() : "—"}</span>
                </div>
              </div>
              <Link href="/pools" className="grid grid-cols-2 gap-4 group/pool">
                <div className="p-4 bg-background/40 border border-border/30 rounded-xl group-hover/pool:border-primary/30 transition-colors">
                  <div className="text-[9px] text-foreground/40 uppercase mb-1">Open Positions</div>
                  <div className="text-sm font-bold text-green-400">{positions.length}</div>
                </div>
                <div className="p-4 bg-background/40 border border-border/30 rounded-xl group-hover/pool:border-primary/30 transition-colors">
                  <div className="text-[9px] text-foreground/40 uppercase mb-1">Network</div>
                  <div className="text-sm font-bold text-primary uppercase">Sui {SUI_NETWORK}</div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ACTIONS.map((item) => (
            <Link key={item.href} href={item.href} className="bg-card/30 border border-border/50 rounded-2xl p-6 hover:bg-card/50 hover:border-primary/30 transition-colors cursor-pointer group">
              <div className="flex items-center justify-between mb-4">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary"><item.icon size={18} /></div>
                <ArrowUpRight size={14} className="text-foreground/30 group-hover:text-primary transition-colors" />
              </div>
              <div className="text-lg font-bold">{item.label}</div>
              <div className="text-xs text-foreground/50 mt-1">{item.desc}</div>
            </Link>
          ))}
        </div>
      </div>

      <div className="lg:col-span-5 space-y-6">
        {/* Private credit explainer / CTA */}
        <div className="bg-[#0d0f14] border border-border/30 rounded-3xl overflow-hidden">
          <div className="flex items-center gap-2 p-5 bg-[#05080f]/60 border-b border-border/20">
            <Lock size={14} className="text-purple-400" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-purple-400/80">Private TEE Credit</span>
          </div>
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-white">Borrow against your reputation</h3>
            <p className="text-xs text-foreground/50 leading-relaxed">
              XORR computes your credit score inside a confidential TEE and attests it on-chain. A strong score unlocks
              unsecured, collateral-free borrowing — your financial data never leaves the enclave.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/lend-borrow" className="flex items-center justify-center gap-2 bg-primary text-black py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-all">
                <TrendingUp size={14} /> Start Borrowing
              </Link>
              <Link href="/credit" className="flex items-center justify-center gap-2 bg-white/5 border border-border/40 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest hover:border-primary/40 transition-all">
                <ShieldCheck size={14} /> My Credit
              </Link>
            </div>
          </div>
        </div>

        {/* Recent activity */}
        <div className="bg-[#05080f]/40 border border-border/40 rounded-3xl p-8 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 italic">Recent_Activity</h3>
            <div className="flex items-center gap-2">
              <span className="text-[8px] text-foreground/30 uppercase">{account ? "Live" : "Idle"}</span>
              <div className={`w-1 h-1 rounded-full bg-primary ${loading ? "animate-ping" : ""}`} />
            </div>
          </div>
          <div className="space-y-6">
            {!account && <p className="text-[11px] text-foreground/30 uppercase tracking-widest text-center py-6">Connect your wallet to see activity</p>}
            {account && loading && <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-primary/60" /></div>}
            {account && !loading && recent.length === 0 && <p className="text-[11px] text-foreground/30 uppercase tracking-widest text-center py-6">No activity yet</p>}
            {account && !loading && recent.map((t) => (
              <a key={t.digest} href={suiscanTxUrl(t.digest)} target="_blank" rel="noopener noreferrer"
                className="flex gap-4 border-l-2 border-primary/20 pl-4 py-1 hover:border-primary transition-colors">
                <div className="space-y-1">
                  <div className="text-[10px] font-mono text-primary/80 tracking-tighter">{t.digest.slice(0, 14)}…</div>
                  <div className="text-[9px] text-foreground/30 uppercase mt-1">{t.status} · View on Suiscan ↗</div>
                </div>
              </a>
            ))}
          </div>
          <Link href="/transactions" className="mt-8 block text-center text-[10px] font-bold uppercase tracking-[0.3em] text-foreground/40 hover:text-primary transition-colors">
            View All Activity
          </Link>
        </div>
      </div>
    </div>
  )
}
