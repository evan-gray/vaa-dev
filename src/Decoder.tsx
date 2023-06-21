import {
  Box,
  Card,
  CardContent,
  CardHeader,
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
import * as wh from '@certusone/wormhole-sdk';
import chainIdToString from "./utils/chainIdToString";
import { AccessTime } from "@mui/icons-material";


function idToStr(id: number): string {
  const s = chainIdToString(id);
  return s ? `${id} (${s})` : id.toString();
}

const vaaToString = (vaa: wh.VAA<wh.Payload>, handleHover: (e: any) => void) =>
  [
    `  version: ${vaa.version},`,
    `  guardianSetIndex: ${vaa.guardianSetIndex},`,
    `  guardianSignatures: (${vaa.signatures.length}),`,
    `  timestamp: ${vaa.timestamp} (${new Date(vaa.timestamp * 1000)
      .toISOString()
      .replace("T", " ")
      .replace(".000Z", " UTC")}),`,
    `  nonce: ${vaa.nonce},`,
    `  emitterChain: ${idToStr(vaa.emitterChain)},`,
    `  emitterAddress: ${vaa.emitterAddress},`,
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
        ) : null}
      </Box>
    );
  });

const tokenTransferToString = (
  tokenTransfer: wh.TokenBridgeTransfer | wh.TokenBridgeTransferWithPayload,
  handleHover: (e: any) => void
) =>
  [
    `  payloadType: ${tokenTransfer.type},`,
    `  amount: ${tokenTransfer.amount.toString()},`,
    `  tokenChain: ${idToStr(tokenTransfer.tokenChain)},`,
    `  tokenAddress: ${tokenTransfer.tokenAddress},`,
    `  toChain: ${idToStr(tokenTransfer.chain)},`,
    `  toAddress: ${tokenTransfer.toAddress},`,
    ...(tokenTransfer.type === "Transfer" 
      ? [`  fee: ${tokenTransfer.fee?.toString()},`]
      : tokenTransfer.type === "TransferWithPayload"
      ? [
          `  fromAddress: ${tokenTransfer.fromAddress},`,
          `  tokenTransferPayload: ${tokenTransfer.payload}`,
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

const nftTransferToString = (
  nftTransfer: wh.NFTBridgeTransfer,
  handleHover: (e: any) => void
) =>
  [
    `  payloadType: ${nftTransfer.type},`,
    `  tokenChain: ${idToStr(nftTransfer.tokenChain)},`,
    `  tokenAddress: ${nftTransfer.tokenAddress},`,
    `  tokenSymbol: ${nftTransfer.tokenSymbol},`,
    `  tokenName: ${nftTransfer.tokenName},`,
    `  tokenId: ${nftTransfer.tokenId},`,
    `  tokenURI: ${nftTransfer.tokenURI},`,
    `  toChain: ${idToStr(nftTransfer.chain)},`,
    `  toAddress: ${nftTransfer.toAddress},`,
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
  const [vaa, setVaa] = useState<wh.VAA<wh.Payload> | null>(null);
  useEffect(() => {
    setVaa(null);
    if (!vaaString) return;
    try {
      const isHex = /^(0[xX])?[A-Fa-f0-9]+$/.test(vaaString);
      const hasPrefix = isHex && vaaString.toLowerCase().startsWith("0x");
      const buf = Buffer.from(
        hasPrefix ? vaaString.slice(2) : vaaString,
        isHex ? "hex" : "base64"
      );
      const vaa = wh.parse(buf);
      if(vaa.payload.type === "Other") return;
      setVaa(vaa as wh.VAA<wh.Payload>)
    } catch (e) {
      console.error(e);
    }
  }, [vaaString]);

  // const [hoverIndex, setHoverIndex] = useState<string | null>(null);
  const handleHover = useCallback((e: any) => {
    //if (e.type === "mouseenter") {
    //  setHoverIndex(e.target.dataset.index);
    //} else {
    //  setHoverIndex(null);
    //}
  }, []);

  // TODO: punting
  // useEffect(() => {
  //   const isHex = /^(0[xX])?[A-Fa-f0-9]+$/.test(vaaString);
  //   if (inputRef.current) {
  //     const indexes =
  //       hoverIndex &&
  //       (hoverIndex.startsWith("payload-")
  //         ? parsed?.tokenBridgeIndexes?.[hoverIndex.substring(8)]?.map(
  //             (n) => n + (parsed?.vaaIndexes?.payload?.[0] || 0)
  //           )
  //         : parsed?.vaaIndexes?.[hoverIndex]);
  //     if (isHex && indexes) {
  //       inputRef.current.selectionStart = indexes[0] * 2;
  //       inputRef.current.selectionEnd = indexes[1] * 2;
  //     } else {
  //       inputRef.current.selectionStart = inputRef.current.selectionEnd;
  //       inputRef.current.blur();
  //     }
  //   }
  // }, [vaaString, hoverIndex, vaa]);

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
            {vaa ? (
              <>
                <Typography variant="h6" gutterBottom>
                  Header
                </Typography>
                <Box sx={preBoxStyle}>
                  <pre style={{ pointerEvents: "none" }}>{"{"}</pre>
                  {vaaToString(vaa, handleHover)}
                  <pre style={{ pointerEvents: "none" }}>{"}"}</pre>
                </Box>
                <Typography variant="h6" mt={4} gutterBottom>
                  Payload
                </Typography>
                {
                vaa.payload.module === "TokenBridge" && vaa.payload.type === "Transfer" ? (
                  <Box sx={preBoxStyle}>
                    <pre style={{ pointerEvents: "none" }}>{"{"}</pre>
                    {tokenTransferToString(vaa.payload, handleHover)}
                    <pre style={{ pointerEvents: "none" }}>{"}"}</pre>
                  </Box>
                ) : vaa.payload.module === "NFTBridge" && vaa.payload.type === "Transfer" ? (
                  <Box sx={preBoxStyle}>
                    <pre style={{ pointerEvents: "none" }}>{"{"}</pre>
                    {nftTransferToString(vaa.payload, handleHover)}
                    <pre style={{ pointerEvents: "none" }}>{"}"}</pre>
                  </Box>
                ): (<Box><pre>{vaa.payload.module}</pre></Box>)
                }
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
