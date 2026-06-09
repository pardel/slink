export default {
  content: ["./dashboard/index.html", "./dashboard/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Clean technical sans for UI/headings, mono for link data (slugs, URLs, dates).
        // System fallbacks first so layout never shifts before the self-hosted faces load.
        sans: ['"IBM Plex Sans"', "system-ui", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "monospace"],
      },
      colors: {
        // Cool, calm SaaS palette: soft canvas behind a white "window", near-black
        // ink, indigo signal accent for active/interactive states.
        canvas: "#F3F4F7",
        panel: "#FFFFFF",
        ink: "#171A21",
        muted: "#6B7280",
        line: "#E8EAEF",
        accent: "#4F46E5",
        "accent-soft": "#EEF0FF",
      },
      borderRadius: { card: "12px" },
      boxShadow: {
        card: "0 1px 2px 0 rgba(23,26,33,0.04), 0 1px 3px 0 rgba(23,26,33,0.06)",
        window: "0 1px 0 0 rgba(23,26,33,0.04), 0 24px 60px -32px rgba(23,26,33,0.30)",
      },
      keyframes: {
        rise: { "0%": { opacity: "0", transform: "translateY(6px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        grow: { "0%": { transform: "scaleX(0)" }, "100%": { transform: "scaleX(1)" } },
        "slide-in": { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
        "fade-in": { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
      },
      animation: {
        rise: "rise 0.45s cubic-bezier(0.2,0.7,0.2,1) both",
        grow: "grow 0.7s cubic-bezier(0.2,0.7,0.2,1) both",
        "slide-in": "slide-in 0.32s cubic-bezier(0.2,0.7,0.2,1) both",
        "fade-in": "fade-in 0.2s ease both",
      },
    },
  },
  plugins: [],
};
