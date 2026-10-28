// Merge theme.extend into the project's Tailwind 3 configuration.
module.exports = {
  colors: {
    background: 'oklch(var(--background) / <alpha-value>)',
    foreground: 'oklch(var(--foreground) / <alpha-value>)',
    card: 'oklch(var(--card) / <alpha-value>)',
    muted: { foreground: 'oklch(var(--muted-foreground) / <alpha-value>)' },
    border: 'oklch(var(--border) / <alpha-value>)',
    brand: { DEFAULT: 'oklch(var(--brand) / <alpha-value>)', soft: 'oklch(var(--brand-soft) / <alpha-value>)' },
    system: 'oklch(var(--system) / <alpha-value>)'
  },
  fontFamily: { title: ['Noto Serif SC', 'Songti SC', 'serif'], sans: ['PingFang SC', 'Noto Sans SC', 'sans-serif'], mono: ['JetBrains Mono', 'monospace'] },
  fontSize: { display: '40px', h1: '28px', h2: '20px', body: '15px', meta: '13px' },
  borderRadius: { none: '0' },
  transitionDuration: { micro: '120ms', panel: '240ms' },
  transitionTimingFunction: { standard: 'cubic-bezier(0.2, 0, 0, 1)' }
};

