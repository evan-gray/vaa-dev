// Once the SDK is lighter weight, make some use here
import axios from "axios";
import { ChainId, coalesceChainName, CONTRACTS } from "../sdk/consts";

const MAINNET_RPCS_BY_CHAIN: { [id in ChainId]?: string } = {
  1: "https://api.mainnet-beta.solana.com",
  2: "https://rpc.ankr.com/eth",
  3: "https://columbus-lcd.terra.dev",
  4: "https://rpc.ankr.com/bsc",
  5: "https://rpc.ankr.com/polygon",
  6: "https://rpc.ankr.com/avalanche",
  7: "https://emerald.oasis.dev",
  8: "https://mainnet-api.algonode.cloud",
  10: "https://rpc.ankr.com/fantom",
  11: "https://eth-rpc-karura.aca-api.network",
  12: "https://eth-rpc-acala.aca-api.network",
  13: "https://rpc.ankr.com/klaytn",
  14: "https://forno.celo.org",
  15: "https://rpc.mainnet.near.org",
  16: "https://rpc.ankr.com/moonbeam",
  18: "https://phoenix-lcd.terra.dev",
  19: "https://k8s.mainnet.lcd.injective.network",
  22: "https://fullnode.mainnet.aptoslabs.com/",
  23: "https://rpc.ankr.com/arbitrum",
  24: "https://rpc.ankr.com/optimism",
  28: "https://dimension-lcd.xpla.dev",
  30: "https://mainnet.base.org",
};

const TESTNET_RPCS_BY_CHAIN: { [id in ChainId]?: string } = {
  1: "https://api.devnet.solana.com",
  2: "https://rpc.ankr.com/eth_goerli",
  4: "https://rpc.ankr.com/bsc_testnet_chapel",
  5: "https://rpc.ankr.com/polygon_mumbai",
  6: "https://rpc.ankr.com/avalanche_fuji",
  7: "https://testnet.emerald.oasis.dev",
  8: "https://testnet-api.algonode.cloud",
  10: "https://rpc.ankr.com/fantom_testnet",
  11: "https://eth-rpc-karura-testnet.aca-staging.network",
  12: "https://eth-rpc-acala-testnet.aca-staging.network",
  13: "https://rpc.ankr.com/klaytn_testnet",
  14: "https://alfajores-forno.celo-testnet.org",
  15: "https://rpc.testnet.near.org",
  16: "https://moonbeam-alpha.api.onfinality.io/public",
  22: "https://rpc.ankr.com/http/aptos_testnet/v1/",
  23: "https://goerli-rollup.arbitrum.io/rpc",
  24: "https://rpc.ankr.com/optimism_testnet",
  30: "https://goerli.base.org",
};

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
  env: Env
): string[] {
  const chainName = coalesceChainName(chainId as ChainId);
  return logs
    .filter(
      (l) =>
        l.address.toLowerCase() ===
          CONTRACTS[env][chainName].core?.toLowerCase() &&
        l.topics[0] === LOG_MESSAGE_PUBLISHED_TOPIC
    )
    .map(
      (l) =>
        `${chainId}/${l.topics[1].slice(2)}/${BigInt(
          l.data.slice(0, 66)
        ).toString()}`
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
                env
              ),
            } as TxInfo)
          );
        })()
      : (async () => {})();

export default async function fetchTx(hash: string): Promise<TxInfo[]> {
  return (
    await Promise.all([
      ...Object.entries(MAINNET_RPCS_BY_CHAIN).map(
        makeFetchTxForChain(hash, "MAINNET")
      ),
      ...Object.entries(TESTNET_RPCS_BY_CHAIN).map(
        makeFetchTxForChain(hash, "TESTNET")
      ),
    ])
  )
    .filter((r) => !!r)
    .flat();
}
