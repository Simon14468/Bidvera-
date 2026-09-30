"use client";

import {
  SearchableCombobox,
  type SearchableComboboxOption,
} from "@/components/ui/searchable-combobox";
import {
  buildTimezoneOptions,
  formatTimezoneFriendlyLabel,
  formatTimezoneOffset,
  isValidIanaTimeZone,
} from "@/lib/timezones";
import { Globe2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";

/** Day-scoped cache so opening Settings does not rebuild ~400 Intl offsets. */
let optionsCacheDay: string | null = null;
let optionsCache: SearchableComboboxOption[] | null = null;

function timezoneOptionsForToday(): SearchableComboboxOption[] {
  const day = new Date().toISOString().slice(0, 10);
  if (optionsCache && optionsCacheDay === day) return optionsCache;
  const at = new Date();
  optionsCache = buildTimezoneOptions(at).map((tz) => ({
    value: tz.value,
    label: tz.label,
    description: tz.offsetLabel,
    meta: tz.value,
    group: tz.region,
    searchText: tz.searchText,
  }));
  optionsCacheDay = day;
  return optionsCache;
}

function ensureOption(
  options: SearchableComboboxOption[],
  value: string,
): SearchableComboboxOption[] {
  const trimmed = value.trim();
  if (!trimmed || options.some((o) => o.value === trimmed)) return options;
  if (!isValidIanaTimeZone(trimmed)) return options;
  const at = new Date();
  return [
    {
      value: trimmed,
      label: formatTimezoneFriendlyLabel(trimmed),
      description: formatTimezoneOffset(trimmed, at),
      meta: trimmed,
      group: trimmed.includes("/") ? trimmed.slice(0, trimmed.indexOf("/")) : "UTC",
      searchText: `${trimmed} ${formatTimezoneFriendlyLabel(trimmed)}`,
    },
    ...options,
  ];
}

export function TimezonePicker({
  id,
  label,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  hint,
  disabled,
  required,
  className,
  loading,
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  hint?: ReactNode;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  /** Soft loading state while browser detection runs (field stays usable). */
  loading?: boolean;
}) {
  const options = useMemo(
    () => ensureOption(timezoneOptionsForToday(), value),
    [value],
  );

  return (
    <SearchableCombobox
      id={id}
      label={label}
      value={value}
      options={options}
      onChange={onChange}
      placeholder={loading && !value ? "…" : placeholder}
      searchPlaceholder={searchPlaceholder}
      emptyMessage={emptyMessage}
      hint={hint}
      disabled={disabled}
      required={required}
      className={className}
      panelMaxHeight={360}
      triggerClassName="border-transparent"
      triggerLeading={<Globe2 className="size-4" aria-hidden />}
    />
  );
}
