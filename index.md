---
layout: doc
title: Resonance in a Driven Damped Oscillator
---

# Resonance in a Driven Damped Oscillator: An Interactive Study

<p class="authors">A. Researcher<sup>1</sup>, B. Colleague<sup>2</sup><br>
<sup>1</sup>Department of Physics, Example University · <sup>2</sup>Institute of Applied Mechanics</p>

<div class="abstract">

**Abstract.** We examine how damping controls the response of a linear oscillator driven at a single frequency. Using the dimensionless model $\ddot{x} + 2\zeta\dot{x} + x = \cos(r\tau)$, we derive the steady-state amplitude, locate the resonance peak, and compare it with numerical integration from rest. The peak amplitude grows as $1/(2\zeta)$ for light damping and vanishes as a distinct maximum once $\zeta > 1/\sqrt{2}$. An interactive figure lets the reader vary $\zeta$ and $r$ and observe both the frequency response and the transient approach to steady state.

<p class="keywords"><b>Keywords:</b> resonance, damping, harmonic oscillator, quality factor, transient response</p>

</div>

## 1. Introduction

Driven oscillators appear throughout physics and engineering, from RLC circuits and micromechanical resonators to bridges and atomic transitions. Their defining feature is *resonance*: when the drive frequency approaches the natural frequency, the response can far exceed the static displacement [1, 2].

Static plots of the response curve hide how damping shapes both the peak height and the time needed to reach steady state. This article pairs the analytical result with a live simulation so that these dependencies can be explored directly. Section 2 states the model, Section 3 presents the interactive results, Section 4 discusses them, and Section 5 concludes.

## 2. Methods

### 2.1 Model

Scaling time by the natural frequency $\omega_0$ and displacement by the static deflection $F_0/k$ gives

$$
\ddot{x} + 2\zeta\,\dot{x} + x = \cos(r\tau), \qquad r = \frac{\omega}{\omega_0},\quad \zeta = \frac{c}{2\sqrt{km}}.
$$

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

<figure class="fig">

<ClientOnly>
  <InteractivePlot />
</ClientOnly>

<figcaption><b>Figure 1.</b> Interactive resonance explorer. Top: steady-state amplitude versus frequency ratio, with faint reference curves for fixed ζ. Bottom: simulated displacement from rest; dashed lines mark the steady-state amplitude ±A.</figcaption>
</figure>

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
