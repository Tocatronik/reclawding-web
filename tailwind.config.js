/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'reclawding-bg': '#0F172A',
        'reclawding-card': '#1E293B',
        'reclawding-primary': '#3B82F6',
        'reclawding-text': '#F8FAFC',
      },
    },
  },
  plugins: [],
};
