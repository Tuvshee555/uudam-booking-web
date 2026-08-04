"use client";

/**
 * Only fires for errors thrown in the root layout itself (outside every
 * `[locale]` segment) — those never reach `[locale]/error.tsx`. Next.js
 * requires this file to render its own `<html>`/`<body>`, since the root
 * layout that would normally provide them is what crashed.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="mn">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "0 1rem", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0b2e4d" }}>Ямар нэг зүйл буруу ажиллалаа</h1>
          <p style={{ marginTop: "0.75rem", maxWidth: "28rem", fontSize: "0.875rem", color: "#5b6674" }}>
            Хуудсыг ачаалахад алдаа гарлаа. Дахин оролдоно уу.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: "2rem", borderRadius: "0.5rem", backgroundColor: "#113e67", padding: "0.625rem 1.25rem", fontSize: "0.875rem", fontWeight: 700, color: "#fff", border: "none", cursor: "pointer" }}
          >
            Дахин оролдох
          </button>
        </div>
      </body>
    </html>
  );
}
