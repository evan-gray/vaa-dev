// Adapted from https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/vaa/wormhole.ts
import { Buffer } from "buffer";
import { SignedVaa } from "../sdk/wormhole";

export type VaaIndexes = {
  [key: string]: [number, number];
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
    guardianSignatures: [sigStart, sigEnd],
    timestamp: [sigEnd, sigEnd + 4],
    nonce: [sigEnd + 4, sigEnd + 8],
    emitterChain: [sigEnd + 8, sigEnd + 10],
    emitterAddress: [sigEnd + 10, sigEnd + 42],
    sequence: [sigEnd + 42, sigEnd + 50],
    consistencyLevel: [sigEnd + 50, sigEnd + 51],
    payload: [sigEnd + 51, signedVaa.length],
  };
}
