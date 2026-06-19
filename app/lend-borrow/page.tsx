"use client";

import { useCallback, useEffect, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Loader2, Wallet, TrendingUp, Lock, ShieldCheck, Coins } from "lucide-react";
import { useTx, findCreated } from "@/lib/use-tx";
import { faucetTx, readCreditProfile, openProfileTx, USDT_COIN_TYPE, type CreditProfileView } from "@/lib/bnpl";
import {
  supplyTx,
  borrowCollateralizedTx,
  repayCollateralizedTx,
  releaseCollateralTx,
  borrowUncollateralizedTx,
  repayUncollateralizedTx,
} from "@/lib/market";

const LS_PROFILE = "xorr_bnpl_profile";
const LS_COLLAT = "xorr_market_collat";
const LS_UNCOLLAT = "xorr_market_uncollat";
const MIN_SCORE = 600;

type CollatPos = { id: string; lockId: string; repay: number };
type UnsecPos = { id: string; repay: number };

export default function LendBorrowPage() {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const runTx = useTx();

  const [usdt, setUsdt] = useState(0);
  const [primaryCoin, setPrimaryCoin] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<CreditProfileView | null>(null);
  const [collat, setCollat] = useState<CollatPos[]>([]);
  const [unsec, setUnsec] = useState<UnsecPos[]>([]);
  const [supplyAmt, setSupplyAmt] = useState("100");
  const [borrowAmt, setBorrowAmt] = useState("50");
  const [unsecAmt, setUnsecAmt] = useState("25");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setProfileId(localStorage.getItem(LS_PROFILE));
    try { setCollat(JSON.parse(localStorage.getItem(LS_COLLAT) || "[]")); } catch { /* */ }
    try { setUnsec(JSON.parse(localStorage.getItem(LS_UNCOLLAT) || "[]")); } catch { /* */ }
  }, []);

  const refresh = useCallback(async () => {
    if (!account) return;
    const coins = await client.getCoins({ owner: account.address, coinType: USDT_COIN_TYPE });
    let total = BigInt(0), best: string | null = null, bestBal = BigInt(0);
    for (const c of coins.data) { const b = BigInt(c.balance); total += b; if (b > bestBal) { bestBal = b; best = c.coinObjectId; } }
    setUsdt(Number(total) / 1e6);
    setPrimaryCoin(best);
    if (profileId) setProfile(await readCreditProfile(client, profileId));
  }, [account, client, profileId]);

  useEffect(() => { refresh(); }, [refresh]);

  const guard = async (label: string, fn: () => Promise<void>) => {
    if (!account || busy) return;
    setBusy(true);
    try { await fn(); await refresh(); } catch { /* toast already shown */ } finally { setBusy(false); }
  };

  const saveCollat = (next: CollatPos[]) => { localStorage.setItem(LS_COLLAT, JSON.stringify(next)); setCollat(next); };
  const saveUnsec = (next: UnsecPos[]) => { localStorage.setItem(LS_UNCOLLAT, JSON.stringify(next)); setUnsec(next); };

  const sender = account?.address ?? "";

  const onFaucet = () => guard("faucet", async () => { await runTx("Mint 500 USDC", faucetTx(500)); });

  const onProfile = () => guard("profile", async () => {
    const res = await runTx("Open credit profile", openProfileTx());
    const id = findCreated(res, "::credit::CreditProfile");
    if (id) { localStorage.setItem(LS_PROFILE, id); setProfileId(id); }
  });

  const onSupply = () => guard("supply", async () => {
    if (!primaryCoin) return;
    await runTx(`Supply ${supplyAmt} USDC`, supplyTx(primaryCoin, Number(supplyAmt), sender));
  });

  const onBorrowCollat = () => guard("borrow", async () => {
    if (!primaryCoin) return;
    const amt = Number(borrowAmt);
    const col = Math.ceil(amt * 1.5);
    const res = await runTx(`Borrow ${amt} USDC (collateralized)`, borrowCollateralizedTx(primaryCoin, amt, col, sender));
    const id = findCreated(res, "::market::CollateralizedPosition<");
    const lockId = findCreated(res, "::collateral::CollateralLock<");
    if (id && lockId) saveCollat([...collat, { id, lockId, repay: +(amt * 1.05).toFixed(6) }]);
  });

  const onRepayCollat = (p: CollatPos) => guard("repay", async () => {
    if (!primaryCoin || !profileId) return;
    await runTx(`Repay ${p.repay} USDC`, repayCollateralizedTx(p.id, profileId, primaryCoin, p.repay, sender));
    // leave the position so the user can reclaim collateral, then drop on reclaim
  });

  const onReclaim = (p: CollatPos) => guard("reclaim", async () => {
    await runTx("Reclaim collateral", releaseCollateralTx(p.id, p.lockId, sender));
    saveCollat(collat.filter((x) => x.id !== p.id));
  });

  const onBorrowUnsec = () => guard("borrow", async () => {
    if (!profileId) return;
    const amt = Number(unsecAmt);
    const res = await runTx(`Borrow ${amt} USDC (unsecured)`, borrowUncollateralizedTx(profileId, amt, sender));
    const id = findCreated(res, "::market::UnsecuredPosition<");
    if (id) saveUnsec([...unsec, { id, repay: +(amt * 1.1).toFixed(6) }]);
  });

  const onRepayUnsec = (p: UnsecPos) => guard("repay", async () => {
    if (!primaryCoin || !profileId) return;
    await runTx(`Repay ${p.repay} USDC`, repayUncollateralizedTx(p.id, profileId, primaryCoin, p.repay, sender));
    saveUnsec(unsec.filter((x) => x.id !== p.id));
  });

  if (!account) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 font-mono text-white">
        <Wallet className="w-8 h-8 text-primary/60" />
        <p className="text-sm text-foreground/50 uppercase tracking-widest">Connect your Sui wallet to lend &amp; borrow</p>
      </div>
    );
  }

  const score = profile?.score ?? 0;
  const canUnsec = !!profileId && score >= MIN_SCORE && Number(unsecAmt) <= (profile?.available ?? 0);

  const Card = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
    <div className="bg-[#0d0f14] border border-border/30 rounded-3xl p-6 space-y-4 flex flex-col">
      <div className="flex items-center gap-2 text-primary/70 text-[10px] font-black uppercase tracking-widest">{icon}{title}</div>
      {children}
    </div>
  );
  const Field = ({ v, set }: { v: string; set: (s: string) => void }) => (
    <input type="number" value={v} onChange={(e) => set(e.target.value)} className="w-full bg-[#05080f]/60 border border-border/20 rounded-xl px-3 py-2.5 text-lg font-light text-white focus:outline-none focus:border-primary/40" />
  );
  const Btn = ({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
    <button onClick={onClick} disabled={disabled || busy}
      className="w-full h-11 rounded-xl bg-primary text-black text-[11px] font-black uppercase tracking-widest hover:scale-[1.01] disabled:opacity-40 disabled:bg-white/5 disabled:text-foreground/30 flex items-center justify-center gap-2 transition-all">
      {busy ? <Loader2 size={14} className="animate-spin" /> : null}{children}
    </button>
  );

  return (
    <div className="flex-1 flex flex-col py-8 gap-8 w-full font-mono text-white">
      <div className="flex flex-col gap-2">
        <span className="text-[10px] tracking-[0.4em] text-primary/60 uppercase">XORR // Lend_Borrow_Market</span>
        <h1 className="text-3xl md:text-5xl tracking-tighter font-black uppercase">Money_Market</h1>
      </div>

      {/* top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["USDC", usdt.toLocaleString()], ["Credit_Limit", profile ? `${profile.creditLimit}` : "—"], ["Available", profile ? `${profile.available}` : "—"], ["TEE_Score", profile ? `${score}` : "—"]].map(([l, v]) => (
          <div key={l} className="bg-[#05080f]/60 border border-border/20 rounded-2xl p-4 flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">{l}</span>
            <span className="text-2xl font-light tracking-tighter">{v}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <button onClick={onFaucet} disabled={busy} className="px-5 h-10 rounded-xl bg-white/5 border border-border/40 text-[11px] font-black uppercase tracking-widest hover:border-primary/40 disabled:opacity-40 flex items-center gap-2"><Coins size={14} /> Get_500_USDC</button>
        {!profileId && <button onClick={onProfile} disabled={busy} className="px-5 h-10 rounded-xl bg-primary/10 border border-primary/30 text-primary text-[11px] font-black uppercase tracking-widest hover:bg-primary/20 disabled:opacity-40">Open_Credit_Profile</button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supply */}
        <Card icon={<TrendingUp size={14} />} title="Supply (earn yield)">
          <p className="text-[11px] text-foreground/40">Deposit USDC into the pool. Earns interest from borrowers + routed DeepBook yield.</p>
          <Field v={supplyAmt} set={setSupplyAmt} />
          <Btn onClick={onSupply} disabled={!primaryCoin || usdt < Number(supplyAmt)}>Supply_USDC</Btn>
        </Card>

        {/* Over-collateralized borrow */}
        <Card icon={<Lock size={14} />} title="Borrow — collateralized">
          <p className="text-[11px] text-foreground/40">Lock 150% USDC collateral, borrow instantly. No credit needed.</p>
          <Field v={borrowAmt} set={setBorrowAmt} />
          <p className="text-[10px] text-foreground/30">Collateral required: {Math.ceil(Number(borrowAmt) * 1.5)} USDC · repay {(Number(borrowAmt) * 1.05).toFixed(2)}</p>
          <Btn onClick={onBorrowCollat} disabled={!primaryCoin || usdt < Math.ceil(Number(borrowAmt) * 1.5)}>Borrow_Collateralized</Btn>
        </Card>

        {/* Under-collateralized borrow */}
        <Card icon={<ShieldCheck size={14} />} title="Borrow — unsecured (TEE)">
          <p className="text-[11px] text-foreground/40">No collateral — backed by your private TEE credit score (≥ {MIN_SCORE}) and credit line.</p>
          <Field v={unsecAmt} set={setUnsecAmt} />
          <p className="text-[10px] text-foreground/30">repay {(Number(unsecAmt) * 1.1).toFixed(2)} · 10% rate</p>
          <Btn onClick={onBorrowUnsec} disabled={!canUnsec}>Borrow_Unsecured</Btn>
          {!!profileId && score < MIN_SCORE && (
            <p className="text-[10px] text-amber-400/70">Locked: needs a TEE credit score ≥ {MIN_SCORE} (the credit enclave signs it).</p>
          )}
        </Card>
      </div>

      {/* positions */}
      {(collat.length > 0 || unsec.length > 0) && (
        <div className="flex flex-col gap-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Open_Positions</span>
          {collat.map((p) => (
            <div key={p.id} className="bg-[#0d0f14] border border-border/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <span className="text-[11px] text-foreground/50 truncate flex items-center gap-2"><Lock size={12} className="text-primary/60" />{p.id}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => onRepayCollat(p)} disabled={busy || usdt < p.repay} className="px-3 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase hover:bg-primary/20 disabled:opacity-40">Repay_{p.repay}</button>
                <button onClick={() => onReclaim(p)} disabled={busy} className="px-3 h-9 rounded-lg bg-white/5 border border-border/40 text-[10px] font-black uppercase hover:border-primary/40 disabled:opacity-40">Reclaim</button>
              </div>
            </div>
          ))}
          {unsec.map((p) => (
            <div key={p.id} className="bg-[#0d0f14] border border-border/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <span className="text-[11px] text-foreground/50 truncate flex items-center gap-2"><ShieldCheck size={12} className="text-primary/60" />{p.id}</span>
              <button onClick={() => onRepayUnsec(p)} disabled={busy || usdt < p.repay} className="px-3 h-9 rounded-lg bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase hover:bg-primary/20 disabled:opacity-40 flex-shrink-0">Repay_{p.repay}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
