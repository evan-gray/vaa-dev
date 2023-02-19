import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { Buffer } from "buffer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router";
import {
  parseTokenTransferPayload,
  TokenBridgePayload,
  TokenTransfer,
} from "./sdk/tokenBridge";
import { ParsedVaa, parseVaa } from "./sdk/wormhole";
import chainIdToString from "./utils/chainIdToString";

type ParsedVaaAndPayload = {
  vaa?: ParsedVaa;
  tokenBridge?: TokenTransfer;
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

const vaaToString = (vaa: ParsedVaa) => `{
  version: ${vaa.version},
  guardianSetIndex: ${vaa.guardianSetIndex},
  guardianSignatures: (${vaa.guardianSignatures.length}),
  timestamp: ${vaa.timestamp} (${new Date(
  vaa.timestamp * 1000
).toLocaleString()}),
  nonce: ${vaa.nonce},
  emitterChain: ${idToStr(vaa.emitterChain)},
  emitterAddress: ${vaa.emitterAddress.toString("hex")},
  sequence: ${vaa.sequence.toString()},
  consistencyLevel: ${vaa.consistencyLevel},
}`;

const tokenTransferToString = (tokenTransfer: TokenTransfer) => `{
  payloadType: ${transferTypeToString(tokenTransfer.payloadType)},
  amount: ${tokenTransfer.amount.toString()},
  tokenChain: ${idToStr(tokenTransfer.tokenChain)},
  tokenAddress: ${tokenTransfer.tokenAddress.toString("hex")},
  toChain: ${idToStr(tokenTransfer.toChain)},
  toAddress: ${tokenTransfer.to.toString("hex")},
  ${
    tokenTransfer.payloadType === TokenBridgePayload.Transfer
      ? `fee: ${tokenTransfer.fee?.toString()},`
      : tokenTransfer.payloadType === TokenBridgePayload.TransferWithPayload
      ? `fromAddress: ${tokenTransfer.fromAddress?.toString("hex")},
  tokenTransferPayload: ${tokenTransfer.tokenTransferPayload.toString("hex")}`
      : ""
  }
}`;

export function DecoderComponent({
  vaaString,
  handleHexChange,
}: {
  vaaString: string;
  handleHexChange?: (e: any) => void;
}) {
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
      let tokenBridge: TokenTransfer | undefined;
      try {
        tokenBridge = parseTokenTransferPayload(vaa.payload);
      } catch (e) {
        console.error(e);
      }
      setParsed({ vaa, tokenBridge });
    } catch (e) {
      console.error(e);
    }
  }, [vaaString]);
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
                <pre style={{ overflowX: "auto" }}>
                  {vaaToString(parsed.vaa)}
                </pre>
                <Typography variant="h6" mt={4} gutterBottom>
                  Payload
                </Typography>
                {parsed.tokenBridge ? (
                  <pre style={{ overflowX: "auto" }}>
                    {tokenTransferToString(parsed.tokenBridge)}
                  </pre>
                ) : (
                  <code style={{ wordBreak: "break-all" }}>
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
