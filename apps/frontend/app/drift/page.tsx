import { DASHBOARD_URL } from "@/lib/api";

// Static, informational page — drift is exercised via CI, not the browser.
export default function DriftPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Drift CI</h1>
        <p className="text-sm text-gray-400">
          Configuration drift is detected in CI, not from this UI.
        </p>
      </header>

      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-5">
        <h2 className="font-semibold">How it works</h2>
        <p className="mt-2 text-sm text-gray-300">
          The GitHub Actions workflow{" "}
          <code className="rounded bg-gray-800 px-1.5 py-0.5 text-xs">
            .github/workflows/pulse-drift.yml
          </code>{" "}
          snapshots the environment-key manifest for each environment and then
          runs a CI check that fails the build when keys drift from the recorded
          baseline.
        </p>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-5">
        <h2 className="font-semibold">Triggers</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-gray-300">
          <li>
            <b>push</b> to <code className="text-emerald-300">main</code> →
            checks <code>production</code>
          </li>
          <li>
            <b>push</b> to <code className="text-emerald-300">staging</code> →
            checks <code>staging</code>
          </li>
          <li>
            <b>pull_request</b> targeting{" "}
            <code className="text-emerald-300">main</code>
          </li>
          <li>
            <b>workflow_dispatch</b> (manual) — pick the environment from the
            dropdown
          </li>
        </ul>
      </section>

      <section className="rounded-lg border border-gray-800 bg-gray-900/40 p-5">
        <h2 className="font-semibold">Run it manually</h2>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-gray-300">
          <li>Open the repository&apos;s <b>Actions</b> tab on GitHub.</li>
          <li>
            Select the <b>Pulse Drift</b> workflow.
          </li>
          <li>
            Click <b>Run workflow</b>, choose an environment
            (development / staging / production), and confirm.
          </li>
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          Required repo secrets:{" "}
          <code className="text-gray-300">PULSE_API_KEY</code>,{" "}
          <code className="text-gray-300">PULSE_DRIFT_API_URL</code>.
        </p>
      </section>

      <a
        href={DASHBOARD_URL}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500"
      >
        Open Pulse dashboard →
      </a>
    </div>
  );
}
