import { HashRouter } from "react-router-dom";
import AppRoutes from "./routes";
import { StoreProvider } from "./data/store";

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <AppRoutes />
      </StoreProvider>
    </HashRouter>
  );
}
