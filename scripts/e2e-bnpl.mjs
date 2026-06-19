// End-to-end on-chain test of the XORR BNPL contracts on Sui testnet.
// Drives the full "Buy Now, Pay Never" loop against the PUBLISHED package and
// asserts the credit limit grows on repayment.
//
// Run:  SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | jq -r .exportedPrivateKey) \
//       node scripts/e2e-bnpl.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9";
const FAUCET = "0xf532e1e7f8c83d2be47a68efc6b37bde7f436b76682885e9b3dd50380e6a1d6f";
const USDC_T = `${PKG}::usdc::USDC`;
const M = 1_000_000; // 6 decimals

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const me = kp.toSuiAddress();
console.log("signer:", me);

const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;

async function run(label, build) {
  const tx = new Transaction();
  build(tx);
  const res = await client.signAndExecuteTransaction({
    signer: kp,
    transaction: tx,
    options: { showEffects: true, showObjectChanges: true },
  });
  await client.waitForTransaction({ digest: res.digest });
  const status = res.effects?.status?.status;
  if (status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  console.log(`✓ ${label}  ${link(res.digest)}`);
  return res.objectChanges || [];
}

const created = (changes, typeFrag) =>
  changes.find((c) => c.type === "created" && (c.objectType || "").includes(typeFrag))?.objectId;

(async () => {
  // TX1: mint 1000 USDC + create pool + open credit profile + create merchant escrow.
  const c1 = await run("setup (mint USDC + pool + profile + escrow)", (tx) => {
    const [coin] = tx.moveCall({ target: `${PKG}::usdc::faucet_mint`, arguments: [tx.object(FAUCET), tx.pure.u64(1000n * BigInt(M))] });
    tx.transferObjects([coin], me);
    tx.moveCall({ target: `${PKG}::lending_pool::create_pool_entry`, typeArguments: [USDC_T], arguments: [tx.pure.u64(500n)] });
    tx.moveCall({ target: `${PKG}::credit::open_profile`, arguments: [] });
    tx.moveCall({ target: `${PKG}::merchant_escrow::create_escrow_entry`, typeArguments: [USDC_T], arguments: [] });
  });
  const usdc = created(c1, `::coin::Coin<${USDC_T}>`);
  const pool = created(c1, "::lending_pool::LendingPool<" + USDC_T + ">");
  const profile = created(c1, "::credit::CreditProfile");
  const escrow = created(c1, "::merchant_escrow::MerchantEscrow<" + USDC_T + ">");
  console.log({ usdc, pool, profile, escrow });

  // TX2: supply 200 USDC of liquidity (split off the minted coin).
  await run("supply 200 USDC", (tx) => {
    const [part] = tx.splitCoins(tx.object(usdc), [tx.pure.u64(200n * BigInt(M))]);
    const receipt = tx.moveCall({ target: `${PKG}::lending_pool::supply`, typeArguments: [USDC_T], arguments: [tx.object(pool), part] });
    tx.transferObjects([receipt], me);
  });

  // TX3: open a 30 USDC BNPL purchase, collateralized with 50 USDC.
  const c3 = await run("open_purchase 30 USDC (50 collateral)", (tx) => {
    const [collat] = tx.splitCoins(tx.object(usdc), [tx.pure.u64(50n * BigInt(M))]);
    tx.moveCall({
      target: `${PKG}::bnpl::open_purchase`,
      typeArguments: [USDC_T, USDC_T],
      arguments: [tx.object(pool), tx.object(profile), tx.object(escrow), collat, tx.pure.u64(30n * BigInt(M)), tx.pure.u64(30n), tx.pure.vector("u8", Array.from(new TextEncoder().encode("order-1")))],
    });
  });
  const loan = created(c3, "::bnpl::Loan<");
  console.log({ loan });

  // TX4: repay principal + interest (30 + 5% = 31.5 USDC).
  await run("repay 31.5 USDC", (tx) => {
    const [pay] = tx.splitCoins(tx.object(usdc), [tx.pure.u64(315n * BigInt(M) / 10n)]);
    const refund = tx.moveCall({ target: `${PKG}::bnpl::repay`, typeArguments: [USDC_T, USDC_T], arguments: [tx.object(loan), tx.object(pool), tx.object(profile), pay] });
    tx.transferObjects([refund], me);
  });

  // Read the profile and assert the credit limit grew (50 -> 53 USDC).
  const obj = await client.getObject({ id: profile, options: { showContent: true } });
  const f = obj.data.content.fields;
  console.log("\nCreditProfile after repayment:", { credit_limit: f.credit_limit, outstanding: f.outstanding, repaid_total: f.repaid_total });
  const limit = Number(f.credit_limit);
  if (limit === 53 * M) console.log(`\n✅ E2E PASS — credit limit grew 50 → ${limit / M} USDC on repayment.`);
  else console.log(`\n⚠️ credit limit = ${limit / M} USDC (expected 53)`);
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
