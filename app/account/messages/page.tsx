export default function Page() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <div>
        <h1 style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>
          MY MESSAGES
        </h1>
        <p style={{ fontSize: 11, color: "#666", letterSpacing: 0.3 }}>
          Your messages will be here.
        </p>
      </div>

      <div
        style={{
          padding: 60,
          textAlign: "center",
          background: "#fff",
          border: "1px solid #e6e6e6",
          color: "#CCCCCC",
        }}
      >
        <p style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>NO MESSAGES YET</p>
      </div>
    </div>
  );
}
