import type { Config } from "tailwindcss";

// Token values are CSS variables in app/globals.css; this file only names them.
const config: Config = {
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        panel: "var(--panel)",
        ink: "var(--ink)",
        "ink-2": "var(--ink-2)",
        "exun-blue": "var(--exun-blue)",
        game: "var(--game)",
        alert: "var(--alert)",
        "lens-bg": "var(--lens-bg)",
        "lens-glow": "var(--lens-glow)",
        cork: "var(--cork)",
        "card-paper": "var(--card-paper)",
        void: "var(--void)",
        snow: "var(--snow)",
        line: "var(--line)",
        "surface-1": "var(--surface-1)",
        "surface-2": "var(--surface-2)",
      },
      fontFamily: {
        ui: "var(--font-ui)",
      },
      fontSize: {
        nav: "var(--text-nav)",
      },
      zIndex: {
        background: "var(--z-background)",
        content: "var(--z-content)",
        overlay: "var(--z-overlay)",
        hud: "var(--z-hud)",
        transition: "var(--z-transition)",
      },
    },
  },
};

export default config;
