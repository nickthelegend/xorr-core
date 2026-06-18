"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useTx, findCreated } from "@/lib/use-tx";
import { Loader2, CheckCircle2, AlertTriangle, ExternalLink, Wallet, CreditCard } from "lucide-react";
import {
  faucetTx,
  openProfileTx,
  openPurchaseTx,
  repayTx,
  autoRepayFromYieldTx,
  readCreditProfile,
  USDT_COIN_TYPE,
  type CreditProfileView,
} from "@/lib/bnpl";
import { suiscanTxUrl } from "@/lib/sui";

const LS_PROFILE = "xorr_bnpl_profile";
const LS_LOANS = "xorr_bnpl_loans";

// Demo purchase: $30 item, fully collateralized with 50 USDT (over-collateralized core).
const BUY_AMOUNT = 30;
const COLLATERAL = 50;
const REPAY_AMOUNT = 31.5; // 30 + 5% interest

export default function BnplPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const runTx = useTx();

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loans, setLoans] = useState<string[]>([]);
  const [profile, setProfile] = useState<CreditProfileView | null>(null);
  const [usdtBalance, setUsdtBalance] = useState(0);
  const [primaryCoin, setPrimaryCoin] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string; digest?: string } | null>(null);

  useEffect(() => {
    setProfileId(localStorage.getItem(LS_PROFILE));
    try { setLoans(JSON.parse(localStorage.getItem(LS_LOANS) || "[]")); } catch { /* noop */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!account) return;
    const coins = await client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE });
    let total = BigInt(0), best: string | null = null, bestBal = BigInt(0);
    for (const c of coins.data) {
      const b = BigInt(c.balance);
      total += b;
      if (b > bestBal) { bestBal = b; best = c.coinObjectId; }
    }
    setUsdtBalance(Number(total) / 1e6);
    setPrimaryCoin(best);
    if (profileId) setProfile(await readCreditProfile(client, profileId));
  }, [account, client, profileId]);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (
    label: string,
    build: () => ReturnType<typeof openProfileTx>,
    after?: (res: Awaited<ReturnType<typeof runTx>>) => Promise<void>,
  ) => {
    if (!account) return;
    setBusy(label); setMsg(null);
    try {
      const res = await runTx(label, build()); // clickable Suiscan toast
      if (after) await after(res);
      setMsg({ kind: "ok", text: `${label} confirmed`, digest: res.digest });
      await refresh();
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  };

  const onFaucet = () => run("Mint 500 USDT", () => faucetTx(500));

  const onCreateProfile = () =>
    run("Open credit profile", openProfileTx, async (res) => {
      const id = findCreated(res, "::credit::CreditProfile");
      if (id) {
        localStorage.setItem(LS_PROFILE, id);
        setProfileId(id);
      }
    });

  const onBuyNow = () => {
    if (!profileId || !primaryCoin) return;
    run("Buy Now ($30)", () => openPurchaseTx({ profileId, primaryCoinId: primaryCoin, amountUsdt: BUY_AMOUNT, collateralUsdt: COLLATERAL }), async (res) => {
      const id = findCreated(res, "::bnpl::Loan<");
      if (id) {
        const next = [...loans, id];
        localStorage.setItem(LS_LOANS, JSON.stringify(next));
        setLoans(next);
      }
    });
  };

  const onYieldRepay = (loanId: string) => {
    if (!profileId || !primaryCoin || !account) return;
    run("Pay-Never: yield auto-repay", () => autoRepayFromYieldTx({ loanId, profileId, primaryCoinId: primaryCoin, yieldUsdt: 10, sender: account.address }));
  };

  const onRepay = (loanId: string) => {
    if (!profileId || !primaryCoin || !account) return;
    run("Repay loan", () => repayTx({ loanId, profileId, primaryCoinId: primaryCoin, amountUsdt: REPAY_AMOUNT, sender: account.address }), async () => {
      const next = loans.filter((l) => l !== loanId);
      localStorage.setItem(LS_LOANS, JSON.stringify(next));
      setLoans(next);
    });
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

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Buy_Now_Pay_Never</span>
        <h1 className="text-3xl md:text-5xl tracking-tighter font-black uppercase italic">Private_Consumer_Credit</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="USDT_Balance" value={usdtBalance.toLocaleString()} />
        <Stat label="Credit_Limit" value={profile ? `${profile.creditLimit}` : "—"} />
        <Stat label="Outstanding" value={profile ? `${profile.outstanding}` : "—"} />
        <Stat label="Available_Credit" value={profile ? `${profile.available}` : "—"} />
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={onFaucet} disabled={!!busy}
          className="px-5 h-11 rounded-xl bg-white/5 border border-border/40 text-[11px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40 flex items-center gap-2">
          {busy === "Mint 500 USDT" ? <Loader2 size={14} className="animate-spin" /> : <Wallet size={14} />} Get_500_USDT
        </button>

        {!profileId && (
          <button onClick={onCreateProfile} disabled={!!busy}
            className="px-5 h-11 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center gap-2">
            {busy === "Open credit profile" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Open_Credit_Profile
          </button>
        )}

        {profileId && (
          <button onClick={onBuyNow} disabled={!!busy || usdtBalance < COLLATERAL}
            className="px-5 h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.02] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 flex items-center gap-2">
            {busy === "Buy Now ($30)" ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />} Buy_Now_$30 (lock {COLLATERAL}_USDT)
          </button>
        )}
      </div>

      {profileId && usdtBalance < COLLATERAL && (
        <p className="text-[11px] text-amber-400/80 flex items-center gap-2"><AlertTriangle size={12} /> Need ≥ {COLLATERAL} USDT to collateralize — mint some first.</p>
      )}

      {/* Active loans */}
      {loans.length > 0 && (
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Active_Loans</span>
          {loans.map((l) => (
            <div key={l} className="bg-[#0d0f14] border border-border/30 rounded-2xl p-4 flex items-center justify-between gap-4">
              <span className="text-[11px] text-foreground/50 font-mono truncate">{l}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => onYieldRepay(l)} disabled={!!busy || usdtBalance < 10}
                  title="Route DeepBook yield to repay (Pay-Never)"
                  className="px-3 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40">
                  ⚡Yield_10
                </button>
                <button onClick={() => onRepay(l)} disabled={!!busy || usdtBalance < REPAY_AMOUNT}
                  className="px-4 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40 flex items-center gap-2">
                  {busy === "Repay loan" ? <Loader2 size={12} className="animate-spin" /> : null} Repay_{REPAY_AMOUNT}_USDT
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && (
        <div className={`p-4 rounded-2xl text-xs break-all ${msg.kind === "ok" ? "bg-green-500/10 border border-green-500/20 text-green-400" : "bg-red-500/10 border border-red-500/20 text-red-400"}`}>
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            {msg.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />} {msg.text}
          </div>
          {msg.digest && (
            <a href={suiscanTxUrl(msg.digest)} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] opacity-70 hover:opacity-100">
              {msg.digest} <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      <p className="text-[10px] text-foreground/30 leading-relaxed max-w-2xl">
        Over-collateralized core: lock {COLLATERAL} USDT, the pool fronts your ${BUY_AMOUNT} purchase to the merchant now,
        and each repayment grows your credit limit. Yield routed from your collateral can auto-repay the loan
        (&ldquo;Pay Never&rdquo;). Credit scoring runs privately in the TEE.
      </p>
    </div>
  );
}
