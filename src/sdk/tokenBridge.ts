// Adapted from https://github.com/wormhole-foundation/wormhole/blob/main/sdk/js/src/vaa/wormhole.ts
// Didn't want the extra imports yet
import { Buffer } from "buffer";

import { ParsedVaa, parseVaa, SignedVaa } from "./wormhole";

export enum TokenBridgePayload {
  Transfer = 1,
  AttestMeta,
  TransferWithPayload,
}

export enum TokenBridgeGovernanceAction {
  RegisterChain = 1,
  UpgradeContract = 2,
}

export interface TokenTransfer {
  payloadType:
    | TokenBridgePayload.Transfer
    | TokenBridgePayload.TransferWithPayload;
  amount: bigint;
  tokenAddress: Buffer;
  tokenChain: number;
  to: Buffer;
  toChain: number;
  fee: bigint | null;
  fromAddress: Buffer | null;
  tokenTransferPayload: Buffer;
}

export function parseTokenTransferPayload(payload: Buffer): TokenTransfer {
  const payloadType = payload.readUInt8(0);
  if (
    payloadType !== TokenBridgePayload.Transfer &&
    payloadType !== TokenBridgePayload.TransferWithPayload
  ) {
    throw new Error("not token bridge transfer VAA");
  }
  const amount = BigInt(`0x${payload.subarray(1, 33).toString("hex")}`);
  const tokenAddress = payload.subarray(33, 65);
  const tokenChain = payload.readUInt16BE(65);
  const to = payload.subarray(67, 99);
  const toChain = payload.readUInt16BE(99);
  const fee =
    payloadType === 1
      ? BigInt(`0x${payload.subarray(101, 133).toString("hex")}`)
      : null;
  const fromAddress = payloadType === 3 ? payload.subarray(101, 133) : null;
  const tokenTransferPayload = payload.subarray(133);
  return {
    payloadType,
    amount,
    tokenAddress,
    tokenChain,
    to,
    toChain,
    fee,
    fromAddress,
    tokenTransferPayload,
  };
}

export interface ParsedTokenTransferVaa extends ParsedVaa, TokenTransfer {}

export function parseTokenTransferVaa(vaa: SignedVaa): ParsedTokenTransferVaa {
  const parsed = parseVaa(vaa);
  return {
    ...parsed,
    ...parseTokenTransferPayload(parsed.payload),
  };
}

export interface AssetMeta {
  payloadType: TokenBridgePayload.AttestMeta;
  tokenAddress: Buffer;
  tokenChain: number;
  decimals: number;
  symbol: string;
  name: string;
}
