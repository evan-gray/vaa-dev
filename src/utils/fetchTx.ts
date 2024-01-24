// Once the SDK is lighter weight, make some use here
import axios from "axios";
import { ChainId, coalesceChainName, CONTRACTS } from "../sdk/consts";
import { MAINNET_RPCS_BY_CHAIN, TESTNET_RPCS_BY_CHAIN } from "./consts";

function isEVMChain(id: number) {
  return (
    id === 2 ||
    id === 4 ||
    id === 5 ||
    id === 6 ||
    id === 7 ||
    id === 10 ||
    id === 11 ||
    id === 12 ||
    id === 13 ||
    id === 14 ||
    id === 16 ||
    id === 23 ||
    id === 24 ||
    id === 30
  );
}

export type Env = "MAINNET" | "TESTNET";

export type TxInfo = {
  env: Env;
  hash: string;
  chain: number;
  block: string;
  from: string;
  messageIds: string[];
};

// This is the hash for topic[0] of the core contract event LogMessagePublished
// https://github.com/wormhole-foundation/wormhole/blob/main/ethereum/contracts/Implementation.sol#L12
export const LOG_MESSAGE_PUBLISHED_TOPIC =
  "0x6eb224fb001ed210e379b335e35efe88672a8ce935d981a6896b27ffdf52a3b2";

function EVMReceiptToMessageIds(
  chainId: number,
  logs: any[],
  env: Env,
): string[] {
  const chainName = coalesceChainName(chainId as ChainId);
  return logs
    .filter(
      (l) =>
        l.address.toLowerCase() ===
          CONTRACTS[env][chainName].core?.toLowerCase() &&
        l.topics[0] === LOG_MESSAGE_PUBLISHED_TOPIC,
    )
    .map(
      (l) =>
        `${chainId}/${l.topics[1].slice(2)}/${BigInt(
          l.data.slice(0, 66),
        ).toString()}`,
    );
}

const makeFetchTxForChain =
  (hash: string, env: "MAINNET" | "TESTNET") =>
  ([chain, rpc]: [string, string]) =>
    hash.startsWith("0x") && isEVMChain(Number(chain))
      ? (async () => {
          const result = await axios.post(rpc, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionReceipt",
            params: [hash],
          });
          const receipt = result.data.result;
          return (
            receipt &&
            ({
              env,
              hash: receipt.transactionHash,
              chain: Number(chain),
              block: receipt.blockNumber,
              from: receipt.from,
              messageIds: EVMReceiptToMessageIds(
                Number(chain),
                receipt.logs,
                env,
              ),
            } as TxInfo)
          );
        })()
      : (async () => {})();

export default async function fetchTx(hash: string): Promise<TxInfo[]> {
  return (
    await Promise.all([
      ...Object.entries(MAINNET_RPCS_BY_CHAIN).map(
        makeFetchTxForChain(hash, "MAINNET"),
      ),
      ...Object.entries(TESTNET_RPCS_BY_CHAIN).map(
        makeFetchTxForChain(hash, "TESTNET"),
      ),
    ])
  )
    .filter((r) => !!r)
    .flat();
}
