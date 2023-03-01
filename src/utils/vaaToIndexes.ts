// Adapted from https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/vaa/wormhole.ts
import { Buffer } from "buffer";
import { TokenBridgePayload } from "../sdk/tokenBridge";
import { SignedVaa } from "../sdk/wormhole";

export type VaaIndexes = {
  [key: string]: [number, number] | undefined;
};

export function vaaToIndexes(vaa: SignedVaa): VaaIndexes {
  const signedVaa = Buffer.isBuffer(vaa) ? vaa : Buffer.from(vaa as Uint8Array);
  const sigStart = 6;
  const numSigners = signedVaa[5];
  const sigLength = 66;
  const sigEnd = sigStart + sigLength * numSigners;

  return {
    version: [0, 1],
    guardianSetIndex: [1, 5],
    guardianSignatures: [5, sigEnd],
    timestamp: [sigEnd, sigEnd + 4],
    nonce: [sigEnd + 4, sigEnd + 8],
    emitterChain: [sigEnd + 8, sigEnd + 10],
    emitterAddress: [sigEnd + 10, sigEnd + 42],
    sequence: [sigEnd + 42, sigEnd + 50],
    consistencyLevel: [sigEnd + 50, sigEnd + 51],
    payload: [sigEnd + 51, signedVaa.length],
  };
}

export function tokenTransferPayloadToIndexes(payload: Buffer): VaaIndexes {
  const payloadType = payload.readUInt8(0);
  if (
    payloadType !== TokenBridgePayload.Transfer &&
    payloadType !== TokenBridgePayload.TransferWithPayload
  ) {
    throw new Error("not token bridge transfer VAA");
  }
  return {
    payloadType: [0, 1],
    amount: [1, 33],
    tokenAddress: [33, 65],
    tokenChain: [65, 67],
    toAddress: [67, 99],
    toChain: [99, 101],
    fee: payloadType === 1 ? [101, 133] : undefined,
    fromAddress: payloadType === 3 ? [101, 133] : undefined,
    tokenTransferPayload: [133, payload.length],
  };
}
