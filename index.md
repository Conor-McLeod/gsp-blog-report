---
layout: doc
title: Node-level Parallelisation of Ozaki Scheme II
---

<script setup>
import CrtExplorer from './components/CrtExplorer.vue'
import OzakiSteps from './components/OzakiSteps.vue'
</script>

# Node-level Parallelisation of Ozaki Scheme II

<p class="authors">Conor McLeod</p>

<div class="abstract">

**Abstract.**
Driven by the AI boom, NVIDIAs newest accelerators increasingly prioritise low precision GEMMs ahead of FP64 GEMMs. 
To keep FP64 GEMMs fast, we look to emulation techniques.
The Ozaki Scheme II is an efficient FP64 GEMM emulation technique which uses the Chinese Remainder Theorem to perform double precision GEMMs on the INT8 tensor cores.
This summer, I worked on a node-level Ozaki scheme library which runs on JUPITER.

<p class="keywords"><b>Keywords:</b> GEMM, Ozaki Scheme, Chinese Remainder Theorem</p>

</div>

## 1. Introduction

The General Matrix Multiply (GEMM) operation is perhaps the most ubiquitous mathematical operation we perform. On GPUs, we can perform these operations incredibly fast.

Science and engineering codes have classically operated in the high precision [FP64](https://en.wikipedia.org/wiki/Double-precision_floating-point_format) regime.

But today, NVIDIA is designing their GPUs for a different crowd.
Unlike scientific computing, mainstream deep learning rarely uses FP64.
AI workloads are 
The max precision you will see in deep learning is FP32, and with care, much lower precisions can be used.
A range of low precision float formats have proliferated in the last few years.

So the need for the Ozaki scheme arises out of  economic factors just as much as scientific ones.
Nvidia is a profit making, publically-listed company, and they will go where the money is. 
Traditional HPC cannot compete with the historically unprecedented level of capital expenditure behind the AI boom. 
So if science and engineering want to pursue the best high precision GEMM performance, they must adapt to the way the hardware being designed today.[^1]

The Ozaki Scheme II is a scheme for emulating FP64 matrix multiplication using the [Chinese Remainder Theorem](https://en.wikipedia.org/wiki/Chinese_remainder_theorem). 

Nvidia added FP64 emulation on INT8 tensor cores to cuBLAS in [CUDA Toolkit 13.0 Update 2](https://developer.nvidia.com/blog/unlocking-tensor-core-performance-with-floating-point-emulation-in-cublas/).


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

### 2.2 Ozaki Scheme II

Armed with an understanding of the Chinese Remainder Theorem. The idea is we can take input FP64 matrices, scale and truncate the values to convert them to large integers, then form matrices of residues for given moduli.
We perform the matrix multiplication on these residues

<OzakiSteps />

### 2.3 INT8 Tensor Cores

Tensor cores are specialised hardware units on Nvidia GPUs for performing matrix multiplication. Tensor cores support different number formats, and the lower the format, the better the performance.

## 3. Results

## 4. Discussion

## 5. Conclusion


## Acknowledgements

I would like to thank Clément Richefort for supervising my project.

## References

<ol class="references">
<li>K. Ozaki, T. Ogita, S. Oishi, and S. M. Rump, ‘Error-free transformations of matrix multiplication by using fast routines of matrix multiplication and its applications’, <i>Numer Algor</i>, vol. 59, no. 1, pp. 95–118, Jan. 2012, doi: <a href="https://doi.org/10.1007/s11075-011-9478-1">10.1007/s11075-011-9478-1</a>.</li>
<li>Y. Uchino et al., ‘High-Performance and Power-Efficient Emulation of Matrix Multiplication using INT8 Matrix Engines’, in <i>Proceedings of the SC ’25 Workshops of the International Conference for High Performance Computing, Networking, Storage and Analysis</i>, in ACM Conferences, 2025, pp. 1824–1831. doi: <a href="https://doi.org/10.1145/3731599.3767539">10.1145/3731599.3767539</a>.</li>
</ol>

[^1]: Nvidia have said they are not abandoning the HPC community
