"use client";

import { cn } from "@/lib/cn";
import { useState } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
}

export function Tabs({ items, defaultTab, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id);

  return (
    <div className={className}>
      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {items.map((item) => (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active === item.id}
            className={cn(
              "whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
              active === item.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground",
            )}
            onClick={() => setActive(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="pt-5">
        {items.find((i) => i.id === active)?.content}
      </div>
    </div>
  );
}
