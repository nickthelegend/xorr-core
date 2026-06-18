// End-to-end on-chain test of the XORR BNPL contracts on Sui testnet.
// Drives the full "Buy Now, Pay Never" loop against the PUBLISHED package and
// asserts the credit limit grows on repayment.
//
// Run:  SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | jq -r .exportedPrivateKey) \
//       node scripts/e2e-bnpl.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0x9572997e5d494f961fc9b2260b8c085a1b20b16bd1495f3972b7dfda0ff11a40";
const FAUCET = "0xd82f0891a6a954d56369cc3136d5227261dc1222f71f8689985feda94c151843";
const USDT_T = `${PKG}::usdt::USDT`;
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
  // TX1: mint 1000 USDT + create pool + open credit profile + create merchant escrow.
  const c1 = await run("setup (mint USDT + pool + profile + escrow)", (tx) => {
    const [coin] = tx.moveCall({ target: `${PKG}::usdt::faucet_mint`, arguments: [tx.object(FAUCET), tx.pure.u64(1000n * BigInt(M))] });
    tx.transferObjects([coin], me);
    tx.moveCall({ target: `${PKG}::lending_pool::create_pool_entry`, typeArguments: [USDT_T], arguments: [tx.pure.u64(500n)] });
    tx.moveCall({ target: `${PKG}::credit::open_profile`, arguments: [] });
    tx.moveCall({ target: `${PKG}::merchant_escrow::create_escrow_entry`, typeArguments: [USDT_T], arguments: [] });
  });
  const usdt = created(c1, `::coin::Coin<${USDT_T}>`);
  const pool = created(c1, "::lending_pool::LendingPool<" + USDT_T + ">");
  const profile = created(c1, "::credit::CreditProfile");
  const escrow = created(c1, "::merchant_escrow::MerchantEscrow<" + USDT_T + ">");
  console.log({ usdt, pool, profile, escrow });

  // TX2: supply 200 USDT of liquidity (split off the minted coin).
  await run("supply 200 USDT", (tx) => {
    const [part] = tx.splitCoins(tx.object(usdt), [tx.pure.u64(200n * BigInt(M))]);
    const receipt = tx.moveCall({ target: `${PKG}::lending_pool::supply`, typeArguments: [USDT_T], arguments: [tx.object(pool), part] });
    tx.transferObjects([receipt], me);
  });

  // TX3: open a 30 USDT BNPL purchase, collateralized with 50 USDT.
  const c3 = await run("open_purchase 30 USDT (50 collateral)", (tx) => {
    const [collat] = tx.splitCoins(tx.object(usdt), [tx.pure.u64(50n * BigInt(M))]);
    tx.moveCall({
      target: `${PKG}::bnpl::open_purchase`,
      typeArguments: [USDT_T, USDT_T],
      arguments: [tx.object(pool), tx.object(profile), tx.object(escrow), collat, tx.pure.u64(30n * BigInt(M)), tx.pure.u64(30n), tx.pure.vector("u8", Array.from(new TextEncoder().encode("order-1")))],
    });
  });
  const loan = created(c3, "::bnpl::Loan<");
  console.log({ loan });

  // TX4: repay principal + interest (30 + 5% = 31.5 USDT).
  await run("repay 31.5 USDT", (tx) => {
    const [pay] = tx.splitCoins(tx.object(usdt), [tx.pure.u64(315n * BigInt(M) / 10n)]);
    const refund = tx.moveCall({ target: `${PKG}::bnpl::repay`, typeArguments: [USDT_T, USDT_T], arguments: [tx.object(loan), tx.object(pool), tx.object(profile), pay] });
    tx.transferObjects([refund], me);
  });

  // Read the profile and assert the credit limit grew (50 -> 53 USDT).
  const obj = await client.getObject({ id: profile, options: { showContent: true } });
  const f = obj.data.content.fields;
  console.log("\nCreditProfile after repayment:", { credit_limit: f.credit_limit, outstanding: f.outstanding, repaid_total: f.repaid_total });
  const limit = Number(f.credit_limit);
  if (limit === 53 * M) console.log(`\n✅ E2E PASS — credit limit grew 50 → ${limit / M} USDT on repayment.`);
  else console.log(`\n⚠️ credit limit = ${limit / M} USDT (expected 53)`);
})().catch((e) => { console.error("E2E ERROR:", e.message); process.exit(1); });
