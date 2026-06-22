import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#33475b',
          orange: '#ff7a59',
          teal: '#0091ae',
          light: '#f5f8fa',
        }
      }
    },
  },
  plugins: [],
}
export default config
