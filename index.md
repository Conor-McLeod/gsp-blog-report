---
layout: doc
title: Resonance in a Driven Damped Oscillator
---

<script setup>
import CrtExplorer from './components/CrtExplorer.vue'
</script>

# Node-level Parallelisation of Ozaki Scheme II

<p class="authors">Conor McLeod</p>

<div class="abstract">

**Abstract.**
Driven by the AI boom, NVIDIAs newest accelerators increasingly prioritise low precision GEMMs ahead of FP64 GEMMs. 
To keep FP64 GEMMs fast, we look to emulation techniques.
The Ozaki Scheme II is an efficient FP64 GEMM emulation technique which uses the Chinese Remainder Theorem to perform high precision GEMMs on the INT8 tensor cores.
This summer, I worked on a node-level Ozaki scheme library which runs on JUPITER.

<p class="keywords"><b>Keywords:</b> GEMM, Ozaki Scheme, Chinese Remainder Theorem, harmonic oscillator, quality factor, transient response</p>

</div>

## 1. Introduction

The General Matrix Multiply (GEMM) operation is perhaps the most ubiquitous 

## 2. Background 

### 2.1 Chinese Remainder Theroem

Let $x \in \mathbb{Z}$, and let $p_1, \dots, p_N \in \mathbb{N}_{\ge 2}$ be pairwise coprime with $\mathcal{P} := \prod_{i=1}^{N} p_i$.

Let $q_i \in \mathbb{N}$ be the modular inverse of $\dfrac{\mathcal{P}}{p_i}$, such that:

$$
\frac{\mathcal{P}}{p_i}\, q_i \equiv 1 \pmod{p_i}
$$

Suppose $x$ is known only through its residues:

$$
\begin{cases}
x \equiv y_1 \pmod{p_1}, \\
\quad \vdots \\
x \equiv y_N \pmod{p_N}.
\end{cases}
$$

Then $x$ is recovered modulo $\mathcal{P}$:

$$
x \equiv \sum_{i=1}^{N} \frac{\mathcal{P}}{p_i}\, q_i\, y_i \pmod{\mathcal{P}}
$$

This is a **weighted sum** of the residues: each $y_i$ gets a fixed weight $\frac{\mathcal{P}}{p_i}\, q_i$ that depends only on the moduli

To better communicate the intution behind this

<CrtExplorer />

### 2.2 Steady-state solution

After transients decay, the response is $x_\mathrm{ss}(\tau) = A\cos(r\tau - \varphi)$ with

$$
A(r) = \frac{1}{\sqrt{(1 - r^2)^2 + (2\zeta r)^2}}, \qquad
\tan\varphi = \frac{2\zeta r}{1 - r^2}.
$$

For $\zeta < 1/\sqrt{2}$ the amplitude is maximal at

$$
r_\mathrm{peak} = \sqrt{1 - 2\zeta^2}, \qquad A_\mathrm{max} = \frac{1}{2\zeta\sqrt{1 - \zeta^2}}.
$$

### 2.3 Numerical integration

The full solution, including the transient, is computed in the browser with a fourth-order Runge–Kutta scheme (step $\Delta\tau = 0.02$) from the initial condition $x(0) = \dot{x}(0) = 0$.

## 3. Results

Figure 1 shows the amplitude response (top) and the displacement from rest (bottom). Drag the sliders to change the damping ratio and drive frequency; the red marker on the response curve follows the chosen drive point.

Table 1 summarizes the analytical peak values for typical damping ratios.

| ζ | Q = 1/(2ζ) | r<sub>peak</sub> | A<sub>max</sub> |
|:---:|:---:|:---:|:---:|
| 0.05 | 10.0 | 0.997 | 10.01 |
| 0.10 | 5.0 | 0.990 | 5.03 |
| 0.20 | 2.5 | 0.959 | 2.55 |
| 0.50 | 1.0 | 0.707 | 1.15 |

<p class="keywords"><b>Table 1.</b> Resonance peak for selected damping ratios.</p>

## 4. Discussion

Three observations follow from the figure.

1. **Peak height scales with $Q$.** Halving the damping roughly doubles the peak amplitude, consistent with $A_\mathrm{max} \approx Q$ for $\zeta \ll 1$.
2. **The peak shifts downward in frequency.** The maximum occurs at $r_\mathrm{peak} < 1$ and moves further from $\omega_0$ as damping increases, disappearing entirely at $\zeta = 1/\sqrt{2}$.
3. **Light damping slows settling.** Transients decay as $e^{-\zeta\tau}$, so a high-$Q$ system needs many cycles to reach steady state. Near resonance, the displacement grows through a slow beating envelope before saturating at $A$.

The model is linear and has a single degree of freedom. Real systems may show nonlinear stiffness, multiple modes, or frequency-dependent damping, none of which are captured here.

## 5. Conclusion

Damping sets the height, position, and sharpness of the resonance peak, and also the time needed to reach it. An interactive figure makes these coupled effects visible in a way static plots cannot. The same VitePress pattern—Markdown prose, LaTeX math, and a Vue component—can be reused for any article whose claims are best supported by a parameter the reader can change.

## Acknowledgements

This work was supported by the (fictional) Example Science Foundation, grant 000-000.

## References

<ol class="references">
<li>Landau, L. D., &amp; Lifshitz, E. M. (1976). <i>Mechanics</i> (3rd ed.). Pergamon Press.</li>
<li>Thornton, S. T., &amp; Marion, J. B. (2004). <i>Classical Dynamics of Particles and Systems</i> (5th ed.). Brooks/Cole.</li>
<li>Strogatz, S. H. (2015). <i>Nonlinear Dynamics and Chaos</i> (2nd ed.). Westview Press.</li>
</ol>
