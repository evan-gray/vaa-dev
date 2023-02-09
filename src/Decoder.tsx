import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import { Buffer } from "buffer";
import { useCallback, useEffect, useState } from "react";
import {
  parseTokenTransferPayload,
  TokenBridgePayload,
  TokenTransfer,
} from "./sdk/tokenBridge";
import { ParsedVaa, parseVaa } from "./sdk/wormhole";

type ParsedVaaAndPayload = {
  vaa?: ParsedVaa;
  tokenBridge?: TokenTransfer;
};

const vaaToString = (vaa: ParsedVaa) => `{
  version: ${vaa.version},
  guardianSetIndex: ${vaa.guardianSetIndex},
  guardianSignatures: (${vaa.guardianSignatures.length}),
  timestamp: ${vaa.timestamp} (${new Date(
  vaa.timestamp * 1000
).toLocaleString()}),
  nonce: ${vaa.nonce},
  emitterChain: ${vaa.emitterChain},
  emitterAddress: ${vaa.emitterAddress.toString("hex")},
  sequence: ${vaa.sequence.toString()},
  consistencyLevel: ${vaa.consistencyLevel},
}`;

const tokenTransferToString = (tokenTransfer: TokenTransfer) => `{
  payloadType: ${tokenTransfer.payloadType},
  amount: ${tokenTransfer.amount.toString()},
  tokenChain: ${tokenTransfer.tokenChain},
  tokenAddress: ${tokenTransfer.tokenAddress.toString("hex")},
  toChain: ${tokenTransfer.toChain},
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

export default function Decoder() {
  const [vaaString, setVaaString] = useState<string>("");
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
  const handleHexChange = useCallback((e: any) => {
    setVaaString(e.target.value);
  }, []);
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
