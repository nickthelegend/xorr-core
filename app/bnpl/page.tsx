"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useTx, findCreated } from "@/lib/use-tx";
import { Loader2, AlertTriangle, Wallet, CreditCard, CalendarClock, PiggyBank, Zap, CheckCircle2 } from "lucide-react";
import {
  faucetTx, openProfileTx, openPurchaseTx, repayTx, autoRepayFromYieldTx, repayFromLpTx,
  readCreditProfile, readLoan, USDT_COIN_TYPE,
  type CreditProfileView, type LoanView,
} from "@/lib/bnpl";
import { readPositions } from "@/lib/positions";
import { SUI_NETWORK } from "@/lib/sui";

const LS_PROFILE = "xorr_bnpl_profile";
const LS_LOANS = "xorr_bnpl_loans";

// A loan we opened, plus its (optional) EMI plan. n=1 => pay-in-full.
type LoanRec = { id: string; n: number; perAmount: number; startMs: number; paid: number; kind?: string };

const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function BnplPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const runTx = useTx();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loans, setLoans] = useState<LoanRec[]>([]);
  const [views, setViews] = useState<Record<string, LoanView>>({});
  const [profile, setProfile] = useState<CreditProfileView | null>(null);
  const [usdc, setUsdc] = useState(0);
  const [primaryCoin, setPrimaryCoin] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [epoch, setEpoch] = useState<number | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [amount, setAmount] = useState("120");
  const [emiN, setEmiN] = useState(3);
  const [repayInput, setRepayInput] = useState<Record<string, string>>({});

  useEffect(() => {
    setProfileId(localStorage.getItem(LS_PROFILE));
    try {
      const raw = JSON.parse(localStorage.getItem(LS_LOANS) || "[]");
      // migrate legacy string[] -> LoanRec[]
      setLoans(raw.map((x: unknown) => (typeof x === "string" ? { id: x, n: 1, perAmount: 0, startMs: 0, paid: 0 } : x)));
    } catch { /* noop */ }
  }, []);

  const persist = (next: LoanRec[]) => { setLoans(next); localStorage.setItem(LS_LOANS, JSON.stringify(next)); };

  const refresh = useCallback(async () => {
    if (!account) return;
    const [coins, pos, sys] = await Promise.all([
      client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE }),
      readPositions(client, account.address).catch(() => []),
      client.getLatestSuiSystemState().catch(() => null),
    ]);
    let total = BigInt(0), best: string | null = null, bestBal = BigInt(0);
    for (const c of coins.data) { const b = BigInt(c.balance); total += b; if (b > bestBal) { bestBal = b; best = c.coinObjectId; } }
    setUsdc(Number(total) / 1e6);
    setPrimaryCoin(best);
    setReceiptId(pos.find((p) => p.kind === "supply")?.id ?? null);
    if (sys) setEpoch(Number(sys.epoch));
    if (profileId) setProfile(await readCreditProfile(client, profileId).catch(() => null));
    const stored: LoanRec[] = JSON.parse(localStorage.getItem(LS_LOANS) || "[]");
    const v: Record<string, LoanView> = {};
    await Promise.all(stored.map(async (l) => { const lv = await readLoan(client, l.id).catch(() => null); if (lv) v[l.id] = lv; }));
    setViews(v);
  }, [account, client, profileId]);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (label: string, build: () => ReturnType<typeof openProfileTx>, after?: (res: Awaited<ReturnType<typeof runTx>>) => Promise<void>) => {
    if (!account) return;
    setBusy(label);
    try { const res = await runTx(label, build()); if (after) await after(res); await refresh(); }
    catch { /* toast shown */ } finally { setBusy(null); }
  };

  const onFaucet = () => run("Mint 500 USDC", () => faucetTx(500));
  const onCreateProfile = () => run("Open credit profile", openProfileTx, async (res) => {
    const id = findCreated(res, "::credit::CreditProfile");
    if (id) { localStorage.setItem(LS_PROFILE, id); setProfileId(id); }
  });

  const onBuy = () => {
    const amt = Number(amount);
    if (!profileId || !primaryCoin || !(amt > 0)) return;
    run(`Buy ${fmt(amt)} USDC${emiN > 1 ? ` · split ${emiN}` : ""}`,
      () => openPurchaseTx({ profileId, primaryCoinId: primaryCoin, amountUsdt: amt, collateralUsdt: amt }),
      async (res) => {
        const id = findCreated(res, "::bnpl::Loan<");
        if (!id) return;
        const lv = await readLoan(client, id).catch(() => null);
        const outstanding = lv?.outstanding ?? amt;
        const rec: LoanRec = { id, n: emiN, perAmount: Math.ceil((outstanding / emiN) * 100) / 100, startMs: Date.now(), paid: 0 };
        persist([...loans, rec]);
      });
  };

  const onRepay = (l: LoanRec, amt: number, label: string) => {
    if (!profileId || !primaryCoin || !account || !(amt > 0)) return;
    run(label, () => repayTx({ loanId: l.id, profileId, primaryCoinId: primaryCoin, amountUsdt: amt, sender: account.address }), async () => {
      persist(loans.map((x) => (x.id === l.id ? { ...x, paid: Math.min(x.n, x.paid + 1) } : x)));
    });
  };
  const onRepayFromLp = (l: LoanRec) => {
    const out = views[l.id]?.outstanding ?? 0;
    if (!profileId || !receiptId || !account || !(out > 0)) return;
    run("Repay from LP position", () => repayFromLpTx({ loanId: l.id, profileId, receiptId, amountUsdt: out, sender: account.address }));
  };
  const onYield = (l: LoanRec) => {
    if (!profileId || !primaryCoin || !account) return;
    run("Pay-Never: yield auto-repay", () => autoRepayFromYieldTx({ loanId: l.id, profileId, primaryCoinId: primaryCoin, yieldUsdt: 10, sender: account.address }));
  };

  if (!account) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 font-mono text-white">
        <Wallet className="w-8 h-8 text-primary/60" />
        <p className="text-sm text-foreground/50 uppercase tracking-widest">Connect your Sui wallet to use Buy Now, Pay Never</p>
      </div>
    );
  }

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex flex-col gap-1">
      <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{label}</span>
      <span className="text-2xl font-light tracking-tighter text-white">{value}</span>
    </div>
  );

  const dueLabel = (lv?: LoanView) => {
    if (!lv || epoch == null) return "—";
    const left = lv.dueEpoch - epoch;
    if (left < 0) return `Overdue by ~${-left}d`;
    return `Epoch ${lv.dueEpoch} · ~${left}d left`;
  };

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Buy_Now_Pay_Never</span>
        <h1 className="text-3xl md:text-5xl tracking-tighter font-black uppercase">Credit &amp; Repayment</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="USDC_Balance" value={fmt(usdc)} />
        <Stat label="Credit_Limit" value={profile ? fmt(profile.creditLimit) : "—"} />
        <Stat label="Outstanding" value={profile ? fmt(profile.outstanding) : "—"} />
        <Stat label="LP_Position" value={receiptId ? "Active" : "None"} />
      </div>

      {/* Setup + buy */}
      <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 flex flex-col gap-5">
        <div className="flex flex-wrap gap-3">
          <button onClick={onFaucet} disabled={!!busy} className="px-5 h-11 rounded-xl bg-white/5 border border-border/40 text-[11px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40 flex items-center gap-2">
            {busy === "Mint 500 USDC" ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Get_500_USDC
          </button>
          {!profileId && (
            <button onClick={onCreateProfile} disabled={!!busy} className="px-5 h-11 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center gap-2">
              {busy === "Open credit profile" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Open_Credit_Profile
            </button>
          )}
        </div>

        {profileId && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Purchase_Amount (USDC)</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-40 bg-[#05080f]/60 border border-border/30 rounded-xl px-4 h-11 text-lg focus:border-primary/40 focus:outline-none" />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Repayment_Plan</label>
                <div className="flex gap-2">
                  {[1, 3, 4].map((n) => (
                    <button key={n} onClick={() => setEmiN(n)} className={`px-3 h-11 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${emiN === n ? "bg-primary text-black border-primary" : "bg-white/5 border-border/40 hover:border-primary/40"}`}>
                      {n === 1 ? "Full" : `Split ${n}`}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={onBuy} disabled={!!busy || usdc < Number(amount)} className="px-6 h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 flex items-center gap-2">
                {busy?.startsWith("Buy ") ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Buy_Now
              </button>
            </div>
            <p className="text-[10px] text-foreground/30">Locks {fmt(Number(amount) || 0)} USDC collateral; the pool fronts the merchant now. {emiN > 1 ? `Repay in ${emiN} installments` : "Repay anytime"} — or let collateral yield auto-repay (Pay-Never).</p>
            {usdc < Number(amount) && <p className="text-[11px] text-amber-400/80 flex items-center gap-2"><AlertTriangle size={12} /> Need ≥ {fmt(Number(amount) || 0)} USDC — mint some first.</p>}
          </div>
        )}
      </div>

      {/* Active loans (over-collateralized BNPL only; unsecured ones live on /credit) */}
      {loans.some((l) => l.kind !== "unsecured") && (
        <div className="flex flex-col gap-4">
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Active_Loans</span>
          {loans.filter((l) => l.kind !== "unsecured").map((l) => {
            const lv = views[l.id];
            const repaid = lv ? lv.status === 1 || lv.outstanding <= 0.0001 : false;
            const ri = repayInput[l.id] ?? "";
            return (
              <div key={l.id} className="bg-[#0d0f14] border border-border/30 rounded-2xl p-5 flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <a href={`https://suiscan.xyz/${SUI_NETWORK}/object/${l.id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary/70 hover:text-primary font-mono underline">{l.id.slice(0, 10)}…{l.id.slice(-6)}</a>
                  <div className="flex items-center gap-4 text-[11px]">
                    <span className="flex items-center gap-1.5 text-foreground/60"><CalendarClock size={13} className="text-primary/60" /> {dueLabel(lv)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${repaid ? "text-green-400 border-green-500/30 bg-green-500/10" : "text-amber-400 border-amber-500/30 bg-amber-500/10"}`}>
                      {repaid ? "Repaid" : `${lv ? fmt(lv.outstanding) : "…"} USDC due`}
                    </span>
                  </div>
                </div>

                {/* EMI schedule */}
                {l.n > 1 && !repaid && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest text-foreground/40">
                      <span>EMI · {l.paid}/{l.n} paid · {fmt(l.perAmount)} USDC each</span>
                      <span>{Math.round((l.paid / l.n) * 100)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                      {Array.from({ length: l.n }).map((_, i) => (
                        <div key={i} className={`flex-1 rounded-sm ${i < l.paid ? "bg-primary" : "bg-white/10"}`} />
                      ))}
                    </div>
                  </div>
                )}

                {!repaid && (
                  <div className="flex flex-wrap items-center gap-2">
                    {l.n > 1 && l.paid < l.n && (
                      <button onClick={() => onRepay(l, l.perAmount, `Pay EMI ${l.paid + 1}/${l.n}`)} disabled={!!busy || usdc < l.perAmount}
                        className="px-4 h-9 rounded-lg bg-primary text-black text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 flex items-center gap-2">
                        {busy === `Pay EMI ${l.paid + 1}/${l.n}` ? <Loader2 size={12} className="animate-spin" /> : <CalendarClock size={12} />} Pay EMI {l.paid + 1}/{l.n} ({fmt(l.perAmount)})
                      </button>
                    )}
                    <button onClick={() => onRepay(l, lv?.outstanding ?? 0, "Repay in full")} disabled={!!busy || !lv || usdc < lv.outstanding}
                      className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40">
                      Repay in full
                    </button>
                    <button onClick={() => onRepayFromLp(l)} disabled={!!busy || !receiptId} title={receiptId ? "Withdraw your LP position and repay" : "Supply to the pool first (Lend/Borrow)"}
                      className="px-4 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40 flex items-center gap-1.5">
                      <PiggyBank size={12} /> Repay from LP
                    </button>
                    <button onClick={() => onYield(l)} disabled={!!busy || usdc < 10} title="Route collateral yield to repay (Pay-Never)"
                      className="px-4 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40 flex items-center gap-1.5">
                      <Zap size={12} /> Yield repay
                    </button>
                    <div className="flex items-center gap-1">
                      <input type="number" value={ri} onChange={(e) => setRepayInput({ ...repayInput, [l.id]: e.target.value })} placeholder="amt"
                        className="w-20 bg-[#05080f]/60 border border-border/30 rounded-lg px-2 h-9 text-[11px] focus:border-primary/40 focus:outline-none" />
                      <button onClick={() => onRepay(l, Number(ri), `Repay ${fmt(Number(ri))} USDC`)} disabled={!!busy || !(Number(ri) > 0) || usdc < Number(ri)}
                        className="px-3 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40">
                        Repay
                      </button>
                    </div>
                  </div>
                )}
                {repaid && (
                  <div className="flex items-center gap-2 text-[11px] text-green-400 font-bold uppercase tracking-widest">
                    <CheckCircle2 size={14} /> Loan fully repaid — credit limit grew
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-foreground/30 leading-relaxed max-w-2xl">
        Over-collateralized BNPL: lock collateral, the pool fronts the merchant now, and each repayment grows your
        credit limit. Repay in EMIs, all at once, from yield earned on your collateral (&ldquo;Pay Never&rdquo;), or
        straight from your lending-pool position. Credit scoring runs privately in the TEE.
      </p>
    </div>
  );
}
