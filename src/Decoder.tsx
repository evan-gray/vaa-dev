import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Grid,
  SxProps,
  TextField,
  Theme,
  Typography,
} from "@mui/material";
import { Buffer } from "buffer";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useParams } from "react-router";
import {
  parseTokenTransferPayload,
  TokenBridgePayload,
  TokenTransfer,
} from "./sdk/tokenBridge";
import { ParsedVaa, parseVaa } from "./sdk/wormhole";
import chainIdToString from "./utils/chainIdToString";
import {
  tokenTransferPayloadToIndexes,
  VaaIndexes,
  vaaToIndexes,
} from "./utils/vaaToIndexes";

type ParsedVaaAndPayload = {
  vaa?: ParsedVaa;
  vaaIndexes?: VaaIndexes;
  tokenBridge?: TokenTransfer;
  tokenBridgeIndexes?: VaaIndexes;
};

function idToStr(id: number): string {
  const s = chainIdToString(id);
  return s ? `${id} (${s})` : id.toString();
}

function transferTypeToString(
  transferType:
    | TokenBridgePayload.Transfer
    | TokenBridgePayload.TransferWithPayload
): string {
  if (transferType === TokenBridgePayload.Transfer) {
    return `${transferType} (Transfer)`;
  }
  if (transferType === TokenBridgePayload.TransferWithPayload) {
    return `${transferType} (Transfer with Payload)`;
  }
  return transferType;
}

const vaaToString = (vaa: ParsedVaa, handleHover: (e: any) => void) =>
  [
    `  version: ${vaa.version},`,
    `  guardianSetIndex: ${vaa.guardianSetIndex},`,
    `  guardianSignatures: (${vaa.guardianSignatures.length}),`,
    `  timestamp: ${vaa.timestamp} (${new Date(
      vaa.timestamp * 1000
    ).toLocaleString()}),`,
    `  nonce: ${vaa.nonce},`,
    `  emitterChain: ${idToStr(vaa.emitterChain)},`,
    `  emitterAddress: ${vaa.emitterAddress.toString("hex")},`,
    `  sequence: ${vaa.sequence.toString()},`,
    `  consistencyLevel: ${vaa.consistencyLevel},`,
  ].map((s) => {
    const key = s.split(":")[0].trim();
    return (
      <pre
        key={key}
        onMouseEnter={handleHover}
        onMouseLeave={handleHover}
        data-index={key}
      >
        {s}
      </pre>
    );
  });

const tokenTransferToString = (
  tokenTransfer: TokenTransfer,
  handleHover: (e: any) => void
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
            "hex"
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

export function DecoderComponent({
  vaaString,
  handleHexChange,
}: {
  vaaString: string;
  handleHexChange?: (e: any) => void;
}) {
  const inputRef = useRef<any>();
  const [parsed, setParsed] = useState<ParsedVaaAndPayload | null>(null);
  useEffect(() => {
    setParsed(null);
    if (!vaaString) return;
    try {
      const isHex = /^(0[xX])?[A-Fa-f0-9]+$/.test(vaaString);
      const hasPrefix = isHex && vaaString.toLowerCase().startsWith("0x");
      const buf = Buffer.from(
        hasPrefix ? vaaString.slice(2) : vaaString,
        isHex ? "hex" : "base64"
      );
      const vaa = parseVaa(buf);
      const vaaIndexes = vaaToIndexes(buf);
      let tokenBridge: TokenTransfer | undefined;
      let tokenBridgeIndexes: VaaIndexes | undefined;
      try {
        tokenBridge = parseTokenTransferPayload(vaa.payload);
        tokenBridgeIndexes = tokenTransferPayloadToIndexes(vaa.payload);
      } catch (e) {
        console.error(e);
      }
      setParsed({ vaa, vaaIndexes, tokenBridge, tokenBridgeIndexes });
    } catch (e) {
      console.error(e);
    }
  }, [vaaString]);
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
              (n) => n + (parsed?.vaaIndexes?.payload?.[0] || 0)
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
      <Grid xs={12} md={6} item>
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
                  {vaaToString(parsed.vaa, handleHover)}
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
    [replace]
  );
  return (
    <DecoderComponent vaaString={vaaString} handleHexChange={handleHexChange} />
  );
}
