import { Launch } from "@mui/icons-material";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  IconButton,
  Link,
  Typography,
} from "@mui/material";
import axios from "axios";
import { Buffer } from "buffer";
import { BigNumber, ethers } from "ethers";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { eth } from "web3";
import {
  EthCallQueryRequest,
  PerChainQueryRequest,
  QueryRequest,
} from "@wormhole-foundation/wormhole-query-sdk";
import {
  CHAIN_ID_ARBITRUM_SEPOLIA,
  CHAIN_ID_BASE_SEPOLIA,
  CHAIN_ID_OPTIMISM_SEPOLIA,
} from "./sdk/consts";
import chainIdToString from "./utils/chainIdToString";
import { TESTNET_RPCS_BY_CHAIN } from "./utils/consts";
import { QueryDemo__factory } from "./utils/contracts";
import { QueryDemo } from "./utils/contracts/QueryDemo";
import { METAMASK_CHAIN_PARAMETERS } from "./utils/metaMaskChainParameters";
import { sleep } from "./utils/sleep";

type QueryResponse = {
  signatures: string[];
  bytes: string;
};

const CONTRACTS = [
  {
    chainId: CHAIN_ID_ARBITRUM_SEPOLIA,
    evmId: 421614,
    name: "Arbitrum Sepolia",
    address: "0x5f1619d5e75225D58f268BBd5E91101345F02ce3",
    backgroundColor: "#DDA0DD20",
    rpc: TESTNET_RPCS_BY_CHAIN[CHAIN_ID_ARBITRUM_SEPOLIA],
    explorer: "https://sepolia.arbiscan.io",
  },
  {
    chainId: CHAIN_ID_BASE_SEPOLIA,
    evmId: 84532,
    name: "Base Sepolia",
    address: "0x2EBE6ec1EeAd93Fb612DDa77130EBD8Ad7108C33",
    backgroundColor: "#B0E0E620",
    rpc: TESTNET_RPCS_BY_CHAIN[CHAIN_ID_BASE_SEPOLIA],
    explorer: "https://sepolia.basescan.org",
  },
  {
    chainId: CHAIN_ID_OPTIMISM_SEPOLIA,
    evmId: 11155420,
    name: "Optimism Sepolia",
    address: "0xb60aF9c7F74B9209538e4f56aA58a89a92a54d89",
    backgroundColor: "#FF000020",
    rpc: TESTNET_RPCS_BY_CHAIN[CHAIN_ID_OPTIMISM_SEPOLIA],
    explorer: "https://sepolia-optimism.etherscan.io",
  },
];

// const ETH_DEV_PRIVATE_KEY =
//   "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
const GET_STATE_CALL = eth.abi.encodeFunctionSignature("getState()");
const GET_MY_COUNTER_CALL = eth.abi.encodeFunctionSignature("getMyCounter()");
const QUERY_URL = "https://testnet.ccq.vaa.dev/v1/query";

const decodeState = (bytes: string): QueryDemo.ChainEntryStructOutput[] =>
  QueryDemo__factory.createInterface().decodeFunctionResult(
    "getState",
    bytes,
  )[0];

function ContractState({
  state,
  chainId,
}: {
  state?: string;
  chainId: number;
}) {
  const decoded = useMemo(
    () =>
      state
        ? [...decodeState(state)].sort((a, b) => a.chainID - b.chainID)
        : [],
    [state],
  );
  if (!state) return null;
  return (
    <>
      <Typography variant="h6" sx={{ mt: 2 }}>
        Total Count
      </Typography>
      <Typography>
        {decoded
          .reduce((s, d) => s.add(d.counter), BigNumber.from(0))
          .toString()}
      </Typography>
      <Typography variant="h6" sx={{ mt: 2 }}>
        State
      </Typography>
      {decoded.map((d) => (
        <Card
          key={d.chainID.toString()}
          sx={{
            my: 1,
            borderLeft: chainId === d.chainID ? "2px solid" : undefined,
          }}
        >
          <CardContent
            sx={{
              paddingLeft: chainId === d.chainID ? "14px" : undefined,
            }}
          >
            <Typography>
              Chain ID: {chainIdToString(d.chainID)} ({d.chainID.toString()})
            </Typography>
            <Typography>Block Number: {d.blockNum.toString()}</Typography>
            <Typography>
              Block Time:{" "}
              {new Date(d.blockTime.toNumber() * 1000).toLocaleString()}
            </Typography>
            <Typography>Contract: {d.contractAddress}</Typography>
            <Typography>Count: {d.counter.toString()}</Typography>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

export default function CCQ() {
  const { enqueueSnackbar } = useSnackbar();
  const [onChainInfo, setOnChainInfo] = useState<
    ({ blockNumber: string; blockTime: string; contractState: string } | null)[]
  >([null, null, null]);
  const [isWorking, setIsWorking] = useState<boolean>(false);
  useEffect(() => {
    if (isWorking) return; // adding isWorking dependency to trigger updates after a successful tx
    let cancelled = false;
    const fetchOnChainInfo = async () => {
      if (cancelled) return;
      try {
        const responses = await Promise.all(
          CONTRACTS.map(({ rpc, address }) =>
            rpc
              ? axios.post(rpc, [
                  {
                    jsonrpc: "2.0",
                    id: 1,
                    method: "eth_getBlockByNumber",
                    params: ["latest", false],
                  },
                  {
                    jsonrpc: "2.0",
                    id: 2,
                    method: "eth_call",
                    params: [{ to: address, data: GET_STATE_CALL }, "latest"],
                  },
                ])
              : Promise.reject(),
          ),
        );
        if (cancelled) return;
        setOnChainInfo(
          responses.map((response) => {
            const blockNumber = response?.data?.[0]?.result?.number;
            const blockTime = response?.data?.[0]?.result?.timestamp;
            const contractState = response?.data?.[1]?.result;
            if (blockNumber && contractState) {
              return { blockNumber, blockTime, contractState };
            }
            return null;
          }),
        );
      } catch (e) {
        console.error("Failed to read on-chain state.");
        await sleep(60000);
      }
      if (cancelled) return;
      setTimeout(fetchOnChainInfo, 10000);
    };
    fetchOnChainInfo();
    return () => {
      cancelled = true;
    };
  }, [isWorking]);
  const handleRequest = useCallback(
    (event: any) => {
      if (!onChainInfo[0] || !onChainInfo[1] || !onChainInfo[2]) return;
      // @ts-ignore
      if (!window.ethereum) {
        enqueueSnackbar("Metamask not found", { variant: "error" });
      }
      const contractEntry = CONTRACTS.find(
        ({ chainId }) => chainId.toString() === event.target.dataset.chainId,
      );
      const address = contractEntry?.address;
      const requiredEvmChainId = contractEntry?.evmId;
      const rpc = contractEntry?.rpc;
      const explorer = contractEntry?.explorer;
      if (!address || !requiredEvmChainId || !rpc) return;
      setIsWorking(true);
      (async () => {
        try {
          // @ts-ignore
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const provider = new ethers.providers.Web3Provider(
            // @ts-ignore
            window.ethereum,
            "any",
          );
          console.log("info at request time", onChainInfo);
          const perChainRequests = CONTRACTS.map(
            ({ chainId, address }, idx) =>
              new PerChainQueryRequest(
                chainId,
                new EthCallQueryRequest(onChainInfo[idx]?.blockNumber || "", [
                  { to: address, data: GET_MY_COUNTER_CALL },
                ]),
              ),
          ).filter(
            (_, idx) =>
              CONTRACTS[idx].chainId.toString() !==
              event.target.dataset.chainId,
          );
          const nonce = 1;
          const request = new QueryRequest(nonce, perChainRequests);
          const serialized = request.serialize();
          // the CCQ server supports self-signed requests or request signing based on API key
          // const digest = QueryRequest.digest("TESTNET", serialized);
          // const signature = sign(ETH_DEV_PRIVATE_KEY, digest);
          // const signatureRequiredApiKey = "my_secret_key"
          const signatureNotRequiredApiKey =
            "2d6c22c6-afae-4e54-b36d-5ba118da646a";
          const beforeTime = performance.now();
          enqueueSnackbar("Issuing cross-chain query", { variant: "info" });
          const response = await axios.put<QueryResponse>(
            QUERY_URL,
            {
              // signature,
              bytes: Buffer.from(serialized).toString("hex"),
            },
            // { headers: { "X-API-Key": signatureRequiredApiKey } }
            { headers: { "X-API-Key": signatureNotRequiredApiKey } },
          );
          const afterTime = performance.now();
          enqueueSnackbar(
            `Response received in ${(afterTime - beforeTime).toFixed(2)}ms`,
            {
              variant: "info",
            },
          );
          const connectedChainId = (await provider.getNetwork()).chainId;
          if (connectedChainId !== requiredEvmChainId) {
            try {
              await provider.send("wallet_switchEthereumChain", [
                { chainId: `0x${requiredEvmChainId.toString(16)}` },
              ]);
            } catch (switchError: any) {
              const addChainParameter =
                METAMASK_CHAIN_PARAMETERS[requiredEvmChainId];
              // This error code indicates that the chain has not been added to MetaMask.
              if (
                switchError.code === 4902 &&
                addChainParameter !== undefined
              ) {
                await provider.send("wallet_addEthereumChain", [
                  addChainParameter,
                ]);
                // user may cancel the chain switch prompt after adding
                const connectedChainId = (await provider.getNetwork()).chainId;
                if (connectedChainId !== requiredEvmChainId) {
                  throw new Error("User rejected the request.");
                }
              } else {
                throw switchError;
              }
            }
          }
          const contract = QueryDemo__factory.connect(
            address,
            provider.getSigner(),
          );
          console.log(
            `0x${response.data.bytes}`,
            JSON.stringify(
              response.data.signatures.map((s) => [
                `0x${s.substring(0, 64)}`,
                `0x${s.substring(64, 128)}`,
                `0x${(parseInt(s.substring(128, 130), 16) + 27).toString(16)}`,
                `0x${s.substring(130, 132)}`,
              ]),
            ),
          );
          const tx = await contract.updateCounters(
            `0x${response.data.bytes}`,
            response.data.signatures.map((s) => ({
              r: `0x${s.substring(0, 64)}`,
              s: `0x${s.substring(64, 128)}`,
              v: `0x${(parseInt(s.substring(128, 130), 16) + 27).toString(16)}`,
              guardianIndex: `0x${s.substring(130, 132)}`,
            })),
          );
          enqueueSnackbar(`Transaction submitted: ${tx.hash}`, {
            variant: "info",
            action: (
              <IconButton
                size="small"
                href={`${explorer}/tx/${tx.hash}`}
                target="_blank"
              >
                <Launch fontSize="small" />
              </IconButton>
            ),
          });
          let receipt = null;
          while (!receipt) {
            try {
              const response = await axios.post(rpc, {
                jsonrpc: "2.0",
                id: 1,
                method: "eth_getTransactionReceipt",
                params: [tx.hash],
              });
              receipt = response.data.result;
            } catch (e) {
              console.error(e);
            }
            if (!receipt) {
              await sleep(1000);
            }
          }
          console.log(receipt);
          if (receipt?.status !== "0x1") {
            throw new Error("An error occurred on-chain.");
          }
          enqueueSnackbar(
            "Transaction confirmed, successfully updated counters!",
            {
              variant: "success",
            },
          );
        } catch (e: any) {
          enqueueSnackbar(e?.innerError?.message || e?.message, {
            variant: "error",
          });
          console.error(e);
        }
        setIsWorking(false);
      })();
    },
    [enqueueSnackbar, onChainInfo],
  );
  return (
    <Grid container spacing={2}>
      <Grid xs={12} item>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="Cross-Chain Queries Demo" />
          <CardContent>
            <Grid container spacing={2}>
              {CONTRACTS.map(
                (
                  { backgroundColor, name, chainId, address, explorer },
                  idx,
                ) => (
                  <Grid key={name} xs={12} md={6} lg={4} item>
                    <Card sx={{ backgroundColor }}>
                      <CardHeader title={name} />
                      <CardContent>
                        {onChainInfo[idx] ? (
                          <>
                            <Typography variant="h6">Height</Typography>
                            <Typography variant="body2">
                              {parseInt(
                                (
                                  onChainInfo[idx]?.blockNumber || "0x00"
                                ).substring(2),
                                16,
                              )}
                            </Typography>
                            <Typography variant="body2">
                              {new Date(
                                parseInt(
                                  (
                                    onChainInfo[idx]?.blockTime || "0x00"
                                  ).substring(2),
                                  16,
                                ) * 1000,
                              ).toLocaleString()}
                            </Typography>
                            <Typography variant="h6" sx={{ mt: 2 }}>
                              Contract
                            </Typography>
                            <Typography variant="body2">
                              <Link
                                href={`${explorer}/address/${address}`}
                                target="_blank"
                              >
                                {address}
                              </Link>
                            </Typography>
                            <ContractState
                              state={onChainInfo[idx]?.contractState}
                              chainId={chainId}
                            />
                            <Button
                              onClick={handleRequest}
                              data-chain-id={chainId}
                              variant="contained"
                              color="primary"
                              size="small"
                              sx={{ mt: 2 }}
                              disabled={
                                isWorking ||
                                !onChainInfo[0] ||
                                !onChainInfo[1] ||
                                !onChainInfo[2]
                              }
                            >
                              Increment Counter
                            </Button>
                          </>
                        ) : (
                          <CircularProgress />
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                ),
              )}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
