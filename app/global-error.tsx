"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", marginTop: 96 }}>
        <h2>Simple Call hit an unexpected error</h2>
        <p>Your data is safe in this browser.</p>
        <button onClick={reset} style={{ padding: "8px 16px", background: "#b91f2a", color: "white", border: 0, borderRadius: 8 }}>
          Try again
        </button>
      </body>
    </html>
  );
}
