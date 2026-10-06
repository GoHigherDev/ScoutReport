import type { Config } from 'tailwindcss'
import brandPreset from '@scoutreport/ui/tailwind.preset'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  presets: [brandPreset],
  theme: {},
  plugins: [],
}

export default config
