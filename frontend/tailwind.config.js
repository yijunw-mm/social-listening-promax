module.exports = {
  content: [
    "../index.html",
    "./src/**/*.{html,js}",
    "./tab*.html",
    "./**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        // Primary accent colors
        primary: "#C990B8",
        primaryHover: "#D4A4C6",
        accent: "#A876BF",

        // Background colors
        bgMain: "#1a1f2e",
        bgSecondary: "#232938",
        bgSidebar: "#252d3d",
        cardBg: "#2a3142",

        // Interactive elements
        buttonPrimary: "#B87FB8",
        buttonHover: "#C990B8",
        tabActive: "#B87FB8",
        tabInactive: "#3d4456",

        // Borders
        borderPrimary: "#3d4456",
        borderLight: "#4d5568",
        borderAccent: "#B87FB8",

        // Text colors
        textMain: "#e5e7eb",
        textSecondary: "#9ca3af",
        textMuted: "#6b7280",

        // Status colors
        error: "#7a3a3a",
        errorBorder: "#8b4444",
        success: "#3a7a5a",
        warning: "#7a6a3a",
      },
      fontFamily: {
        body: ["Inter", "system-ui", "sans-serif"],
        title: ["Inter", "system-ui", "sans-serif"],
        mainTitle: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
}
