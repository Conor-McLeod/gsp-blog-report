import { defineConfig } from 'vitepress'
import footnote from 'markdown-it-footnote'

export default defineConfig({
  base: '/gsp-blog-report/',
  title: 'Resonance in a Driven Damped Oscillator',
  description: 'An interactive scientific article built with VitePress',
  appearance: false,
  themeConfig: {
    nav: [],
    outline: { level: [2, 3], label: 'Contents' },
    sidebar: false,
    docFooter: { prev: false, next: false }
  },
  vite: {
    server: { allowedHosts: true } // let the dev server answer on remote hostnames
  },
  markdown: {
    math: true, // requires markdown-it-mathjax3
    config: (md) => {
      md.use(footnote)
    }
  },
  vue: {
    template: {
      compilerOptions: {
        isCustomElement: (tag) => tag.startsWith('mjx-')
      }
    }
  }
})
