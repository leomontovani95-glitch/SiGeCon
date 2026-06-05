"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type Props = {
  column: string;      // valor de sortBy para esta coluna
  label: string;       // texto exibido
  currentSort: string; // sortBy atual
  currentDir: string;  // sortDir atual
};

export default function SortableHeader({ column, label, currentSort, currentDir }: Props) {
  const pathname = usePathname();
  const params = useSearchParams();

  const isActive = currentSort === column;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  const newParams = new URLSearchParams(params.toString());
  newParams.set("sortBy", column);
  newParams.set("sortDir", nextDir);

  return (
    <th className="text-left px-4 py-3 font-medium text-gray-700 whitespace-nowrap select-none">
      <Link
        href={`${pathname}?${newParams.toString()}`}
        className="inline-flex items-center gap-1 hover:text-[#1e3a5f] transition-colors group"
      >
        {label}
        <span className={`text-xs ${isActive ? "text-[#1e3a5f]" : "text-gray-300 group-hover:text-gray-400"}`}>
          {isActive ? (currentDir === "asc" ? "↑" : "↓") : "↕"}
        </span>
      </Link>
    </th>
  );
}
