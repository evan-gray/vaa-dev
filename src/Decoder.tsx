import { AccessTime, CheckCircleOutlined } from "@mui/icons-material";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  SxProps,
  TextField,
  Theme,
  Tooltip,
  Typography,
} from "@mui/material";
import { Buffer } from "buffer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router";
import {
  DeliveryInstructionPrintable,
  RedeliveryInstructionPrintable,
  RelayerPayloadId,
  deliveryInstructionsPrintable,
  parseWormholeRelayerPayloadType,
  parseWormholeRelayerResend,
  parseWormholeRelayerSend,
  redeliveryInstructionPrintable,
} from "./sdk/automaticRelayerStructs";
import {
  KNOWN_AUTOMATIC_RELAYER_EMITTERS,
  KNOWN_TOKEN_BRIDGE_EMITTERS,
} from "./sdk/knownEmitters";
import {
  TokenBridgePayload,
  TokenTransfer,
  parseTokenTransferPayload,
} from "./sdk/tokenBridge";
import { ParsedVaa, parseVaa } from "./sdk/wormhole";
import chainIdToString from "./utils/chainIdToString";
import {
  VaaIndexes,
  tokenTransferPayloadToIndexes,
  vaaToIndexes,
} from "./utils/vaaToIndexes";
import { Env } from "./utils/fetchTx";
import axios from "axios";

const MAINNET_RELAY_STATUS =
  "https://nextjs-cors-anywhere.vercel.app/api?endpoint=http://ade18dde9976749fca82c41f05d29cbe-364125254.us-east-2.elb.amazonaws.com/relay-status";
const TESTNET_RELAY_STATUS =
  "https://nextjs-cors-anywhere.vercel.app/api?endpoint=http://a6163c82a2a6f4c1d9c2cf2c35f0733b-758274193.us-east-2.elb.amazonaws.com/relay-status";

type ParsedVaaAndPayload = {
  vaa?: ParsedVaa;
  vaaIndexes?: VaaIndexes;
  tokenBridge?: TokenTransfer;
  tokenBridgeIndexes?: VaaIndexes;
  automaticRelay?:
    | DeliveryInstructionPrintable
    | RedeliveryInstructionPrintable;
  knownEmitter?: string;
};

function idToStr(id: number): string {
  const s = chainIdToString(id);
  return s ? `${id} (${s})` : id.toString();
}

function transferTypeToString(
  transferType:
    | TokenBridgePayload.Transfer
    | TokenBridgePayload.TransferWithPayload,
): string {
  if (transferType === TokenBridgePayload.Transfer) {
    return `${transferType} (Transfer)`;
  }
  if (transferType === TokenBridgePayload.TransferWithPayload) {
    return `${transferType} (Transfer with Payload)`;
  }
  return transferType;
}

const vaaToString = (
  vaa: ParsedVaa,
  knownEmitter: string | undefined,
  handleHover: (e: any) => void,
) =>
  [
    `  version: ${vaa.version},`,
    `  guardianSetIndex: ${vaa.guardianSetIndex},`,
    `  guardianSignatures: (${vaa.guardianSignatures.length}),`,
    `  timestamp: ${vaa.timestamp} (${new Date(vaa.timestamp * 1000)
      .toISOString()
      .replace("T", " ")
      .replace(".000Z", " UTC")}),`,
    `  nonce: ${vaa.nonce},`,
    `  emitterChain: ${idToStr(vaa.emitterChain)},`,
    `  emitterAddress: ${vaa.emitterAddress.toString("hex")},`,
    `  sequence: ${vaa.sequence.toString()},`,
    `  consistencyLevel: ${vaa.consistencyLevel},`,
  ].map((s) => {
    const key = s.split(":")[0].trim();
    return (
      <Box
        key={key}
        onMouseEnter={handleHover}
        onMouseLeave={handleHover}
        data-index={key}
        position="relative"
      >
        <pre>{s}</pre>
        {s.startsWith("  timestamp: ") ? (
          <Tooltip title={new Date(vaa.timestamp * 1000).toLocaleString()}>
            <AccessTime
              fontSize="inherit"
              sx={{ position: "absolute", left: 0, top: 4 }}
            />
          </Tooltip>
        ) : s.startsWith("  emitterAddress: ") && knownEmitter ? (
          <Tooltip title={`Known ${knownEmitter} Emitter`}>
            <CheckCircleOutlined
              fontSize="inherit"
              sx={{ position: "absolute", left: 0, top: 4 }}
            />
          </Tooltip>
        ) : null}
      </Box>
    );
  });

const tokenTransferToString = (
  tokenTransfer: TokenTransfer,
  handleHover: (e: any) => void,
) =>
  [
    `  payloadType: ${transferTypeToString(tokenTransfer.payloadType)},`,
    `  amount: ${tokenTransfer.amount.toString()},`,
    `  tokenChain: ${idToStr(tokenTransfer.tokenChain)},`,
    `  tokenAddress: ${tokenTransfer.tokenAddress.toString("hex")},`,
    `  toChain: ${idToStr(tokenTransfer.toChain)},`,
    `  toAddress: ${tokenTransfer.to.toString("hex")},`,
    ...(tokenTransfer.payloadType === TokenBridgePayload.Transfer
      ? [`  fee: ${tokenTransfer.fee?.toString()},`]
      : tokenTransfer.payloadType === TokenBridgePayload.TransferWithPayload
        ? [
            `  fromAddress: ${tokenTransfer.fromAddress?.toString("hex")},`,
            `  tokenTransferPayload: ${tokenTransfer.tokenTransferPayload.toString(
              "hex",
            )}`,
          ]
        : []),
  ].map((s) => {
    const key = s.split(":")[0].trim();
    return (
      <pre
        key={key}
        onMouseEnter={handleHover}
        onMouseLeave={handleHover}
        data-index={`payload-${key}`}
      >
        {s}
      </pre>
    );
  });

const highlightColor = "rgba(255,255,0,0.2)";

const preBoxStyle: SxProps<Theme> = {
  overflowX: "auto",
  "& pre": {
    m: 0,
    "&:hover": { background: highlightColor },
  },
};

function RelayStatus({
  chain,
  emitter,
  seq,
  env,
  preBoxStyle,
}: {
  chain: number;
  emitter: string;
  seq: string;
  env?: Env;
  preBoxStyle: any;
}) {
  const [resultString, setResultString] = useState<string | null>(null);
  useEffect(() => {
    if (!env) {
      setResultString("");
      return;
    }
    let cancelled = false;
    setResultString(null);
    (async () => {
      const vaaUrl = `${
        env === "MAINNET" ? MAINNET_RELAY_STATUS : TESTNET_RELAY_STATUS
      }?emitterChain=${chain}&emitterAddress=${emitter}&sequence=${seq}`;
      try {
        const response = await axios.get(vaaUrl);
        console.log(
          response?.data?.[0]?.metadata?.deliveryRecord?.resultString,
        );
        if (
          !cancelled &&
          response?.data?.[0]?.metadata?.deliveryRecord?.resultString
        ) {
          setResultString(
            response?.data?.[0]?.metadata?.deliveryRecord?.resultString,
          );
          return;
        }
      } catch (e) {
        setResultString("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, emitter, seq, env]);
  return resultString === null ? (
    <CircularProgress />
  ) : (
    <Box sx={preBoxStyle}>
      <pre style={{ pointerEvents: "none" }}>
        {resultString || "No information available"}
      </pre>
    </Box>
  );
}

export function DecoderComponent({
  vaaString,
  handleHexChange,
  showEncoded = true,
  env,
}: {
  vaaString: string;
  handleHexChange?: (e: any) => void;
  showEncoded?: boolean;
  env?: Env;
}) {
  const inputRef = useRef<any>();
  const [parsed, setParsed] = useState<ParsedVaaAndPayload | null>(null);
  useEffect(() => {
    setParsed(null);
    if (!vaaString) return;
    try {
      const emitterEnv = env || "MAINNET";
      const isHex = /^(0[xX])?[A-Fa-f0-9]+$/.test(vaaString);
      const hasPrefix = isHex && vaaString.toLowerCase().startsWith("0x");
      const buf = Buffer.from(
        hasPrefix ? vaaString.slice(2) : vaaString,
        isHex ? "hex" : "base64",
      );
      const vaa = parseVaa(buf);
      const vaaIndexes = vaaToIndexes(buf);
      const emitterAddress = vaa.emitterAddress.toString("hex").toLowerCase();
      const isTokenBridgeEmitter =
        KNOWN_TOKEN_BRIDGE_EMITTERS[emitterEnv][
          vaa.emitterChain
        ]?.toLowerCase() === emitterAddress;
      const isAutomaticRelayerEmitter =
        KNOWN_AUTOMATIC_RELAYER_EMITTERS[emitterEnv][
          vaa.emitterChain
        ]?.toLowerCase() === emitterAddress;
      let tokenBridge: TokenTransfer | undefined;
      let tokenBridgeIndexes: VaaIndexes | undefined;
      let automaticRelay:
        | DeliveryInstructionPrintable
        | RedeliveryInstructionPrintable
        | undefined;
      if (isTokenBridgeEmitter) {
        try {
          tokenBridge = parseTokenTransferPayload(vaa.payload);
          tokenBridgeIndexes = tokenTransferPayloadToIndexes(vaa.payload);
        } catch (e) {
          console.error(e);
        }
      } else if (isAutomaticRelayerEmitter) {
        try {
          const type = parseWormholeRelayerPayloadType(vaa.payload);
          if (type === RelayerPayloadId.Delivery) {
            automaticRelay = deliveryInstructionsPrintable(
              parseWormholeRelayerSend(vaa.payload),
            );
          } else if (type === RelayerPayloadId.Redelivery) {
            automaticRelay = redeliveryInstructionPrintable(
              parseWormholeRelayerResend(vaa.payload),
            );
          }
        } catch (e) {
          console.error(e);
        }
      }
      setParsed({
        vaa,
        vaaIndexes,
        tokenBridge,
        tokenBridgeIndexes,
        automaticRelay,
        knownEmitter: isTokenBridgeEmitter
          ? "Token Bridge"
          : isAutomaticRelayerEmitter
            ? "Automatic Relayer"
            : undefined,
      });
    } catch (e) {
      console.error(e);
    }
  }, [vaaString, env]);
  const [hoverIndex, setHoverIndex] = useState<string | null>(null);
  const handleHover = useCallback((e: any) => {
    if (e.type === "mouseenter") {
      setHoverIndex(e.target.dataset.index);
    } else {
      setHoverIndex(null);
    }
  }, []);
  useEffect(() => {
    const isHex = /^(0[xX])?[A-Fa-f0-9]+$/.test(vaaString);
    if (inputRef.current) {
      const indexes =
        hoverIndex &&
        (hoverIndex.startsWith("payload-")
          ? parsed?.tokenBridgeIndexes?.[hoverIndex.substring(8)]?.map(
              (n) => n + (parsed?.vaaIndexes?.payload?.[0] || 0),
            )
          : parsed?.vaaIndexes?.[hoverIndex]);
      if (isHex && indexes) {
        inputRef.current.selectionStart = indexes[0] * 2;
        inputRef.current.selectionEnd = indexes[1] * 2;
      } else {
        inputRef.current.selectionStart = inputRef.current.selectionEnd;
        inputRef.current.blur();
      }
    }
  }, [vaaString, hoverIndex, parsed]);
  return (
    <Grid container spacing={2}>
      {showEncoded ? (
        <Grid xs={12} md={6} item>
          <Card sx={{ height: "100%" }}>
            <CardHeader title="Encoded" />
            <CardContent>
              <TextField
                multiline
                rows={20}
                placeholder={
                  "Paste a VAA in base64 or hex (with or without prefix)"
                }
                fullWidth
                value={vaaString}
                onChange={handleHexChange}
                disabled={!handleHexChange}
                inputRef={inputRef}
                sx={{ "& ::selection": { background: highlightColor } }}
              />
            </CardContent>
          </Card>
        </Grid>
      ) : null}
      <Grid xs={12} md={showEncoded ? 6 : 12} item>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="Decoded" />
          <CardContent>
            {parsed?.vaa ? (
              <>
                <Typography variant="h6" gutterBottom>
                  Header
                </Typography>
                <Box sx={preBoxStyle}>
                  <pre style={{ pointerEvents: "none" }}>{"{"}</pre>
                  {vaaToString(parsed.vaa, parsed.knownEmitter, handleHover)}
                  <pre style={{ pointerEvents: "none" }}>{"}"}</pre>
                </Box>
                <Typography variant="h6" mt={4} gutterBottom>
                  Payload
                </Typography>
                {parsed.tokenBridge ? (
                  <Box sx={preBoxStyle}>
                    <pre style={{ pointerEvents: "none" }}>{"{"}</pre>
                    {tokenTransferToString(parsed.tokenBridge, handleHover)}
                    <pre style={{ pointerEvents: "none" }}>{"}"}</pre>
                  </Box>
                ) : parsed.automaticRelay ? (
                  <Box sx={preBoxStyle}>
                    <pre style={{ pointerEvents: "none" }}>
                      {JSON.stringify(parsed.automaticRelay, undefined, 2)}
                    </pre>
                  </Box>
                ) : (
                  <code
                    style={{ wordBreak: "break-all" }}
                    onMouseEnter={handleHover}
                    onMouseLeave={handleHover}
                    data-index="payload"
                  >
                    {parsed.vaa.payload.toString("hex")}
                  </code>
                )}
                {parsed.vaa && parsed.automaticRelay ? (
                  <>
                    <Typography variant="h6" mt={4} gutterBottom>
                      Result
                    </Typography>
                    <RelayStatus
                      chain={parsed.vaa.emitterChain}
                      emitter={parsed.vaa.emitterAddress.toString("hex")}
                      seq={parsed.vaa.sequence.toString()}
                      env={env}
                      preBoxStyle={preBoxStyle}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}

export default function Decoder() {
  const { replace } = useHistory();
  const { vaa } = useParams<{ vaa?: string }>();
  const vaaString = useMemo(() => {
    return vaa ? decodeURIComponent(vaa) : "";
  }, [vaa]);
  const handleHexChange = useCallback(
    (e: any) => {
      const value: string = e.target.value.trim();
      replace(`/parse/${encodeURIComponent(value)}`);
    },
    [replace],
  );
  return (
    <DecoderComponent vaaString={vaaString} handleHexChange={handleHexChange} />
  );
}
