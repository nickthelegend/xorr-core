// Upgrade the xorr_contracts package in place (adds the Nitro-attestation path
// to confidential_credit, keeping the same package id / pool / escrow / coin).
// Submitted via the SDK because the local sui CLI lags testnet's protocol version.
//   sui move build --dump-bytecode-as-base64 > /tmp/xorr_bytecode.json
//   SUI_PRIVATE_KEY=$(sui keytool export --key-identity xorr-deployer --json | grep -oE 'suiprivkey1[a-z0-9]+') node scripts/upgrade-confidential.mjs
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { readFileSync } from "fs";

const OLD_PKG = "0xa105190b2218938815920010957f7adf856940452e304a63e195e132f14713b9";
const UPGRADE_CAP = "0x269955cfe57732e0f8179c73c0d99bf8ce13acfe216c4f8486b9de9830f09364";
const { modules, dependencies, digest } = JSON.parse(readFileSync("/tmp/xorr_bytecode.json", "utf8"));

const client = new SuiJsonRpcClient({ url: "https://fullnode.testnet.sui.io:443", network: "testnet" });
const kp = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY);

// Upgrade against the cap's CURRENT package (latest version) so chained upgrades work.
const capObj = await client.getObject({ id: UPGRADE_CAP, options: { showContent: true } });
const CURRENT_PKG = capObj.data.content.fields.package;
console.log("upgrading from current package:", CURRENT_PKG, "(original/type-origin:", OLD_PKG + ")");

const tx = new Transaction();
const cap = tx.object(UPGRADE_CAP);
const ticket = tx.moveCall({
  target: "0x2::package::authorize_upgrade",
  arguments: [cap, tx.pure.u8(0), tx.pure.vector("u8", digest)],
});
const receipt = tx.upgrade({ modules, dependencies, package: CURRENT_PKG, ticket });
tx.moveCall({ target: "0x2::package::commit_upgrade", arguments: [cap, receipt] });
tx.setGasBudget(180000000);

const res = await client.signAndExecuteTransaction({ signer: kp, transaction: tx, options: { showEffects: true, showObjectChanges: true } });
await client.waitForTransaction({ digest: res.digest });
if (res.effects?.status?.status !== "success") { console.error("UPGRADE FAILED:", JSON.stringify(res.effects?.status)); process.exit(1); }
const pub = (res.objectChanges || []).find((o) => o.type === "published");
console.log("✓ upgrade tx: https://suiscan.xyz/testnet/tx/" + res.digest);
console.log("NEW_PACKAGE_ID=" + (pub?.packageId || "NOT FOUND"));
