import Navbar from "../../components/Navbar";
import RequireAuth from "../../components/RequireAuth";

export default function ClientPortalLayout({ children }) {
  return (
    <RequireAuth>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <main className="flex-1 mt-16">{children}</main>
      </div>
    </RequireAuth>
  );
}
