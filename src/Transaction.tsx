import { CheckCircle, Error, ExpandMore } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Card,
  CardContent,
  CardHeader,
  CircularProgress,
  Grid,
  TextField,
  Typography,
} from "@mui/material";
import axios from "axios";
import { Buffer } from "buffer";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHistory, useParams } from "react-router";
import { DecoderComponent } from "./Decoder";
import fetchTx, { TxInfo } from "./utils/fetchTx";

const RPCS = [
  "https://wormhole-v2-mainnet-api.certus.one",
  "https://wormhole.inotel.ro",
  "https://wormhole-v2-mainnet-api.mcf.rocks",
  "https://wormhole-v2-mainnet-api.chainlayer.network",
  "https://wormhole-v2-mainnet-api.staking.fund",
  "https://wormhole-v2-mainnet.01node.com",
];

function MessageInfo({ id }: { id: string }) {
  const [vaa, setVaa] = useState<null | string>(null);
  useEffect(() => {
    const [chain, emitter, sequence] = id.split("/");
    let cancelled = false;
    (async () => {
      for (const rpc of RPCS) {
        if (cancelled) return;
        const vaaUrl = `${rpc}/v1/signed_vaa/${chain}/${emitter}/${sequence}`;
        const response = await axios.get(vaaUrl);
        if (!cancelled && response?.data?.vaaBytes) {
          setVaa(Buffer.from(response.data.vaaBytes, "base64").toString("hex"));
          return;
        }
      }
      setVaa("");
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
  return (
    <Accordion sx={{ background: "rgba(255,255,255,0.05)" }}>
      <AccordionSummary expandIcon={<ExpandMore />}>
        <Typography sx={{ mr: 1, display: "flex", alignItems: "center" }}>
          {vaa === null ? (
            <CircularProgress size={16} />
          ) : !vaa ? (
            <Error fontSize="inherit" />
          ) : (
            <CheckCircle fontSize="inherit" />
          )}
        </Typography>
        <Typography key={id} sx={{ wordBreak: "break-all" }}>
          {id}
        </Typography>
      </AccordionSummary>
      <AccordionDetails>
        {vaa === null ? (
          <CircularProgress />
        ) : !vaa ? (
          "Not found"
        ) : (
          <DecoderComponent vaaString={vaa} />
        )}
      </AccordionDetails>
    </Accordion>
  );
}

export default function Transaction() {
  const { replace } = useHistory();
  const { hash } = useParams<{ hash?: string }>();
  const txString = useMemo(() => {
    return hash ? decodeURIComponent(hash) : "";
  }, [hash]);
  const [infos, setInfos] = useState<TxInfo[] | null>(null);
  useEffect(() => {
    setInfos(null);
    if (!txString) return;
    let cancelled = false;
    (async () => {
      try {
        const txInfos = await fetchTx(txString);
        if (!cancelled) {
          console.log(txInfos);
          setInfos(txInfos);
        }
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [txString]);
  const handleTxChange = useCallback(
    (e: any) => {
      const value: string = e.target.value.trim();
      replace(`/tx/${encodeURIComponent(value)}`);
    },
    [replace]
  );
  return (
    <Grid container spacing={2}>
      <Grid xs={12} item>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="Transaction Hash" />
          <CardContent>
            <TextField
              placeholder={
                "Paste a transaction hash from any EVM chain (more support coming soon!)"
              }
              fullWidth
              value={txString}
              onChange={handleTxChange}
            />
          </CardContent>
        </Card>
      </Grid>
      <Grid xs={12} item>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="Messages" />
          <CardContent>
            {txString && infos === null ? (
              <CircularProgress />
            ) : infos ? (
              infos.length ? (
                infos.map((info) =>
                  info.messageIds.map((id) => <MessageInfo key={id} id={id} />)
                )
              ) : (
                <Typography>No messages found</Typography>
              )
            ) : null}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
