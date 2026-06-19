"use client"

import {
  FolderOpen,
  ShieldCheck,
  Zap,
  Lock,
  Terminal,
  Code,
  ChevronRight,
  Database
} from "lucide-react"

export default function DocsPage() {
  return (
    <div className="flex -mx-4 md:-mx-8 lg:-mx-12 h-[calc(100vh-140px)] overflow-hidden border-t border-white/5 font-mono">
      {/* Left Column: Navigation Tree */}
      <aside className="w-72 glass-sidebar flex flex-col custom-scrollbar overflow-y-auto hidden lg:flex bg-[#05080f]/70 border-r border-white/5">
        <div className="p-8">
          <div className="mb-10">
            <h1 className="text-white text-sm font-black tracking-[0.2em] mb-1">XORR_DOCS</h1>
            <p className="text-primary/60 text-[9px] font-bold uppercase tracking-[0.3em]">PRIVATE_CREDIT_ON_SUI</p>
          </div>
          <nav className="space-y-2">
            {[
              { id: "intro", label: "01_INTRODUCTION", icon: FolderOpen },
              { id: "tee", label: "02_TEE_CREDIT", icon: ShieldCheck },
              { id: "pools", label: "03_LENDING_POOL", icon: Database },
              { id: "borrowing", label: "04_BORROW_LOGIC", icon: Zap },
              { id: "bnpl", label: "05_BNPL", icon: Lock },
            ].map((item) => (
              <a key={item.id} className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all text-[11px] font-bold tracking-tighter text-white/50 hover:text-white" href={`#${item.id}`}>
                <item.icon className="text-white/20 group-hover:text-primary size-4" />
                {item.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="mt-auto p-8 border-t border-white/5">
          <button className="w-full flex items-center justify-center gap-2 border border-primary/40 text-primary px-4 py-3 rounded-xl text-[10px] font-black hover:bg-primary/10 transition-all uppercase tracking-widest">
            <Code className="size-3" />
            MOVE_SOURCE
          </button>
        </div>
      </aside>

      {/* Center Column: Main Content */}
      <main className="flex-1 custom-scrollbar overflow-y-auto bg-background/20">
        <div className="max-w-4xl mx-auto px-12 py-12">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 mb-10 font-mono text-[9px] tracking-[0.4em] text-white/20 uppercase">
            <a className="hover:text-primary transition-colors" href="#">PROTOCOL</a>
            <ChevronRight className="size-2 text-white/10" />
            <span className="text-primary/70">ARCH_SPECIFICATION</span>
          </div>

          <div className="mb-16">
            <h1 className="text-5xl font-black tracking-tighter leading-none mb-8 text-white uppercase italic">
              XORR_PROTOCOL <span className="text-primary">//</span> <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/30">SPECIFICATION</span>
            </h1>
            <p className="text-white/40 text-sm leading-relaxed max-w-2xl font-medium">
              XORR is a BNPL and lend/borrow protocol on Sui, with private credit scoring computed inside a Trusted
              Execution Environment (TEE). Supply liquidity, borrow against collateral, or borrow unsecured against
              your reputation — all settled on-chain in Move.
            </p>
          </div>

          <div className="space-y-24 pb-32">
            <section id="tee" className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-primary font-mono text-sm">[1.0]</span>
                <h3 className="text-2xl font-black tracking-tight uppercase italic text-white">THE_TEE_ADVANTAGE</h3>
              </div>
              <p className="text-white/60 text-xs leading-relaxed uppercase tracking-wider">
                A confidential enclave evaluates your repayment history and external footprint, then signs a credit
                score that is attested to your on-chain CreditProfile. Your raw financial data never leaves the TEE —
                only the resulting score and limit become visible on Sui.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <h4 className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Private_Scoring</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed font-bold uppercase italic tracking-tighter">Inputs are processed inside the enclave; only an attested score reaches the chain.</p>
                </div>
                <div className="p-6 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                  <h4 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.2em]">Unsecured_Credit</h4>
                  <p className="text-[10px] text-white/40 leading-relaxed font-bold uppercase italic tracking-tighter">A score above the threshold unlocks collateral-free borrowing in the money market.</p>
                </div>
              </div>
            </section>

            <section id="pools" className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-primary font-mono text-sm">[2.0]</span>
                <h3 className="text-2xl font-black tracking-tight uppercase italic text-white">LENDING_POOL</h3>
              </div>
              <p className="text-white/60 text-xs leading-relaxed uppercase tracking-wider">
                Liquidity providers supply USDC to a shared LendingPool object and receive a SupplyReceipt. Borrowers
                draw against the pool; interest and routed DeepBook yield accrue back to suppliers.
              </p>

              {/* Terminal Code Block */}
              <div className="bg-zinc-950 rounded-2xl overflow-hidden border border-white/10 shadow-3xl">
                <div className="bg-white/5 px-6 py-3 flex items-center justify-between border-b border-white/5">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/50" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/50" />
                    <div className="w-3 h-3 rounded-full bg-green-500/50" />
                  </div>
                  <span className="text-[9px] font-black text-white/30 uppercase tracking-[0.3em]">Move // lending_pool.move</span>
                </div>
                <div className="p-8 font-mono text-[11px] leading-relaxed text-white/80">
                  <div><span className="text-primary font-bold">public fun</span> <span className="text-blue-400 font-bold">supply</span>&lt;T&gt;(pool: <span className="text-primary">&mut</span> LendingPool&lt;T&gt;, coin: Coin&lt;T&gt;): SupplyReceipt {'{'}</div>
                  <div className="pl-6 text-white/50 italic">// Deposit liquidity, mint a receipt for the supplier</div>
                  <div className="pl-6"><span className="text-white">let</span> amount = coin::value(&coin);</div>
                  <div className="pl-6">balance::join(&<span className="text-primary">mut</span> pool.cash, coin::into_balance(coin));</div>
                  <div className="pl-6">pool.total_supplied = pool.total_supplied + amount;</div>
                  <div className="pl-6"><span className="text-primary">mint_receipt</span>(pool, amount)</div>
                  <div>{'}'}</div>
                </div>
              </div>
            </section>

            <section id="borrowing" className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-primary font-mono text-sm">[3.0]</span>
                <h3 className="text-2xl font-black tracking-tight uppercase italic text-white">BORROW_LOAN_TO_VALUE</h3>
              </div>
              <p className="text-white/60 text-xs leading-relaxed uppercase tracking-wider">
                Collateralized borrows lock 150% USDC collateral and mint a CollateralizedPosition. Unsecured borrows
                require no collateral — they are gated by the TEE credit score and the profile&apos;s available credit line.
              </p>
              <div className="p-8 bg-primary/5 border border-primary/20 rounded-2xl">
                 <div className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-4">COLLATERAL_LOGIC</div>
                 <div className="text-sm font-black text-white leading-relaxed font-mono italic">
                    Required_Collateral = Borrow_Amount * 150%
                 </div>
                 <div className="text-[10px] text-white/30 mt-4 uppercase font-bold">Repay principal + 5% fee // collateral released on settle</div>
              </div>
            </section>

            <section id="bnpl" className="space-y-6">
              <div className="flex items-center gap-4">
                <span className="text-primary font-mono text-sm">[4.0]</span>
                <h3 className="text-2xl font-black tracking-tight uppercase italic text-white">BUY_NOW_PAY_NEVER</h3>
              </div>
              <p className="text-white/60 text-xs leading-relaxed uppercase tracking-wider">
                A BNPL purchase fronts the merchant from pool liquidity and opens a Loan against your CreditProfile.
                Routed yield can auto-repay the loan over time — pay never, in the ideal case. On-time repayment grows
                your credit limit.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Right Column: Key Metrics */}
      <aside className="w-72 glass-sidebar p-10 hidden xl:flex flex-col bg-[#05080f]/70 border-l border-white/5">
        <div className="sticky top-0 space-y-12">
          <div>
            <h5 className="text-white text-[9px] font-black tracking-[0.4em] uppercase mb-8 opacity-40">Documentation_Progress</h5>
            <div className="space-y-8">
              {[
                { label: "ARCH_SUMMARY", pct: "100%" },
                { label: "POOL_SPECS", pct: "100%" },
                { label: "BORROW_API", pct: "85%" },
                { label: "TEE_ATTEST", pct: "60%" },
              ].map(p => (
                <div key={p.label} className="space-y-3">
                  <div className="flex justify-between text-[9px] font-black text-white/60">
                    <span>{p.label}</span>
                    <span>{p.pct}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: p.pct }}></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-6 bg-[#1a1c22] border border-white/5 rounded-2xl space-y-4">
             <Terminal className="text-primary size-5" />
             <p className="text-[10px] font-black text-white uppercase tracking-wider">Integration Support</p>
             <p className="text-[9px] text-white/30 uppercase leading-relaxed">Reach the XORR team for Sui testnet integration support and contract addresses.</p>
          </div>
        </div>
      </aside>
    </div>
  )
}
