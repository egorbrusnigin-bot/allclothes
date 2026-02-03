import Sidebar from "./sidebar";

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 1400, margin: "0 auto", padding: "48px 24px 80px" }}>
      <section style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 26, alignItems: "start" }}>
        <Sidebar />
        <div style={{ border: "1px solid #e6e6e6", borderRadius: 16, minHeight: 620, background: "#fff", padding: 28 }}>
          {children}
        </div>
      </section>
    </main>
  );
}
