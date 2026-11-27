"use client";

// Keeps the app up through judging: any unexpected UI error shows a recovery screen instead of a blank page.
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="text-lg font-bold">Something went wrong on this screen</div>
      <p className="mt-2 text-sm text-slate-600">Your knowledge and reports are safe in this browser. Try again, or reload the page.</p>
      <div className="mt-4 flex justify-center gap-2">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        <button className="btn btn-ghost" onClick={() => window.location.reload()}>Reload</button>
      </div>
    </div>
  );
}
