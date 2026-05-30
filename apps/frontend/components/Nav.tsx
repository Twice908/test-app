"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/observe", label: "Observe" },
  { href: "/rate-limiter", label: "Rate Limiter" },
  { href: "/agents", label: "Agents" },
  { href: "/drift", label: "Drift CI" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-gray-800 bg-gray-900/60 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-4 py-3">
        <span className="mr-4 font-bold tracking-tight text-emerald-400">
          Pulse Demo
        </span>
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
