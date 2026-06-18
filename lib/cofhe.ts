// TODO(xorr): Sui has NO FHE. This file was the Fhenix CoFHE (@cofhe/sdk) client
// for the legacy EVM build. All FHE client usage has been removed; these are
// plaintext stubs that keep the original exported signatures so legacy
// importers still typecheck. Replace with real Sui Move calls (Move handles
// confidentiality via the TEE score path, not client-side FHE).

/** Stub replacement for the former `@cofhe/sdk` `FheTypes` enum. */
export const FheTypes = {
  Uint8: 0,
  Uint16: 1,
  Uint32: 2,
  Uint64: 3,
  Bool: 4,
} as const;

// TODO(xorr): no FHE client on Sui — returns a dummy handle.
export async function getCoFHEClient(_signer: any): Promise<any> {
  return {};
}

/** Plaintext stub: returns the value unencrypted in a CoFHE-shaped wrapper. */
export async function encryptUint64(_client: any, value: bigint) {
  // TODO(xorr): no client-side encryption on Sui; pass plaintext u64 to Move.
  return {
    handle: "0x" + value.toString(16),
    ctHash: value,
    signature: "0x",
    data: value,
  };
}

/** Plaintext stub: returns the value unencrypted in a CoFHE-shaped wrapper. */
export async function encryptUint32(_client: any, value: number) {
  // TODO(xorr): no client-side encryption on Sui; pass plaintext u32 to Move.
  return {
    handle: "0x" + value.toString(16),
    ctHash: BigInt(value),
    signature: "0x",
    data: BigInt(value),
  };
}

/** Plaintext stub: "decryption" is a no-op on Sui (values are already clear). */
export async function decryptView(
  _client: any,
  handle: bigint,
  _fheType: number = FheTypes.Uint64,
): Promise<bigint> {
  // TODO(xorr): read the clear value from a Sui object instead.
  return handle;
}

/** Plaintext stub for the former on-chain reveal flow. */
export async function decryptForTransaction(_client: any, handle: bigint) {
  // TODO(xorr): port the reveal/audit flow to Sui Move.
  return {
    decryptedValue: handle,
    signature: "0x",
  };
}
