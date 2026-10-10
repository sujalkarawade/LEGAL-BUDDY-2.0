/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        black: '#0a0a0a',
        white: '#ffffff',
        gray: {
          50: '#f9f9f9',
          100: '#f0f0f0',
          200: '#e0e0e0',
          300: '#d0d0d0',
          400: '#999999',
          500: '#777777',
          600: '#555555',
          700: '#374151',
          800: '#1f2937',
          900: '#0a0a0a',
        },
        background: '#ffffff',
        surface: {
          DEFAULT: '#ffffff',
          alt: '#f9f9f9',
          muted: '#f0f0f0',
          dark: '#0a0a0a',
        },
        primary: {
          DEFAULT: '#0a0a0a',
          hover: '#1a1a1a',
          light: '#f0f0f0',
        },
        accent: {
          critical: '#c0392b',
          high: '#d35400',
          medium: '#b7950b',
          low: '#27ae60',
          info: '#1a5276',
        },
        text: {
          primary: '#0a0a0a',
          secondary: '#555555',
          muted: '#999999',
          light: '#ffffff',
        },
        border: {
          DEFAULT: '#0a0a0a',
          light: '#e0e0e0',
          subtle: '#f0f0f0',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      borderWidth: {
        '3': '3px',
      },
      boxShadow: {
        'brutal': '4px 4px 0 #0a0a0a',
        'brutal-sm': '2px 2px 0 #0a0a0a',
        'brutal-lg': '6px 6px 0 #0a0a0a',
        'brutal-gray': '4px 4px 0 #e0e0e0',
        'brutal-gray-sm': '2px 2px 0 #e0e0e0',
        'brutal-gray-lg': '6px 6px 0 #e0e0e0',
      },
    },
  },
  plugins: [],
}
