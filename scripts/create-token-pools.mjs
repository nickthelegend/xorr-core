// Create LendingPool<T> instances for DUSDC (DeepBook USDC) and DEEP so the
// markets page can list them alongside USDC. The pool type is generic.
// Run: SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | grep -oE 'suiprivkey1[a-z0-9]+') node scripts/create-token-pools.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";

const PKG = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9";
const DUSDC = "0xe95040085976bfd54a1a07225cd46c8a2b4e8e2b6732f140a0fc49850ba73e1a::dusdc::DUSDC";
const DEEP = "0x36dbef866a1d62bf7328989a10fb2f07d769f4ee587c0de4a0a256e57e0a58a8::deep::DEEP";

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);
const link = (d) => `https://suiscan.xyz/testnet/tx/${d}`;

async function createPool(coinType, label) {
  const tx = new Transaction();
  tx.setGasBudget(60000000);
  tx.moveCall({ target: `${PKG}::lending_pool::create_pool_entry`, typeArguments: [coinType], arguments: [tx.pure.u64(500n)] });
  const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== "success") throw new Error(`${label} FAILED: ${JSON.stringify(res.effects?.status)}`);
  const pool = res.objectChanges.find((o) => o.type === "created" && (o.objectType || "").includes("::lending_pool::LendingPool"))?.objectId;
  console.log(`✓ ${label} pool: ${pool}   ${link(res.digest)}`);
  return pool;
}

(async () => {
  const dusdc = await createPool(DUSDC, "DUSDC");
  const deep = await createPool(DEEP, "DEEP");
  console.log("\nDUSDC_POOL=" + dusdc);
  console.log("DEEP_POOL=" + deep);
})().catch((e) => { console.error("ERROR:", e.message); process.exit(1); });
