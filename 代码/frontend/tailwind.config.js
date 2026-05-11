/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        parchment: "#fef9eb",
        ink: "#1f1c14",
        forest: "#2d4b22",
        moss: "#5a6a37",
        claret: "#63000a",
        ember: "#8a1b1e",
        wheat: "#f8f3e5",
        paper: "#f3eee0",
        line: "#d8cfbf",
      },
      fontFamily: {
        headline: ["Newsreader", "serif"],
        body: ["Noto Serif SC", "serif"],
      },
      boxShadow: {
        vellum: "0 18px 40px rgba(56, 41, 24, 0.10)",
      },
      backgroundImage: {
        grain:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
};
