import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import InteractivePlot from '../components/InteractivePlot.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('InteractivePlot', InteractivePlot)
  }
} satisfies Theme
