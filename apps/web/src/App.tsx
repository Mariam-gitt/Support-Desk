// Routes = the table that says which page to show for which address
import { Navigate, Route, Routes } from "react-router-dom";
// The gate that blocks logged-out visitors, and the frame around logged-in pages
import { RequireAuth } from "./components/RequireAuth.js";
import { Layout } from "./components/Layout.js";
// The pages
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { TicketsPage } from "./pages/TicketsPage.js";
import { TicketDetailPage } from "./pages/TicketDetailPage.js";
import { CustomersPage } from "./pages/CustomersPage.js";

// The whole page structure of the app
export function App() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      {/* Everything inside this group needs a login, and is drawn inside the Layout frame */}
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          {/* The home address "/" sends people to the ticket list */}
          <Route index element={<Navigate to="/tickets" replace />} />
          <Route path="/tickets" element={<TicketsPage />} />
          <Route path="/tickets/:ticketId" element={<TicketDetailPage />} />
          <Route path="/customers" element={<CustomersPage />} />
        </Route>
      </Route>
      {/* Any unknown address goes home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
