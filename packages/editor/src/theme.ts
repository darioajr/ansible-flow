import { useEffect, useState } from "react";

/** PatternFly is the theme source for embedded editors as well as custom UI. */
export function useDarkTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const update = () =>
      setDark(document.documentElement.classList.contains("pf-v6-theme-dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);
  return dark;
}
