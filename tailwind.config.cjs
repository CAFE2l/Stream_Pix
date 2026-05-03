module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#050807',
        neon: '#00FF88',
        cyan: '#00E5A8',
        darkgreen: '#0F3D2E',
        offwhite: '#F8FFFb',
        sage: '#8FA99B'
      },
      boxShadow: {
        'neon': '0 6px 30px rgba(0,255,136,0.12), 0 2px 8px rgba(0,229,168,0.08)'
      },
      backdropBlur: {
        sm: '4px'
      }
    }
  },
  plugins: [],
}
