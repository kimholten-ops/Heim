import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Design tokens
        background: "var(--background)",
        surface:    "var(--surface)",
        "surface-2":"var(--surface-2)",
        fg:         "var(--foreground)",
        "text-2":   "var(--text-2)",
        "text-3":   "var(--text-3)",
        border:     "var(--border)",
        accent:     "var(--accent)",
        "accent-weak": "var(--accent-weak)",
        // Member colours
        "m-teal":   "var(--m-teal)",
        "m-amber":  "var(--m-amber)",
        "m-violet": "var(--m-violet)",
        "m-coral":  "var(--m-coral)",
      },
      borderRadius: {
        card:   "18px",
        tile:   "16px",
        date:   "13px",
        chip:   "99px",
        icon:   "12px",
        avatar: "99px",
        check:  "7px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(20,22,28,.04), 0 2px 8px rgba(20,22,28,.05)",
      },
      fontSize: {
        "10": ["10px", { lineHeight: "1" }],
        "12": ["12px", { lineHeight: "1.4" }],
        "12.5": ["12.5px", { lineHeight: "1.4" }],
        "13": ["13px", { lineHeight: "1.4" }],
        "15": ["15px", { lineHeight: "1.45" }],
        "17": ["17px", { lineHeight: "1" }],
        "27": ["27px", { lineHeight: "1.05" }],
      },
      letterSpacing: {
        tight27: "-0.03em",
        wide12:  "0.07em",
      },
      fontWeight: {
        "450": "450",
        "550": "550",
        "600": "600",
        "700": "700",
        "800": "800",
      },
    },
  },
  plugins: [],
};
export default config;
