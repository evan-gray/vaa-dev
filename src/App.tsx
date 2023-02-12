import { GitHub } from "@mui/icons-material";
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import {
  NavLink,
  Redirect,
  Route,
  Switch,
  useRouteMatch,
} from "react-router-dom";
import Decoder from "./Decoder";

function NavButton({
  label,
  to,
  exact = false,
}: {
  label: string;
  to: string;
  exact?: boolean;
}) {
  let match = useRouteMatch({
    path: to,
    exact,
  });
  return (
    <Button
      component={NavLink}
      to={to}
      size="small"
      disabled={!!match}
      sx={{
        pb: 0,
        px: 0,
        textUnderlineOffset: 4,
        textDecoration: match ? "underline" : undefined,
        "&.Mui-disabled": { color: "text.primary" },
      }}
      color="inherit"
    >
      {label}
    </Button>
  );
}

function App() {
  return (
    <main>
      <AppBar position="static">
        <Toolbar variant="dense">
          <Typography variant="h6" component="div" sx={{ mr: 1 }}>
            VAA Tools
          </Typography>
          <NavButton to="/" label="Parse" exact />
          <Box sx={{ flexGrow: 1 }} />
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
        <Switch>
          <Route exact path="/">
            <Decoder />
          </Route>
          <Route>
            <Redirect to="/" />
          </Route>
        </Switch>
      </Box>
    </main>
  );
}

export default App;
