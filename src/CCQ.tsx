import {
  Card,
  CardContent,
  CardHeader,
  Grid,
  Link
} from "@mui/material";

export default function CCQ() {
  return (
    <Grid container spacing={2}>
      <Grid xs={12} item>
        <Card sx={{ height: "100%" }}>
          <CardHeader title="Cross-Chain Queries Demo" />
          <CardContent>
          Moved to <Link href="https://wormholelabs-xyz.github.io/example-queries-demo/">wormholelabs-xyz/example-queries-demo</Link>.
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
