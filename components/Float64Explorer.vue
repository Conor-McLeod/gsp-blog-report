<script setup lang="ts">
import katex from 'katex'
import 'katex/dist/katex.min.css'
import { computed, ref } from 'vue'

// The 64 bits of an IEEE 754 binary64: 1 sign bit, 11 exponent bits (bias
// 1023) and 52 fraction bits, with an implicit leading 1 for normal numbers.
// Type a value or click the bits; everything else is decoded from the bits.

const props = withDefaults(defineProps<{ x?: string }>(), { x: '0.1' })

const MASK = (1n << 64n) - 1n
const buf = new DataView(new ArrayBuffer(8))

function toBits(v: number) {
  buf.setFloat64(0, v)
  return buf.getBigUint64(0)
}
function fromBits(b: bigint) {
  buf.setBigUint64(0, b & MASK)
  return buf.getFloat64(0)
}

// Accepts anything Number() does, plus pi, e, inf, nan and 2^k(±c).
function parse(s: string): number | null {
  const t = s.trim().toLowerCase().replace(/[\s_,]/g, '').replace('−', '-').replace('π', 'pi')
  const sign = t.startsWith('-') ? -1 : 1
  const u = t.replace(/^[+-]/, '')
  const named: Record<string, number> = { pi: Math.PI, e: Math.E, inf: Infinity, infinity: Infinity, nan: NaN }
  if (u in named) return sign * named[u]
  const m = u.match(/^2\^(-?\d{1,4})([+-]\d+)?$/)
  if (m) return sign * (2 ** Number(m[1]) + Number(m[2] ?? 0))
  if (u === '') return null
  const v = Number(u)
  return Number.isNaN(v) ? null : sign * v
}

const text = ref(props.x)
const bits = ref(toBits(parse(props.x) ?? 0))
const bad = ref(false)

function onInput() {
  const v = parse(text.value)
  bad.value = v === null
  if (v !== null) bits.value = toBits(v)
}
// Changes made from the bits side rewrite the text box with the shortest
// decimal that round-trips.
function setBits(b: bigint) {
  bits.value = b & MASK
  text.value = String(fromBits(bits.value))
  bad.value = false
}
const bit = (i: number) => Number((bits.value >> BigInt(i)) & 1n)
const flip = (i: number) => setBits(bits.value ^ (1n << BigInt(i)))

// Neighbouring doubles: on the bit pattern, ±1 moves one ulp away from zero
// or towards it.
function nudge(dir: 1 | -1) {
  const v = fromBits(bits.value)
  if (Number.isNaN(v)) return
  if (v === 0) return setBits(dir > 0 ? 1n : (1n << 63n) | 1n)
  const away = (v > 0) === (dir > 0)
  setBits(bits.value + (away ? 1n : -1n))
}

const presets = [
  { label: '1', v: '1' },
  { label: '0.1', v: '0.1' },
  { label: '\\pi', v: 'pi' },
  { label: '2^{53}+1', v: '2^53+1' },
  { label: '\\text{max}', v: '1.7976931348623157e308' },
  { label: '\\text{min subnormal}', v: '2^-1074' },
  { label: '\\infty', v: 'inf' },
  { label: '\\text{NaN}', v: 'nan' },
]

// --- decoding --------------------------------------------------------------

const value = computed(() => fromBits(bits.value))
const s = computed(() => bit(63))
const e = computed(() => Number((bits.value >> 52n) & 0x7FFn))
const f = computed(() => bits.value & ((1n << 52n) - 1n))
const kind = computed(() => {
  if (e.value === 0x7FF) return f.value ? 'nan' : 'inf'
  if (e.value === 0) return f.value ? 'subnormal' : 'zero'
  return 'normal'
})

// Every finite double is m · 2^E for an integer m < 2^53.
const m = computed(() => kind.value === 'normal' ? f.value | (1n << 52n) : f.value)
const E = computed(() => Math.max(e.value, 1) - 1075)

// Exact decimal expansion of m · 2^E, which always terminates. Long ones are
// cut after MAX_DIGITS significant digits.
const MAX_DIGITS = 60
const exact = computed(() => {
  if (kind.value === 'nan' || kind.value === 'inf') return null
  let digits: string
  if (E.value >= 0) {
    digits = (m.value << BigInt(E.value)).toString()
  }
  else {
    const k = -E.value
    const str = (m.value * 5n ** BigInt(k)).toString().padStart(k + 1, '0')
    const frac = str.slice(-k).replace(/0+$/, '')
    digits = str.slice(0, -k) + (frac ? `.${frac}` : '')
  }
  const lead = digits.search(/[1-9]/)
  const sig = lead < 0 ? 0 : digits.slice(lead).replace('.', '').length
  let shown = digits
  if (sig > MAX_DIGITS) {
    let n = 0
    let i = lead
    for (; i < digits.length && n < MAX_DIGITS; i++) if (digits[i] !== '.') n++
    shown = `${digits.slice(0, i)}…`
  }
  return { text: (s.value ? '−' : '') + shown, sig, cut: sig > MAX_DIGITS }
})
// Whether the double is exactly the decimal that was typed in.
const typedExactly = computed(() => {
  if (bad.value || !exact.value || exact.value.cut) return null
  const t = text.value.trim()
  if (!/^-?\d*\.?\d+$/.test(t)) return null
  const norm = (x: string) => x.replace(/^(-?)0+(?=\d)/, '$1').replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return norm(t) === norm(exact.value.text.replace('−', '-'))
})

const tex = (x: string) => katex.renderToString(x, { throwOnError: false, displayMode: false })
const hex = computed(() => `0x${bits.value.toString(16).toUpperCase().padStart(16, '0')}`)
const fHex = computed(() => `0x${f.value.toString(16).toUpperCase().padStart(13, '0')}`)
// 1.f (or 0.f) as a decimal: exact, since it has at most 53 significant bits.
const sig = computed(() => Number(m.value) / 2 ** 52)
const sigTex = computed(() => String(sig.value).replace(/e([+-])(\d+)/, (_, sg, d) => ` \\times 10^{${sg === '-' ? '-' : ''}${d}}`))
const ulpTex = computed(() => `2^{${E.value}}`)

const formula = computed(() => {
  const sgn = `(-1)^{${s.value}}`
  switch (kind.value) {
    case 'nan': return `e = 2047,\\ f \\neq 0 \\;\\Rightarrow\\; \\text{NaN}`
    case 'inf': return `e = 2047,\\ f = 0 \\;\\Rightarrow\\; ${s.value ? '-' : '+'}\\infty`
    case 'zero': return `e = 0,\\ f = 0 \\;\\Rightarrow\\; ${s.value ? '-' : '+'}0`
    case 'subnormal': return `${sgn} \\times 2^{1-1023} \\times 0.f = ${sgn} \\times 2^{-1022} \\times ${sigTex.value}`
    default: return `${sgn} \\times 2^{${e.value}-1023} \\times 1.f = ${sgn} \\times 2^{${e.value - 1023}} \\times ${sigTex.value}`
  }
})

// Fields, high bit first.
const FIELDS = [
  { id: 'sign', from: 63, to: 63 },
  { id: 'exp', from: 62, to: 52 },
  { id: 'frac', from: 51, to: 0 },
] as const
const fieldOf = (i: number) => i === 63 ? 'sign' : i >= 52 ? 'exp' : 'frac'
const ORDER = Array.from({ length: 64 }, (_, k) => 63 - k)
const TICKS = new Set([63, 52, 32, 0])
</script>

<template>
  <div class="f64">
    <div class="controls">
      <label class="xin">
        <span class="k" v-html="tex('x =')" />
        <input v-model="text" spellcheck="false" :class="{ bad }" @input="onInput" @keydown.stop>
      </label>
      <div class="presets">
        <button v-for="p in presets" :key="p.v" @click="text = p.v; onInput()" v-html="tex(p.label)" />
      </div>
    </div>

    <div class="bits" role="group" aria-label="The 64 bits of x, most significant first">
      <span v-for="i in ORDER" :key="`t${i}`" class="tick" :style="{ gridColumn: 64 - i }">{{ TICKS.has(i) ? i : '' }}</span>
      <button
        v-for="i in ORDER" :key="i" class="bit" :class="[fieldOf(i), { on: bit(i) }]"
        :style="{ gridColumn: 64 - i }"
        :aria-label="`bit ${i}, ${fieldOf(i)}: ${bit(i)}`"
        :title="`bit ${i}`"
        @click="flip(i)"
      >{{ bit(i) }}</button>
    </div>

    <div class="fields">
      <div class="field sign">
        <span class="sw" /><b>sign</b> <span class="dim">1 bit</span>
        <div class="val" v-html="tex(`s = ${s}`)" />
      </div>
      <div class="field exp">
        <span class="sw" /><b>exponent</b> <span class="dim">11 bits</span>
        <div class="val" v-html="tex(`e = ${e}`)" />
      </div>
      <div class="field frac">
        <span class="sw" /><b>fraction</b> <span class="dim">52 bits</span>
        <div class="val"><span class="mono">{{ fHex }}</span></div>
      </div>
    </div>

    <div class="readout">
      <div class="formula" v-html="tex(`x = ${formula}`)" />
      <div v-if="exact" class="exact">
        <span class="k">exact value</span>
        <span class="mono digits">{{ exact.text }}</span>
        <span v-if="exact.cut" class="dim">({{ exact.sig }} significant digits)</span>
      </div>
      <div class="meta">
        <span><span class="k">hex</span> <span class="mono">{{ hex }}</span></span>
        <span v-if="exact"><span class="k">gap to next double</span> <span v-html="tex(ulpTex)" /></span>
        <span class="kind">{{ kind }}</span>
      </div>
      <div v-if="typedExactly === false" class="note">
        <span class="mono">{{ text.trim() }}</span> has no exact binary64 representation; this is the nearest double.
      </div>
    </div>

    <div class="nudge">
      <button :disabled="kind === 'nan'" title="Previous double" @click="nudge(-1)">← prev double</button>
      <button :disabled="kind === 'nan'" title="Next double" @click="nudge(1)">next double →</button>
    </div>
  </div>
</template>

<style scoped>
.f64 {
  --ink: #0b0b0b;
  --ink-2: #52514e;
  --ink-3: #8a8984;
  --line: #d6d5d0;
  --surface: #fcfcfb;
  --accent: #2a78d6;
  --bad: #d03b3b;
  --sign: #c2410c;
  --exp: #0e8a6e;
  --frac: var(--accent);

  display: flex;
  flex-direction: column;
  gap: 14px;
  color: var(--ink);
  font-size: 13px;
  line-height: 1.3;
  text-align: left;
  container-type: inline-size;
}
html.dark .f64 {
  --ink: #ffffff;
  --ink-2: #c3c2b7;
  --ink-3: #8a8984;
  --line: #3a3a37;
  --surface: #1a1a19;
  --accent: #3987e5;
  --bad: #e25555;
  --sign: #f08a4b;
  --exp: #2fbf98;
}

.k { color: var(--ink-2); font-weight: 600; }
.dim { color: var(--ink-3); }
.mono, input { font-family: var(--vp-font-family-mono, ui-monospace, monospace); }

.controls { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 12px; }
.xin { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 200px; }
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
button:disabled { opacity: 0.4; cursor: default; }

/* --- the bit strip --- */
.bits {
  display: grid;
  grid-template-columns: repeat(64, 1fr);
  grid-template-rows: auto auto;
  column-gap: 1px;
  row-gap: 2px;
}
.tick { grid-row: 1; color: var(--ink-3); font-size: 9px; text-align: center; white-space: nowrap; }
.bit {
  grid-row: 2;
  min-width: 0;
  height: 26px;
  padding: 0;
  border: none;
  border-radius: 2px;
  --c: var(--frac);
  background: color-mix(in srgb, var(--c) 12%, transparent);
  color: color-mix(in srgb, var(--c) 70%, var(--ink-3));
  font: 600 10px/26px var(--vp-font-family-mono, ui-monospace, monospace);
}
.bit.sign { --c: var(--sign); }
.bit.exp { --c: var(--exp); }
.bit.on { background: var(--c); color: #fff; }
.bit:hover { outline: 1.5px solid var(--ink-2); outline-offset: 0; color: inherit; }
.bit.on:hover { color: #fff; }
/* Gaps between the fields. */
.bit.sign, .bit:nth-of-type(12) { margin-right: 3px; }

/* Narrow: two rows of 32. */
@container (max-width: 520px) {
  .bits { grid-template-columns: repeat(32, 1fr); grid-template-rows: auto auto auto auto; }
  .tick, .bit { grid-column: auto !important; }
  .tick { display: none; }
  .bit { grid-row: auto; height: 24px; line-height: 24px; }
}

.fields { display: flex; flex-wrap: wrap; gap: 8px 24px; }
.field { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; }
.field b { color: var(--ink); font-weight: 600; }
.field .val { flex-basis: 100%; padding-left: 16px; color: var(--ink); }
.sw { display: inline-block; width: 10px; height: 10px; border-radius: 2px; background: var(--c); margin-right: 2px; }
.field.sign { --c: var(--sign); }
.field.exp { --c: var(--exp); }
.field.frac { --c: var(--frac); }

.readout {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
}
.formula { font-size: 15px; overflow-x: auto; overflow-y: hidden; padding: 2px 0; }
.exact { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
.digits { word-break: break-all; }
.meta { display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: baseline; color: var(--ink-2); }
.kind {
  margin-left: auto;
  padding: 0 6px;
  border: 1px solid var(--line);
  border-radius: 10px;
  color: var(--ink-3);
  font-size: 11px;
}
.note { color: var(--ink-2); font-size: 12px; }

.nudge { display: flex; gap: 6px; justify-content: flex-end; }
</style>
