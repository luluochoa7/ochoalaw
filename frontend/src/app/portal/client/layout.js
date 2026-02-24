import RequireAuth from "../../components/RequireAuth";

export default function ClientPortalLayout({ children }) {
  return (
    <RequireAuth>
      <main className="mt-16">{children}</main>
    </RequireAuth>
  );
}
