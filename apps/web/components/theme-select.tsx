"use client";
import { useEffect, useState } from "react";
import { FormSelect, FormSelectOption } from "@patternfly/react-core";

type Theme = "system" | "light" | "dark";
const key = "playbook-flow-theme";
function preference(value: string | null): Theme {
  return value === "light" || value === "dark" ? value : "system";
}
export function ThemeSelect() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let selected: Theme = "system";
    const apply = () => {
      const dark =
        selected === "dark" || (selected === "system" && media.matches);
      document.documentElement.classList.toggle("pf-v6-theme-dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
    };
    const read = () => {
      try {
        selected = preference(localStorage.getItem(key));
      } catch {
        selected = "system";
      }
      setTheme(selected);
      apply();
    };
    const change = (event: Event) => {
      selected = (event as CustomEvent<Theme>).detail;
      setTheme(selected);
      apply();
    };
    read();
    media.addEventListener("change", apply);
    window.addEventListener("storage", read);
    window.addEventListener("playbook-theme", change);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("storage", read);
      window.removeEventListener("playbook-theme", change);
    };
  }, []);
  return (
    <FormSelect
      aria-label="Color theme"
      value={theme}
      onChange={(_, value) => {
        const selected = preference(value);
        try {
          localStorage.setItem(key, selected);
        } catch {
          /* Theme still works without storage. */
        }
        window.dispatchEvent(
          new CustomEvent("playbook-theme", { detail: selected }),
        );
      }}
    >
      <FormSelectOption value="system" label="System theme" />
      <FormSelectOption value="light" label="Light theme" />
      <FormSelectOption value="dark" label="Dark theme" />
    </FormSelect>
  );
}
