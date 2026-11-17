// Tailwind CSS 4 through PostCSS: the setup documented by Next.js
// (node_modules/next/dist/docs/01-app/01-getting-started/11-css.md).
// The Turbopack loader used before went stale during development: classes from
// new or edited files stopped reaching the CSS until `.next/` was deleted.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
