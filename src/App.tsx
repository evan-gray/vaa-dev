import { GitHub } from "@mui/icons-material";
import { AppBar, Box, IconButton, Toolbar, Typography } from "@mui/material";
import Decoder from "./Decoder";

function App() {
  return (
    <main>
      <AppBar position="static">
        <Toolbar variant="dense">
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            VAA Parser
          </Typography>
          <IconButton
            href="https://github.com/evan-gray/vaa-dev"
            edge="end"
            color="inherit"
            sx={{ ml: 2 }}
          >
            <GitHub />
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box m={2}>
        <Decoder />
      </Box>
    </main>
  );
}

export default App;
