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
  QueryResponse,
  sign,
} from "./sdk-query";
import {
  CHAIN_ID_ARBITRUM,
  CHAIN_ID_OPTIMISM,
  CHAIN_ID_POLYGON,
} from "./sdk/consts";
import { TESTNET_RPCS_BY_CHAIN } from "./utils/consts";
import { QueryDemo__factory } from "./utils/contracts";
import { sleep } from "./utils/sleep";
import { Launch } from "@mui/icons-material";
import { QueryDemo } from "./utils/contracts/QueryDemo";
import chainIdToString from "./utils/chainIdToString";
import { METAMASK_CHAIN_PARAMETERS } from "./utils/metaMaskChainParameters";

const CONTRACTS = [
  {
    chainId: CHAIN_ID_POLYGON,
    evmId: 80001,
    name: "Polygon Mumbai",
    address: "0xCAB985A8d94f3f13a7aC003AcdF43C46314352c1",
    backgroundColor: "#DDA0DD20",
    rpc: "https://rpc-mumbai.maticvigil.com", //TESTNET_RPCS_BY_CHAIN[CHAIN_ID_POLYGON],
    explorer: "https://mumbai.polygonscan.com",
  },
  {
    chainId: CHAIN_ID_ARBITRUM,
    evmId: 421613,
    name: "Arbitrum Goerli",
    address: "0x3ce792601c936b1c81f73Ea2fa77208C0A478BaE",
    backgroundColor: "#B0E0E620",
    rpc: TESTNET_RPCS_BY_CHAIN[CHAIN_ID_ARBITRUM],
    explorer: "https://goerli.arbiscan.io",
  },
  {
    chainId: CHAIN_ID_OPTIMISM,
    evmId: 420,
    name: "Optimism Goerli",
    address: "0x5b00016d13Dd099d435310729E51C68F86f05bd7",
    backgroundColor: "#FF000020",
    rpc: "https://goerli.optimism.io", //TESTNET_RPCS_BY_CHAIN[CHAIN_ID_OPTIMISM],
    explorer: "https://goerli-optimism.etherscan.io",
  },
];

const ETH_DEV_PRIVATE_KEY =
  "cfb12303a19cde580bb4dd771639b0d26bc68353645571a8cff516ab2ee113a0";
const GET_STATE_CALL = eth.abi.encodeFunctionSignature("getState()");
const GET_MY_COUNTER_CALL = eth.abi.encodeFunctionSignature("getMyCounter()");
const QUERY_URL = "https://testnet.ccq.vaa.dev/v1/query";

const decodeState = (bytes: string): QueryDemo.ChainEntryStructOutput[] =>
  QueryDemo__factory.createInterface().decodeFunctionResult(
    "getState",
    bytes
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
    [state]
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
            {chainId === d.chainID ? null : (
              <>
                <Typography>Block Number: {d.blockNum.toString()}</Typography>
                <Typography>
                  Block Time:{" "}
                  {new Date(d.blockTime.toNumber() / 1000).toLocaleString()}
                </Typography>
              </>
            )}
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
    ({ blockNumber: string; contractState: string } | null)[]
  >([null, null, null]);
  const [isWorking, setIsWorking] = useState<boolean>(false);
  useEffect(() => {
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
              : Promise.reject()
          )
        );
        if (cancelled) return;
        setOnChainInfo(
          responses.map((response) => {
            const blockNumber = response?.data?.[0]?.result?.number;
            const contractState = response?.data?.[1]?.result;
            if (blockNumber && contractState) {
              return { blockNumber, contractState };
            }
            return null;
          })
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
  }, []);
  const handleRequest = useCallback(
    (event: any) => {
      if (!onChainInfo[0] || !onChainInfo[1] || !onChainInfo[2]) return;
      // @ts-ignore
      if (!window.ethereum) {
        enqueueSnackbar("Metamask not found", { variant: "error" });
      }
      const contractEntry = CONTRACTS.find(
        ({ chainId }) => chainId.toString() === event.target.dataset.chainId
      );
      const address = contractEntry?.address;
      const requiredEvmChainId = contractEntry?.evmId;
      const explorer = contractEntry?.explorer;
      if (!address || !requiredEvmChainId) return;
      setIsWorking(true);
      (async () => {
        try {
          // @ts-ignore
          await window.ethereum.request({ method: "eth_requestAccounts" });
          const provider = new ethers.providers.Web3Provider(
            // @ts-ignore
            window.ethereum,
            "any"
          );
          const perChainRequests = CONTRACTS.map(
            ({ chainId, address }, idx) =>
              new PerChainQueryRequest(
                chainId,
                new EthCallQueryRequest(onChainInfo[idx]?.blockNumber || "", [
                  { to: address, data: GET_MY_COUNTER_CALL },
                ])
              )
          ).filter(
            (_, idx) =>
              CONTRACTS[idx].chainId.toString() !== event.target.dataset.chainId
          );
          const nonce = 1;
          const request = new QueryRequest(nonce, perChainRequests);
          const serialized = request.serialize();
          const digest = QueryRequest.digest("TESTNET", serialized);
          const signature = sign(ETH_DEV_PRIVATE_KEY, digest);
          const beforeTime = performance.now();
          enqueueSnackbar("Issuing cross-chain query", { variant: "info" });
          const response = await axios.put<QueryResponse>(
            QUERY_URL,
            {
              signature,
              bytes: Buffer.from(serialized).toString("hex"),
            },
            { headers: { "X-API-Key": "my_secret_key" } }
          );
          const afterTime = performance.now();
          enqueueSnackbar(
            `Response received in ${(afterTime - beforeTime).toFixed(2)}ms`,
            {
              variant: "info",
            }
          );
          const connectedChainId = (await provider.getNetwork()).chainId;
          if (connectedChainId !== requiredEvmChainId) {
            try {
              await provider.send("wallet_switchEthereumChain", [
                { chainId: `0x${requiredEvmChainId.toString(16)}` },
              ]);
            } catch (switchError: any) {
              console.log(switchError);
              const addChainParameter =
                METAMASK_CHAIN_PARAMETERS[requiredEvmChainId];
              console.log(addChainParameter);
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
            provider.getSigner()
          );
          console.log(
            `0x${response.data.bytes}`,
            JSON.stringify(
              response.data.signatures.map((s) => [
                `0x${s.substring(0, 64)}`,
                `0x${s.substring(64, 128)}`,
                `0x${(parseInt(s.substring(128, 130), 16) + 27).toString(16)}`,
                `0x${s.substring(130, 132)}`,
              ])
            )
          );
          const tx = await contract.updateCounters(
            `0x${response.data.bytes}`,
            response.data.signatures.map((s) => ({
              r: `0x${s.substring(0, 64)}`,
              s: `0x${s.substring(64, 128)}`,
              v: `0x${(parseInt(s.substring(128, 130), 16) + 27).toString(16)}`,
              guardianIndex: `0x${s.substring(130, 132)}`,
            }))
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
          // TODO: wait is kinda slow, maybe just poll ourselves
          await tx.wait();
          enqueueSnackbar(
            "Transaction confirmed, successfully updated counters!",
            {
              variant: "success",
            }
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
    [enqueueSnackbar, onChainInfo]
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
                  idx
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
                                16
                              )}
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
                )
              )}
            </Grid>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
