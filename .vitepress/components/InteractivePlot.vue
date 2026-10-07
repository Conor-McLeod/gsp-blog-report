<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'

// Dimensionless model:  x'' + 2ζx' + x = cos(rτ),  x(0)=x'(0)=0
const zeta = ref(0.1)
const r = ref(0.9)

const freqEl = ref<HTMLElement | null>(null)
const timeEl = ref<HTMLElement | null>(null)
let Plotly: any = null

const amplitude = (rr: number, z: number) =>
  1 / Math.sqrt((1 - rr * rr) ** 2 + (2 * z * rr) ** 2)

const peakR = computed(() =>
  zeta.value < Math.SQRT1_2 ? Math.sqrt(1 - 2 * zeta.value ** 2) : 0
)
const peakA = computed(() => amplitude(peakR.value, zeta.value))
const currentA = computed(() => amplitude(r.value, zeta.value))
const qFactor = computed(() => 1 / (2 * zeta.value))

function simulate(z: number, rr: number, tMax = 80, dt = 0.02) {
  const n = Math.floor(tMax / dt)
  const t = new Array(n + 1), x = new Array(n + 1)
  let pos = 0, vel = 0
  const acc = (p: number, v: number, tt: number) => Math.cos(rr * tt) - 2 * z * v - p
  for (let i = 0; i <= n; i++) {
    const tt = i * dt
    t[i] = tt; x[i] = pos
    const k1v = acc(pos, vel, tt), k1p = vel
    const k2v = acc(pos + 0.5 * dt * k1p, vel + 0.5 * dt * k1v, tt + 0.5 * dt), k2p = vel + 0.5 * dt * k1v
    const k3v = acc(pos + 0.5 * dt * k2p, vel + 0.5 * dt * k2v, tt + 0.5 * dt), k3p = vel + 0.5 * dt * k2v
    const k4v = acc(pos + dt * k3p, vel + dt * k3v, tt + dt), k4p = vel + dt * k3v
    pos += (dt / 6) * (k1p + 2 * k2p + 2 * k3p + k4p)
    vel += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
  }
  return { t, x }
}

const baseLayout = {
  margin: { l: 55, r: 15, t: 10, b: 45 },
  font: { family: 'Charter, Georgia, serif', size: 13, color: '#222' },
  paper_bgcolor: 'rgba(0,0,0,0)',
  plot_bgcolor: 'rgba(0,0,0,0)',
  xaxis: { gridcolor: '#e6e6e6', zeroline: false, linecolor: '#444', mirror: true, ticks: 'outside' },
  yaxis: { gridcolor: '#e6e6e6', zeroline: false, linecolor: '#444', mirror: true, ticks: 'outside' },
  showlegend: true,
  legend: { orientation: 'h', y: 1.12, x: 0 }
}
const config = { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] }

function drawFrequency() {
  if (!Plotly || !freqEl.value) return
  const rs = Array.from({ length: 400 }, (_, i) => 0.01 + (i * 2.99) / 399)
  const curve = (z: number, name: string, color: string, dash = 'solid') => ({
    x: rs, y: rs.map((v) => amplitude(v, z)), mode: 'lines', name,
    line: { color, width: 1.5, dash }, hovertemplate: 'r = %{x:.2f}<br>A = %{y:.2f}<extra></extra>'
  })
  const traces: any[] = [
    curve(0.05, 'ζ = 0.05', '#b8c4d0', 'dot'),
    curve(0.2, 'ζ = 0.2', '#b8c4d0', 'dash'),
    curve(0.5, 'ζ = 0.5', '#b8c4d0'),
    { ...curve(zeta.value, `ζ = ${zeta.value.toFixed(2)}`, '#1f4e79'), line: { color: '#1f4e79', width: 3 } },
    {
      x: [r.value], y: [currentA.value], mode: 'markers', name: 'drive point',
      marker: { size: 11, color: '#c0392b', line: { color: '#fff', width: 2 } },
      hovertemplate: 'r = %{x:.2f}<br>A = %{y:.2f}<extra></extra>'
    }
  ]
  const layout = {
    ...baseLayout,
    xaxis: { ...baseLayout.xaxis, title: 'Frequency ratio r = ω / ω₀', range: [0, 3] },
    yaxis: { ...baseLayout.yaxis, title: 'Amplitude A (static units)', range: [0, 10], type: 'linear' }
  }
  Plotly.react(freqEl.value, traces, layout, config)
}

function drawTime() {
  if (!Plotly || !timeEl.value) return
  const { t, x } = simulate(zeta.value, r.value)
  const A = currentA.value
  const traces: any[] = [
    { x: t, y: x, mode: 'lines', name: 'x(τ)', line: { color: '#1f4e79', width: 2 },
      hovertemplate: 'τ = %{x:.1f}<br>x = %{y:.3f}<extra></extra>' },
    { x: [0, 80], y: [A, A], mode: 'lines', name: 'steady-state ±A', line: { color: '#c0392b', width: 1, dash: 'dash' }, hoverinfo: 'skip' },
    { x: [0, 80], y: [-A, -A], mode: 'lines', showlegend: false, line: { color: '#c0392b', width: 1, dash: 'dash' }, hoverinfo: 'skip' }
  ]
  const layout = {
    ...baseLayout,
    xaxis: { ...baseLayout.xaxis, title: 'Dimensionless time τ = ω₀t' },
    yaxis: { ...baseLayout.yaxis, title: 'Displacement x' }
  }
  Plotly.react(timeEl.value, traces, layout, config)
}

function draw() { drawFrequency(); drawTime() }

onMounted(async () => {
  Plotly = (await import('plotly.js-dist-min')).default
  draw()
})
onBeforeUnmount(() => {
  if (Plotly) {
    if (freqEl.value) Plotly.purge(freqEl.value)
    if (timeEl.value) Plotly.purge(timeEl.value)
  }
})
watch([zeta, r], draw)
</script>

<template>
  <div class="ip">
    <div class="controls">
      <label>
        <span>Damping ratio ζ <b>{{ zeta.toFixed(2) }}</b></span>
        <input type="range" min="0.02" max="1" step="0.01" v-model.number="zeta" />
      </label>
      <label>
        <span>Drive ratio r <b>{{ r.toFixed(2) }}</b></span>
        <input type="range" min="0.2" max="2.5" step="0.01" v-model.number="r" />
      </label>
      <button type="button" @click="r = Number(peakR.toFixed(2)) || 0.2">Jump to resonance peak</button>
    </div>

    <dl class="readout">
      <div><dt>Quality factor Q</dt><dd>{{ qFactor.toFixed(1) }}</dd></div>
      <div><dt>Peak at r</dt><dd>{{ peakR.toFixed(2) }}</dd></div>
      <div><dt>Peak amplitude</dt><dd>{{ peakA.toFixed(2) }}</dd></div>
      <div><dt>Amplitude at drive</dt><dd>{{ currentA.toFixed(2) }}</dd></div>
    </dl>

    <div ref="freqEl" class="plot" role="img" aria-label="Amplitude versus frequency ratio for several damping ratios"></div>
    <div ref="timeEl" class="plot" role="img" aria-label="Displacement versus time from rest"></div>
  </div>
</template>

<style scoped>
.ip { border: 1px solid var(--vp-c-divider); border-radius: 6px; padding: 1rem; background: var(--vp-c-bg); }
.controls { display: flex; flex-wrap: wrap; gap: 1rem 1.5rem; align-items: end; }
.controls label { display: flex; flex-direction: column; gap: 0.3rem; flex: 1 1 200px; font-size: 0.95rem; }
.controls b { font-variant-numeric: tabular-nums; color: var(--vp-c-brand-1); margin-left: 0.4rem; }
.controls input[type='range'] { width: 100%; accent-color: var(--vp-c-brand-1); }
.controls button {
  font: inherit; font-size: 0.9rem; padding: 0.4rem 0.8rem; border: 1px solid var(--vp-c-brand-1);
  background: transparent; color: var(--vp-c-brand-1); border-radius: 4px; cursor: pointer;
}
.controls button:hover { background: var(--vp-c-brand-1); color: #fff; }
.controls button:focus-visible, .controls input:focus-visible { outline: 2px solid var(--vp-c-brand-2); outline-offset: 2px; }
.readout { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 0.5rem; margin: 1rem 0; }
.readout div { background: var(--vp-c-bg-soft); padding: 0.4rem 0.7rem; border-radius: 4px; }
.readout dt { font-size: 0.78rem; color: var(--vp-c-text-2); }
.readout dd { margin: 0; font-size: 1.15rem; font-variant-numeric: tabular-nums; }
.plot { width: 100%; height: 320px; margin-top: 0.5rem; }
</style>
