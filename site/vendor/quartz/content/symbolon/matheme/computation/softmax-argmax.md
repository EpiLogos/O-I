---
title: "Softmax and Argmax"
record_id: matheme-softmax-argmax
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Exact technical construction; argued native relation and offered experimental application"
---

# Softmax and Argmax

## #0 — Declare the finite score field

Let `z=(z₁,…,z_n)` be finite real logits with `n≥1`, and let temperature `T>0`. Define

`p_i=exp(z_i/T)/Σ_j exp(z_j/T)`.

The [version-fixed PyTorch house](../../episteme/sources/computer-science-ml/pytorch/pytorch-2-9-softmax-argmax-api/pytorch-2-9-softmax-argmax-api.md) distinguishes softmax normalisation, argmax index selection and its first-maximum tie rule. The [core spine](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) supplies the separate native selection/retained-field comparison.

## #1 — Normalise and shift

Every exponential is positive and their finite sum is positive, so `p_i>0` and `Σ_i p_i=1`. Adding a common real constant `c` to every logit changes numerator and denominator by the same factor `exp(c/T)`; it therefore leaves every probability unchanged.

For a stable numerical implementation, subtract `max(z)` before exponentiation. This is the same invariance used to prevent overflow, not an approximation to another distribution. Finite-precision underflow can still set extremely small computed entries to zero even though the mathematical probabilities remain positive.

## #2 — Work one distribution

At `T=1`, take `z=(0,ln2,ln4)`. Exponentiation gives weights `(1,2,4)`, hence `p=(1/7,2/7,4/7)`. Adding 10 to all logits yields the same distribution. At `T=2`, the weights become `(1,√2,2)`, changing the probabilities while retaining their ordering.

Argmax returns a maximum index, here the third coordinate. Sampling from the distribution can return any coordinate, with its stated probability. The distribution, maximum selection and random draw are three different outputs.

## #3 — Resolve the limiting cases

Let `M=max(z)` and let `k` entries attain M. Rewrite the probabilities using `z_i−M`. As `T→0+`, maximal entries have numerator 1 and all others tend to 0, so each maximum receives mass `1/k`. A unique maximum gives a one-hot limit; tied maxima do not.

For `z=(0,0,−1)`, the limit is `(1/2,1/2,0)`. PyTorch's documented argmax instead chooses the first maximal index. As `T→∞`, all exponentials approach 1 and the distribution tends to uniform `1/n`. These are limits of the family; the defining expression does not set `T=0`.

## #4 — Retain the field around the cut

The native comparison concerns which information travels with a selection. Keeping logits or probabilities, temperature, candidate set and selection rule allows an answer to return through its conditions. Keeping only the chosen index discards most of that field. [Preference gauge](preference-gauge.md) gives the related invariance at the comparison level.

An output token's semantic role requires its actual model, context and use. The API source establishes operators, not a deployed LLM pipeline or the identity of softmax with apoha. The quilt's cooling/reopening proposal is a technical candidate whose effect must be tested, especially because changed temperature alone does not revise a representation or evaluator.

## #5→0 — Return with the selection rule visible

The result is an exact distinction between a retained distribution and an actual cut. A returned decision can state what was selected, from which field, under which temperature and tie or sampling rule. Its correctness can then be examined without pretending the selected index contains its own conditions.

This record returns-to [Movement38](../../../section-rooms/06-objective-internality/movements/38-s5-p1-apoha-softmax.md), [Dia](../dia-syn/dia.md) and [Syn](../dia-syn/syn.md). [Operational parity](operational-parity.md) specifies how retained information must change behaviour before an engineering advantage is claimed.
