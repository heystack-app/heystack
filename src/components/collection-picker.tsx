"use client";

import { useEffect, useRef, useState } from "react";

type Collection = { id: string; name: string; documents: number };

function Item({
  active,
  onSelect,
  children,
}: {
  active: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
        active ? "text-indigo-600 dark:text-indigo-400" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function CollectionPicker({
  collections,
  value,
  onChange,
}: {
  collections: Collection[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = value ? collections.find((c) => c.id === value) : null;
  const label = current
    ? `${current.name} (${current.documents})`
    : "All collections";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-2.5 py-1 font-medium text-gray-700 transition-colors hover:bg-black/[0.03] dark:border-white/15 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10"
      >
        {label}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="hs-rise absolute left-0 z-20 mt-1.5 max-h-72 w-60 overflow-y-auto rounded-xl border border-black/10 bg-white py-1 shadow-xl dark:border-white/15 dark:bg-[#15151a]">
          <Item
            active={!value}
            onSelect={() => {
              onChange("");
              setOpen(false);
            }}
          >
            All collections
          </Item>
          {collections.map((c) => (
            <Item
              key={c.id}
              active={c.id === value}
              onSelect={() => {
                onChange(c.id);
                setOpen(false);
              }}
            >
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 text-xs text-gray-400">{c.documents}</span>
            </Item>
          ))}
        </div>
      )}
    </div>
  );
}
