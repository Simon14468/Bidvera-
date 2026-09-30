"use client";

import { cn } from "@/lib/cn";
import { BRAND_MARK_SRC } from "@/components/brand/brand-logo";
import { ChevronDown } from "lucide-react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

export type SearchableComboboxOption = {
  value: string;
  label: string;
  /** Secondary line under the label (e.g. UTC offset). */
  description?: string;
  /** Tertiary / muted line (e.g. IANA id). */
  meta?: string;
  /** Extra tokens matched by search (e.g. ISO codes, English name). */
  searchText?: string;
  /** Optional leading content (flag, icon). */
  leading?: ReactNode;
  /** Optional group heading for the options list. */
  group?: string;
};

type PanelCoords = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top" | "sheet";
};

type FlatRow =
  | { kind: "group"; key: string; label: string }
  | { kind: "option"; option: SearchableComboboxOption; optionIndex: number };

function matchesQuery(option: SearchableComboboxOption, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    option.label,
    option.value,
    option.description ?? "",
    option.meta ?? "",
    option.group ?? "",
    option.searchText ?? "",
  ]
    .join(" ")
    .toLowerCase();
  // Support multi-word queries ("new york") against flattened IANA / labels.
  return q.split(/\s+/).every((token) => haystack.includes(token));
}

function buildFlatRows(options: SearchableComboboxOption[]): FlatRow[] {
  const rows: FlatRow[] = [];
  let lastGroup: string | null = null;
  let optionIndex = 0;
  for (const option of options) {
    const group = option.group?.trim() || "";
    if (group && group !== lastGroup) {
      rows.push({ kind: "group", key: `g-${group}`, label: group });
      lastGroup = group;
    }
    rows.push({ kind: "option", option, optionIndex });
    optionIndex += 1;
  }
  return rows;
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
  triggerClassName,
  triggerLeading,
  panelMaxHeight = 320,
  hint,
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
  /** Extra classes for the trigger button (e.g. borderless). */
  triggerClassName?: string;
  /** Always shown on the trigger (e.g. globe icon). */
  triggerLeading?: ReactNode;
  /** Preferred desktop panel height before clamping to viewport. */
  panelMaxHeight?: number;
  /** Optional hint under the control. */
  hint?: ReactNode;
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
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(
    () => options.filter((o) => matchesQuery(o, query)),
    [options, query],
  );

  const flatRows = useMemo(() => buildFlatRows(filtered), [filtered]);

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

    const preferredMax = panelMaxHeight;
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
  }, [panelMaxHeight]);

  useLayoutEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => updateCoords());
    const onWin = () => updateCoords();
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      window.cancelAnimationFrame(frame);
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
    if (!open) return;
    const selectedIdx = filtered.findIndex((o) => o.value === value);
    const next = selectedIdx >= 0 ? selectedIdx : 0;
    const t = window.setTimeout(() => setActiveIndex(next), 0);
    return () => window.clearTimeout(t);
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
    setQuery("");
    setOpen(false);
    triggerRef.current?.focus();
  }

  function selectValue(next: string) {
    onChange(next);
    setQuery("");
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
                  className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-start text-base text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:text-sm"
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
                  flatRows.map((row) => {
                    if (row.kind === "group") {
                      return (
                        <li
                          key={row.key}
                          role="presentation"
                          className="sticky top-0 z-[1] bg-card px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted"
                        >
                          {row.label}
                        </li>
                      );
                    }
                    const { option, optionIndex } = row;
                    const isSelected = option.value === value;
                    const isActive = optionIndex === activeIndex;
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
                            "flex w-full min-w-0 items-start justify-between gap-2 px-3 py-2.5 text-start text-sm transition",
                            isActive && "bg-background",
                            isSelected
                              ? "bg-primary-muted font-medium text-primary"
                              : "text-foreground hover:bg-background",
                          )}
                          onMouseEnter={() => setActiveIndex(optionIndex)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            selectValue(option.value);
                          }}
                          onClick={() => selectValue(option.value)}
                        >
                          <span className="flex min-w-0 items-start gap-2.5">
                            {option.leading ? (
                              <span className="mt-0.5 inline-flex shrink-0 items-center justify-center">
                                {option.leading}
                              </span>
                            ) : null}
                            <span className="min-w-0">
                              <span className="block break-words leading-snug">
                                {option.label}
                              </span>
                              {option.description ? (
                                <span
                                  className={cn(
                                    "mt-0.5 block text-xs font-normal tabular-nums",
                                    isSelected ? "text-primary/80" : "text-muted",
                                  )}
                                >
                                  {option.description}
                                </span>
                              ) : null}
                              {option.meta ? (
                                <span
                                  className={cn(
                                    "mt-0.5 block text-[11px] font-normal",
                                    isSelected ? "text-primary/70" : "text-muted",
                                  )}
                                >
                                  {option.meta}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          {isSelected ? (
                            <Image
                              src={BRAND_MARK_SRC}
                              alt=""
                              width={16}
                              height={16}
                              unoptimized
                              className="mt-0.5 size-4 shrink-0 object-contain"
                              aria-hidden
                            />
                          ) : (
                            <span className="mt-0.5 size-4 shrink-0" aria-hidden />
                          )}
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
          "box-border flex min-h-11 w-full max-w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2 text-start text-base text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "disabled:cursor-not-allowed disabled:opacity-60",
          "sm:min-h-10 sm:text-sm",
          open && "border-primary/30 ring-2 ring-ring",
          triggerClassName,
        )}
      >
        <span
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2.5",
            selected ? "text-foreground" : "text-muted",
          )}
        >
          {triggerLeading ? (
            <span className="inline-flex shrink-0 items-center justify-center text-muted">
              {triggerLeading}
            </span>
          ) : selected?.leading ? (
            <span className="inline-flex shrink-0 items-center justify-center">
              {selected.leading}
            </span>
          ) : null}
          <span className="min-w-0 truncate">
            {selected ? (
              selected.description || selected.meta ? (
                <>
                  <span className="block truncate font-medium leading-snug">
                    {selected.label || selected.meta || selected.value}
                  </span>
                  {selected.description ? (
                    <span className="mt-0.5 block truncate text-xs font-normal tabular-nums text-muted">
                      {selected.description}
                    </span>
                  ) : selected.meta && selected.meta !== selected.label ? (
                    <span className="mt-0.5 block truncate text-xs font-normal text-muted">
                      {selected.meta}
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="block truncate">{selected.label}</span>
              )
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
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
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
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
