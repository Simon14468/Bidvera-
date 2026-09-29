"use client";

import { cn } from "@/lib/cn";
import { Check, ChevronDown } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  /** Extra tokens matched by search (e.g. ISO codes, English name). */
  searchText?: string;
  /** Optional leading content (flag, icon). */
  leading?: ReactNode;
};

type PanelCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top" | "sheet";
};

function matchesQuery(option: SearchableComboboxOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [option.label, option.value, option.searchText ?? ""]
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function SearchableCombobox({
  id,
  label,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  required,
  disabled,
  className,
}: {
  id?: string;
  label: string;
  value: string;
  options: SearchableComboboxOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}) {
  const reactId = useId();
  const listboxId = `${reactId}-listbox`;
  const labelId = `${reactId}-label`;
  const searchId = `${reactId}-search`;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Map<string, HTMLElement>>(new Map());

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<PanelCoords | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(
    () => options.filter((o) => matchesQuery(o, query)),
    [options, query],
  );

  const updateCoords = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const margin = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const preferSheet = vw < 480 || vh < 520;

    if (preferSheet) {
      const maxHeight = Math.min(Math.floor(vh * 0.72), 420);
      setCoords({
        top: Math.max(margin, vh - maxHeight - margin),
        left: margin,
        width: Math.max(0, vw - margin * 2),
        maxHeight,
        placement: "sheet",
      });
      return;
    }

    const preferredMax = 320;
    const spaceBelow = vh - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const placement =
      spaceBelow < 200 && spaceAbove > spaceBelow ? "top" : "bottom";
    const available = placement === "bottom" ? spaceBelow : spaceAbove;
    const maxHeight = Math.max(160, Math.min(preferredMax, available));
    const top =
      placement === "bottom"
        ? rect.bottom + 6
        : Math.max(margin, rect.top - 6 - maxHeight);

    setCoords({
      top,
      left: Math.max(
        margin,
        Math.min(rect.left, vw - rect.width - margin),
      ),
      width: rect.width,
      maxHeight,
      placement,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    const onWin = () => updateCoords();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open, updateCoords, filtered.length]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const selectedIdx = filtered.findIndex((o) => o.value === value);
    setActiveIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [open, filtered, value]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const option = filtered[activeIndex];
    if (!option) return;
    optionRefs.current.get(option.value)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, filtered, open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectValue(next: string) {
    onChange(next);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onSearchKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const option = filtered[activeIndex];
      if (option) selectValue(option.value);
    }
  }

  const activeOption = filtered[activeIndex];
  const activeId = activeOption ? `${reactId}-opt-${activeOption.value}` : undefined;
  const isSheet = coords?.placement === "sheet";

  const panel =
    mounted && open && coords
      ? createPortal(
          <>
            {isSheet ? (
              <button
                type="button"
                className="fixed inset-0 z-40 bg-foreground/30"
                aria-label="Close"
                onClick={close}
              />
            ) : null}
            <div
              ref={panelRef}
              id={listboxId}
              role="listbox"
              aria-labelledby={labelId}
              className={cn(
                "fixed z-50 overflow-hidden border border-border bg-card shadow-[var(--shadow-lift)]",
                isSheet ? "rounded-t-2xl rounded-b-xl" : "rounded-xl",
              )}
              style={{
                top: coords.top,
                left: coords.left,
                width: coords.width,
                maxHeight: coords.maxHeight,
              }}
            >
              <div className="border-b border-border p-2">
                <input
                  ref={searchRef}
                  id={searchId}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActiveIndex(0);
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={searchPlaceholder}
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-activedescendant={activeId}
                  className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-base text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:text-sm"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <ul
                className="overflow-y-auto overscroll-contain py-1"
                style={{ maxHeight: Math.max(96, coords.maxHeight - 56) }}
              >
                {filtered.length === 0 ? (
                  <li className="px-3 py-3 text-sm text-muted">{emptyMessage}</li>
                ) : (
                  filtered.map((option, index) => {
                    const isSelected = option.value === value;
                    const isActive = index === activeIndex;
                    return (
                      <li
                        key={option.value}
                        id={`${reactId}-opt-${option.value}`}
                        role="option"
                        aria-selected={isSelected}
                        ref={(el) => {
                          if (el) optionRefs.current.set(option.value, el);
                          else optionRefs.current.delete(option.value);
                        }}
                      >
                        <button
                          type="button"
                          className={cn(
                            "flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-start text-sm transition",
                            isActive && "bg-background",
                            isSelected
                              ? "bg-primary-muted font-medium text-primary"
                              : "text-foreground hover:bg-background",
                          )}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => selectValue(option.value)}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            {option.leading ? (
                              <span className="inline-flex shrink-0 items-center justify-center">
                                {option.leading}
                              </span>
                            ) : null}
                            <span className="min-w-0 break-words">{option.label}</span>
                          </span>
                          {isSelected ? (
                            <Check className="size-4 shrink-0 text-primary" aria-hidden />
                          ) : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <div className={cn("relative min-w-0 space-y-1.5", className)}>
      <label id={labelId} htmlFor={id} className="block text-sm font-medium text-foreground">
        {label}
      </label>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-labelledby={labelId}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onTriggerKeyDown}
        className={cn(
          "box-border flex h-11 w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 text-start text-base text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "sm:h-10 sm:text-sm",
          open && "border-primary/30 ring-2 ring-ring",
        )}
      >
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5 truncate",
            selected ? "text-foreground" : "text-muted",
          )}
        >
          {selected?.leading ? (
            <span className="inline-flex shrink-0 items-center justify-center">
              {selected.leading}
            </span>
          ) : null}
          <span className="min-w-0 truncate">
            {selected?.label ?? placeholder}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition",
            open && "rotate-180 text-foreground",
          )}
          aria-hidden
        />
      </button>
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden
          className="sr-only"
          value={value}
          required
          onChange={() => undefined}
        />
      ) : null}
      {panel}
    </div>
  );
}
