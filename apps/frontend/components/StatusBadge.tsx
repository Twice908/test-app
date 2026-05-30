interface StatusBadgeProps {
  status: number;
  loading?: boolean;
}

// Coloured pill showing an HTTP status. Grey while loading, green for 2xx,
// red for 4xx/5xx (and network failures, status 0).
export default function StatusBadge({ status, loading }: StatusBadgeProps) {
  if (loading) {
    return (
      <span className="rounded-full bg-gray-700 px-2.5 py-0.5 text-xs font-semibold text-gray-200">
        …
      </span>
    );
  }
  const ok = status >= 200 && status < 300;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        ok ? "bg-emerald-500/20 text-emerald-300" : "bg-red-500/20 text-red-300"
      }`}
    >
      {status === 0 ? "ERR" : status}
    </span>
  );
}
