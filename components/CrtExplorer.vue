<script setup lang="ts">
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

// The int8 moduli from par_gemmul8 (include/ozaki/crt_table_int8_data.hpp), in
// library order: N moduli means the first N of these.
const MODULI = [
  256, 255, 253, 251, 247, 241, 239, 233, 229, 227,
  223, 217, 211, 199, 197, 193, 191, 181, 179, 173,
].map(BigInt)

const props = withDefaults(defineProps<{ x?: string, n?: number }>(), {
  x: '123456789',
  n: 8,
})

const xText = ref(props.x)
const N = ref(props.n)

// --- BigInt helpers --------------------------------------------------------

const mod = (a: bigint, m: bigint) => ((a % m) + m) % m

// Signed residue, as in par_gemmul8: in [-p/2, p/2), so it fits in int8.
function rmod(a: bigint, p: bigint) {
  const r = mod(a, p)
  return 2n * r >= p ? r - p : r
}

function modinv(a: bigint, m: bigint) {
  let [r0, r1] = [mod(a, m), m]
  let [s0, s1] = [1n, 0n]
  while (r1 !== 0n) {
    const q = r0 / r1;
    [r0, r1] = [r1, r0 - q * r1];
    [s0, s1] = [s1, s0 - q * s1]
  }
  return mod(s0, m)
}

function log2Big(v: bigint) {
  if (v <= 0n) return 0
  const len = v.toString(2).length
  if (len <= 53) return Math.log2(Number(v))
  return len - 53 + Math.log2(Number(v >> BigInt(len - 53)))
}

// Accepts plain integers and 2^k, 2^k+c, -2^k-c.
function parseBig(s: string): bigint | null {
  const t = s.replace(/[\s_,]/g, '').replace('−', '-')
  const m = t.match(/^(-?)2\^(\d{1,3})([+-]\d+)?$/)
  try {
    if (m) {
      let v = 2n ** BigInt(m[2])
      if (m[3]) v += BigInt(m[3])
      return m[1] ? -v : v
    }
    if (/^-?\d{1,60}$/.test(t)) return BigInt(t)
  }
  catch {}
  return null
}

// Labels are rendered with KaTeX, same as the $…$ math in the slides.
const tex = (s: string) => katex.renderToString(s, { throwOnError: false })

// Plain text, for the small residues under the dials.
const fmt = (v: bigint) => v.toString().replace('-', '−')

// TeX: digits grouped in threes, or scientific notation past 19 digits.
function fmtTex(v: bigint) {
  const neg = v < 0n
  const s = (neg ? -v : v).toString()
  const sign = neg ? '-' : ''
  if (s.length <= 19) return sign + s.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,')
  return `${sign}${s[0]}.${s.slice(1, 4)} \\times 10^{${s.length - 1}}`
}

// --- the CRT -----------------------------------------------------------------

const x = computed(() => parseBig(xText.value))
const active = computed(() => MODULI.slice(0, N.value))
const P = computed(() => active.value.reduce((a, b) => a * b, 1n))
// (P / p_i) * q_i, with q_i the inverse of P / p_i mod p_i. par_gemmul8: qPi.
const weights = computed(() => active.value.map((p) => {
  const Pi = P.value / p
  return Pi * modinv(Pi, p)
}))
const residues = computed(() => x.value === null ? [] : MODULI.map(p => rmod(x.value!, p)))

// How many terms of the sum have been added; N means done.
const step = ref(N.value)
const partial = computed(() => {
  let s = 0n
  for (let i = 0; i < Math.min(step.value, N.value); i++)
    s += weights.value[i] * residues.value[i]
  return mod(s, P.value)
})
const done = computed(() => step.value >= N.value)
// Map back into the symmetric range [-P/2, P/2).
const xhat = computed(() => 2n * partial.value >= P.value ? partial.value - P.value : partial.value)
const exact = computed(() => x.value !== null && xhat.value === x.value)
const wraps = computed(() => x.value === null ? 0n : (x.value - xhat.value) / P.value)
const wrapTex = computed(() => `\\hat{x} = x ${wraps.value > 0n ? '-' : '+'} ${fmtTex(wraps.value < 0n ? -wraps.value : wraps.value)}\\,\\mathcal{P}`)

let timer: ReturnType<typeof setInterval> | undefined
function stop() {
  if (timer) clearInterval(timer)
  timer = undefined
}
function replay() {
  stop()
  step.value = 0
  timer = setInterval(() => {
    step.value++
    if (step.value >= N.value) stop()
  }, 450)
}
watch([x, N], () => {
  stop()
  step.value = N.value
})
onBeforeUnmount(stop)

// --- fullscreen --------------------------------------------------------------
// A fixed overlay rather than the Fullscreen API, which iOS doesn't support on
// arbitrary elements. The widget is teleported to <body> while expanded so no
// ancestor's transform or overflow can clip it.

const full = ref(false)
watch(full, (on) => {
  document.documentElement.style.overflow = on ? 'hidden' : ''
})
onBeforeUnmount(() => {
  document.documentElement.style.overflow = ''
})

// --- tips and tour -----------------------------------------------------------
// Each region of the widget carries data-tip="<id>". The ⓘ buttons show that
// region's tip on hover (click to pin it); the guide steps through them all,
// outlining each region in turn. Tip bodies may contain $…$ math.

const TIPS = {
  x: {
    title: 'The integer x',
    body: 'The number we hide and then try to recover. Type any integer, or a power of two like $2^{40}$ or $2^{63}-1$, or pick a preset.',
  },
  dials: {
    title: 'Residues',
    body: 'Each clock is one modulus $p_i$ (top). Its hand points at the residue $y_i = x \\bmod p_i$ (bottom): this is all the CRT gets to see of $x$. Residues are kept in $[-p_i/2,\\, p_i/2)$ so they fit in an int8. Click a clock to use the moduli up to it.',
  },
  n: {
    title: 'Number of moduli',
    body: 'Drag to choose $N$. Each modulus adds about 8 bits to $\\mathcal{P} = p_1 p_2 \\cdots p_N$. Press reconstruct to watch the sum build up one term at a time.',
  },
  ring: {
    title: 'The ring of integers mod $\\mathcal{P}$',
    body: 'The CRT only recovers $x$ modulo $\\mathcal{P}$, so the numbers live on a circle: going past $\\mathcal{P}/2$ wraps round to $-\\mathcal{P}/2$. The dashed circle marks $x$; the blue dot is the running sum $\\hat{x}$, which jumps with every term added.',
  },
  sum: {
    title: 'The reconstruction',
    body: 'The weighted sum of the residues, reduced mod $\\mathcal{P}$ into $[-\\mathcal{P}/2,\\, \\mathcal{P}/2)$. If $|x| < \\mathcal{P}/2$ then $\\hat{x} = x$ exactly; otherwise $\\hat{x}$ is off by a multiple of $\\mathcal{P}$.',
  },
  meter: {
    title: 'Capacity',
    body: 'The blue bar is how many bits the moduli can represent, $\\log_2(\\mathcal{P}/2)$. The marker is the size of $x$: green when it fits, red when it doesn\'t. Try $x = -2^{100}$ and lower $N$ until it turns red.',
  },
} as const
type TipId = keyof typeof TIPS
const TOUR: TipId[] = ['x', 'dials', 'n', 'ring', 'sum', 'meter']

const esc = (s: string) => s.replace(/[&<>"]/g, c => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot' }[c]};`)
// Odd pieces of the split are the insides of $…$.
const rich = (s: string) => s.split('$').map((t, i) => i % 2 ? tex(t) : esc(t)).join('')
// For aria-labels: $\mathcal{P}$ reads as P.
const plain = (s: string) => s.replace(/\\mathcal\{(\w)\}/g, '$1').replaceAll('$', '')

const root = ref<HTMLElement>()
const card = ref<HTMLElement>()
const tour = ref(-1) // step of the guide, -1 when it isn't running
const hover = ref<{ id: TipId, el: HTMLElement, pinned: boolean } | null>(null)
const tipId = computed(() => tour.value >= 0 ? TOUR[tour.value] : hover.value?.id)
const region = (id: TipId) => root.value?.querySelector<HTMLElement>(`[data-tip="${id}"]`)

function closeTip() {
  tour.value = -1
  hover.value = null
}
function goTo(i: number) {
  if (i < 0 || i >= TOUR.length) return closeTip()
  hover.value = null
  tour.value = i
  region(TOUR[i])?.scrollIntoView({ block: 'nearest' })
  if (TOUR[i] === 'ring' && x.value !== null) replay()
}

function info(id: TipId) {
  const show = (e: Event) => {
    if (tour.value < 0 && !hover.value?.pinned)
      hover.value = { id, el: e.currentTarget as HTMLElement, pinned: false }
  }
  const hide = () => {
    if (!hover.value?.pinned) hover.value = null
  }
  return {
    'class': 'info',
    'aria-label': `About: ${plain(TIPS[id].title)}`,
    'aria-expanded': tipId.value === id,
    'onMouseenter': show,
    'onFocus': show,
    'onMouseleave': hide,
    'onBlur': hide,
    'onClick': (e: MouseEvent) => {
      if (tour.value >= 0) return goTo(TOUR.indexOf(id))
      if (hover.value?.pinned && hover.value.id === id) hover.value = null
      else hover.value = { id, el: e.currentTarget as HTMLElement, pinned: true }
    },
  }
}

// The card is absolutely positioned inside the widget: centred on its anchor,
// below it unless there's only room above.
const cardPos = ref({ left: '0px', top: '0px' })
async function place() {
  await nextTick()
  const r = root.value
  const c = card.value
  const a = tour.value >= 0 ? region(TOUR[tour.value]) : hover.value?.el
  if (!r || !c || !a) return
  const R = r.getBoundingClientRect()
  const A = a.getBoundingClientRect()
  const W = c.offsetWidth
  const H = c.offsetHeight
  const gap = 10
  const above = A.bottom + gap + H > window.innerHeight && A.top - gap - H > 0
  const top = (above ? A.top - gap - H : A.bottom + gap) - R.top + r.scrollTop
  const left = Math.max(0, Math.min(R.width - W, A.left + A.width / 2 - W / 2 - R.left))
  cardPos.value = { left: `${left}px`, top: `${top}px` }
  if (tour.value >= 0) c.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}
watch([tipId, () => hover.value?.el, full], place)

let ro: ResizeObserver | undefined
function onResize() {
  if (tipId.value) place()
}
// A pinned tip closes on a click anywhere else; the guide stays up so the
// widget can be played with mid-tour.
function onPointerDown(e: PointerEvent) {
  const t = e.target as Element
  if (hover.value?.pinned && !card.value?.contains(t) && !t.closest('.info')) hover.value = null
}
function onKey(e: KeyboardEvent) {
  const typing = (e.target as Element)?.closest?.('input, textarea')
  if (e.key === 'Escape') {
    if (tipId.value) {
      closeTip()
      e.stopPropagation()
    }
    else if (full.value) full.value = false
  }
  else if (tour.value >= 0 && !typing && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault()
    goTo(tour.value + (e.key === 'ArrowRight' ? 1 : -1))
  }
}
onMounted(() => {
  ro = new ResizeObserver(onResize)
  if (root.value) ro.observe(root.value)
  window.addEventListener('resize', onResize)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKey, true)
})
onBeforeUnmount(() => {
  ro?.disconnect()
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKey, true)
})

function randomX() {
  const bits = 24 + Math.floor(Math.random() * 120)
  let v = 0n
  for (let i = 0; i < bits; i++) v = (v << 1n) | BigInt(Math.random() < 0.5 ? 1 : 0)
  v |= 1n << BigInt(bits - 1)
  xText.value = (Math.random() < 0.3 ? '-' : '') + v.toString()
}

const presets = [
  { label: '123456789', v: '123456789' },
  { label: '2^{40}', v: '2^40' },
  { label: '\\text{int64 max}', v: '2^63-1' },
  { label: '-2^{100}', v: '-2^100' },
]

// --- geometry ----------------------------------------------------------------

const DIAL = 52
const DR = 19

function dialHand(i: number) {
  const p = Number(MODULI[i])
  const y = Number(residues.value[i] ?? 0n)
  const a = (y / p) * 2 * Math.PI
  return { x: DIAL / 2 + DR * 0.82 * Math.sin(a), y: DIAL / 2 - DR * 0.82 * Math.cos(a) }
}

const RING = 300
const RR = 134
// Position of v on the ring Z/P, 0 at the top and ±P/2 at the bottom.
function ringPoint(v: bigint) {
  const frac = Number((mod(v, P.value) * 1_000_000n) / P.value) / 1_000_000
  const a = frac * 2 * Math.PI
  return { x: RING / 2 + RR * Math.sin(a), y: RING / 2 - RR * Math.cos(a) }
}
// The ring scales with its column, so HTML labels are placed by percentage.
const ringPct = (v: number) => `${(v / RING) * 100}%`
const target = computed(() => ringPoint(x.value ?? 0n))
const dot = computed(() => ringPoint(partial.value))

// Capacity meter, in bits. 20 moduli give log2 P ≈ 157.
const METER_MAX = 160
const capBits = computed(() => log2Big(P.value) - 1) // |x| < P/2
const needBits = computed(() => x.value === null ? 0 : log2Big(x.value < 0n ? -x.value : x.value))
const pct = (b: number) => `${Math.min(100, (b / METER_MAX) * 100)}%`
</script>

<template>
  <Teleport to="body" :disabled="!full">
  <div ref="root" class="crt" :class="{ full }" :role="full ? 'dialog' : undefined" :aria-modal="full || undefined" aria-label="CRT explorer">
    <div class="corner">
      <button class="guide" :class="{ on: tour >= 0 }" title="Step-by-step guide to the explorer" @click="tour >= 0 ? closeTip() : goTo(0)">
        {{ tour >= 0 ? 'end guide' : '? guide' }}
      </button>
      <button class="expand" :title="full ? 'Exit fullscreen (Esc)' : 'Fullscreen'" :aria-label="full ? 'Exit fullscreen' : 'Fullscreen'" @click="full = !full">
        <svg v-if="!full" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4" /></svg>
        <svg v-else width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2v4H2M14 6h-4V2M10 14v-4h4M2 10h4v4" /></svg>
      </button>
    </div>
    <div class="ring-panel">
      <div class="ring-col" data-tip="ring" :class="{ spot: tipId === 'ring' && tour >= 0 }">
        <button v-bind="info('ring')">i</button>
        <div class="ring-wrap">
          <svg :viewBox="`0 0 ${RING} ${RING}`" role="img" aria-label="Running CRT sum on the ring of integers mod P">
            <circle :cx="RING / 2" :cy="RING / 2" :r="RR" class="track-ring" />
            <line :x1="RING / 2" :y1="RING / 2 - RR - 6" :x2="RING / 2" :y2="RING / 2 - RR + 6" class="zero" />
            <circle v-if="x !== null" :cx="target.x" :cy="target.y" r="9" class="target" />
            <circle v-if="x !== null" :cx="dot.x" :cy="dot.y" r="5.5" class="dot" />
          </svg>
          <!-- KaTeX can't render inside <svg>, so the ring's labels sit on top of it. -->
          <span class="lbl" :style="{ top: `calc(${ringPct(RING / 2 - RR)} - 24px)` }" v-html="tex('0')" />
          <span class="lbl" :style="{ top: `calc(${ringPct(RING / 2 + RR)} + 6px)` }" v-html="tex('\\pm \\mathcal{P}/2')" />
          <span class="lbl big" :style="{ top: 'calc(50% - 28px)' }" v-html="tex('\\mathbb{Z}/\\mathcal{P}\\mathbb{Z}')" />
          <span class="lbl" :style="{ top: 'calc(50% + 6px)' }" v-html="rich('integers mod $\\mathcal{P}$')" />
        </div>

        <div class="legend">
          <span><svg width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="8" class="target" /></svg>target <span v-html="tex('x')" /></span>
          <span><svg width="20" height="20" aria-hidden="true"><circle cx="10" cy="10" r="5.5" class="dot" /></svg>running sum <span v-html="tex('\\hat{x}')" /></span>
        </div>
      </div>

      <div class="sum-col" data-tip="sum" :class="{ spot: tipId === 'sum' && tour >= 0 }">
        <div class="readout">
          <div class="pline"><span v-html="tex(`\\mathcal{P} = ${fmtTex(P)}`)" /><button v-bind="info('sum')">i</button></div>
          <div v-if="x !== null" v-html="tex(`\\hat{x} = \\textstyle\\sum_{i=1}^{${Math.min(step, N)}} \\frac{\\mathcal{P}}{p_i} q_i y_i \\bmod \\mathcal{P}`)" />
          <div v-if="x !== null" class="xhat" v-html="tex(`\\phantom{\\hat{x}} = ${fmtTex(xhat)}`)" />
        </div>

        <div v-if="x === null" class="verdict ko">✗ not an integer</div>
        <div v-else-if="!done" class="verdict pending">summing term {{ step }} of {{ N }}…</div>
        <div v-else-if="exact" class="verdict ok">✓ <span v-html="tex('\\hat{x} = x')" />: recovered exactly</div>
        <div v-else class="verdict ko">✗ <span v-html="tex(wrapTex)" />: wrapped</div>
      </div>
    </div>

    <div class="inputs">
      <div class="controls" data-tip="x" :class="{ spot: tipId === 'x' && tour >= 0 }">
        <label class="xin">
          <span class="k" v-html="tex('x =')" />
          <input v-model="xText" spellcheck="false" :class="{ bad: x === null }" @keydown.stop>
        </label>
        <div class="presets">
          <button v-for="p in presets" :key="p.v" @click="xText = p.v" v-html="tex(p.label)" />
          <button @click="randomX">random</button>
          <button v-bind="info('x')">i</button>
        </div>
      </div>

      <div class="controls" data-tip="n" :class="{ spot: tipId === 'n' && tour >= 0 }">
        <label class="nin">
          <span class="k" v-html="tex(`N = ${N}`)" />
          <input v-model.number="N" type="range" min="2" max="20">
        </label>
        <button class="primary" :disabled="x === null" @click="replay">▶︎ reconstruct</button>
        <button v-bind="info('n')">i</button>
      </div>

      <div class="dials-row" data-tip="dials" :class="{ spot: tipId === 'dials' && tour >= 0 }">
      <div class="dials">
        <button
          v-for="(p, i) in MODULI" :key="i" class="dial"
          :class="{ off: i >= N, cur: !done && i === step - 1 }"
          :title="`use the first ${i + 1} moduli`"
          @click="N = Math.max(2, i + 1)"
        >
          <span class="p">{{ p }}</span>
          <svg :width="DIAL" :height="DIAL" aria-hidden="true">
            <circle :cx="DIAL / 2" :cy="DIAL / 2" :r="DR" class="face" />
            <line :x1="DIAL / 2" :y1="DIAL / 2 - DR - 3" :x2="DIAL / 2" :y2="DIAL / 2 - DR + 3" class="zero" />
            <line
              v-if="i < N && x !== null"
              :x1="DIAL / 2" :y1="DIAL / 2" :x2="dialHand(i).x" :y2="dialHand(i).y" class="hand"
            />
            <circle :cx="DIAL / 2" :cy="DIAL / 2" r="2.5" class="hub" />
          </svg>
          <span class="y">{{ i < N && x !== null ? fmt(residues[i]) : '·' }}</span>
        </button>
      </div>
      <button v-bind="info('dials')">i</button>
      </div>

      <div class="meter" data-tip="meter" :class="{ spot: tipId === 'meter' && tour >= 0 }">
        <div class="meter-head">
          <span><span v-html="tex(`\\mathcal{P}/2 \\approx 2^{${capBits.toFixed(1)}}`)" /><button v-bind="info('meter')">i</button></span>
          <span v-if="x !== null" v-html="tex(`|x| \\approx 2^{${needBits.toFixed(1)}}`)" />
        </div>
        <div class="track">
          <div class="fill" :style="{ width: pct(capBits) }" />
          <div v-if="x !== null" class="need" :class="exact ? 'ok' : 'ko'" :style="{ left: pct(needBits) }" />
        </div>
        <div class="ticks">
          <span v-for="b in [0, 32, 64, 96, 128, 160]" :key="b" :style="{ left: pct(b) }">{{ b }}</span>
        </div>
        <div class="axis-label">bits</div>
      </div>
    </div>

    <div
      v-if="tipId" ref="card" class="tip" :class="{ touring: tour >= 0 }" :style="cardPos"
      :role="tour >= 0 ? 'dialog' : 'tooltip'" :aria-label="plain(TIPS[tipId].title)"
    >
      <div class="tip-head">
        <strong v-html="rich(TIPS[tipId].title)" />
        <button v-if="tour >= 0 || hover?.pinned" class="tip-x" aria-label="Close" @click="closeTip">×</button>
      </div>
      <p v-html="rich(TIPS[tipId].body)" />
      <div v-if="tour >= 0" class="tip-nav">
        <span class="dim">{{ tour + 1 }} / {{ TOUR.length }}</span>
        <button :disabled="tour === 0" @click="goTo(tour - 1)">back</button>
        <button class="primary" @click="goTo(tour + 1)">{{ tour === TOUR.length - 1 ? 'done' : 'next' }}</button>
      </div>
    </div>
  </div>
  </Teleport>
</template>

<style scoped>
.crt {
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --ink-3: #8a8984;
  --line: #d6d5d0;
  --surface: #fcfcfb;
  --accent: #2a78d6;
  --good: #0ca30c;
  --good-text: #006300;
  --bad: #d03b3b;

  position: relative;
  display: flex;
  flex-direction: column;
  gap: 16px;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.3;
  text-align: left;
}
html.dark .crt {
  --ink: #ffffff;
  --ink-2: #c3c2b7;
  --ink-3: #8a8984;
  --line: #3a3a37;
  --surface: #1a1a19;
  --accent: #3987e5;
  --good-text: #3fc43f;
  --bad: #e25555;
}

.corner {
  position: absolute;
  top: 0;
  right: 0;
  z-index: 1;
  display: flex;
  gap: 6px;
}
.expand {
  display: grid;
  place-items: center;
  padding: 5px;
}
.guide.on { color: var(--accent); border-color: var(--accent); }
.expand svg { fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }

.crt.full {
  position: fixed;
  inset: 0;
  z-index: 1000;
  justify-content: safe center;
  overflow-y: auto;
  padding: 48px max(16px, calc((100vw - 1100px) / 2));
  background: var(--vp-c-bg, var(--surface));
  font-size: 14px;
}
.crt.full .corner { position: fixed; top: 12px; right: 12px; }
.crt.full .ring-col { max-width: min(560px, 55vh); }
.crt.full .readout { font-size: 18px; }

.k { color: var(--ink-2); font-weight: 600; }
.dim { color: var(--ink-3); }
input { font-family: var(--slidev-code-font-family, ui-monospace, monospace); }

.controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 10px;
}
.xin { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 220px; }
.xin input {
  flex: 1;
  min-width: 0;
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink);
}
.xin input.bad { border-color: var(--bad); }
.presets { display: flex; flex-wrap: wrap; gap: 4px; }
button {
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--ink-2);
  font-size: 12px;
  cursor: pointer;
}
button:hover { color: var(--ink); border-color: var(--ink-3); }
button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
button:disabled { opacity: 0.4; cursor: default; }
.nin { display: flex; align-items: center; gap: 8px; flex: 1; }
.nin .k { min-width: 48px; }
.nin input { flex: 1; accent-color: var(--accent); }

.dials {
  display: grid;
  grid-template-columns: repeat(10, 1fr);
  gap: 2px 0;
}
.dial {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2px 0;
  border: 1px solid transparent;
  background: none;
  font-size: 11px;
}
.dial .p { color: var(--ink-2); font-weight: 600; }
.dial .y { color: var(--ink); font-family: var(--slidev-code-font-family, ui-monospace, monospace); min-height: 1.3em; }
.dial.off { opacity: 0.3; }
.dial.cur { border-color: var(--accent); }
.face { fill: none; stroke: var(--line); stroke-width: 1.5; }
.zero { stroke: var(--ink-3); stroke-width: 1.5; }
.hand { stroke: var(--accent); stroke-width: 2; stroke-linecap: round; }
.hub { fill: var(--accent); }

.meter { margin-top: 12px; }
.meter-head { display: flex; justify-content: space-between; color: var(--ink-2); margin-bottom: 4px; }
.track {
  position: relative;
  height: 10px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--line) 50%, transparent);
}
.fill {
  height: 100%;
  border-radius: 4px;
  background: var(--accent);
  transition: width 0.3s;
}
.need {
  position: absolute;
  top: -4px;
  width: 3px;
  height: 18px;
  margin-left: -1.5px;
  border-radius: 2px;
  outline: 2px solid var(--surface);
  transition: left 0.3s;
}
.need.ok { background: var(--good); }
.need.ko { background: var(--bad); }
.ticks { position: relative; height: 14px; color: var(--ink-3); font-size: 10px; }
.ticks span { position: absolute; transform: translateX(-50%); top: 2px; }
.axis-label { color: var(--ink-3); font-size: 10px; text-align: right; }

.ring-panel { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px 28px; }
.ring-col { display: flex; flex-direction: column; align-items: center; gap: 6px; flex: 1 1 280px; max-width: 420px; padding-top: 8px; }
.sum-col { display: flex; flex-direction: column; gap: 12px; flex: 1 1 260px; }
.track-ring { fill: none; stroke: var(--line); stroke-width: 2; }
.ring-wrap { position: relative; width: 100%; aspect-ratio: 1; margin-bottom: 10px; }
.ring-wrap svg { display: block; width: 100%; height: 100%; }
.lbl { position: absolute; left: 50%; transform: translateX(-50%); white-space: nowrap; color: var(--ink-3); font-size: 11px; }
.lbl.big { font-size: 20px; color: var(--ink-2); }
.legend { display: flex; gap: 12px; color: var(--ink-2); font-size: 11px; }
.legend > span { display: flex; align-items: center; gap: 3px; }
.target { fill: none; stroke: var(--ink-2); stroke-width: 1.5; stroke-dasharray: 3 2; }
.dot {
  fill: var(--accent);
  stroke: var(--surface);
  stroke-width: 2;
  transition: cx 0.35s, cy 0.35s;
}
.readout { color: var(--ink); font-size: 15px; line-height: 1.6; }
.readout .xhat { overflow-x: auto; }
.verdict {
  width: 100%;
  padding: 5px 8px;
  border-radius: 4px;
  font-weight: 600;
  border: 1px solid currentColor;
}
.verdict.ok { color: var(--good-text); }
.verdict.ko { color: var(--bad); }
.verdict.pending { color: var(--ink-2); }

/* --- tips and guide --- */
.info {
  display: inline-grid;
  place-items: center;
  flex: none;
  width: 16px;
  height: 16px;
  padding: 0;
  margin-left: 6px;
  border-radius: 50%;
  color: var(--ink-3);
  font: italic 600 10px/1 Georgia, serif;
  vertical-align: middle;
}
.info[aria-expanded="true"] { color: var(--accent); border-color: var(--accent); }
.ring-col { position: relative; }
.ring-col > .info { position: absolute; top: 0; left: 0; margin: 0; }
.pline { display: flex; align-items: center; }
.dials-row { display: flex; align-items: center; gap: 4px; }
.dials-row .dials { flex: 1; }
.dials-row > .info { margin: 0; }

[data-tip] { border-radius: 6px; outline: 2px solid transparent; outline-offset: 4px; transition: outline-color 0.2s; }
[data-tip].spot { outline-color: var(--accent); }

.tip {
  position: absolute;
  z-index: 5;
  width: min(320px, 100%);
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.12);
  color: var(--ink-2);
  font-size: 13px;
  line-height: 1.45;
  pointer-events: none;
}
.tip.touring, .tip:has(.tip-x) { pointer-events: auto; }
.tip-head { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; color: var(--ink); }
.tip p { margin: 4px 0 0; }
.tip-x { padding: 0 6px; border: none; background: none; font-size: 16px; line-height: 1; }
.tip-nav { display: flex; align-items: center; gap: 6px; margin-top: 10px; }
.tip-nav .dim { margin-right: auto; font-size: 11px; }
</style>
