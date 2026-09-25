---
title: "Preference Gauge and Reference Policy"
record_id: matheme-preference-gauge
record_type: matheme
register: matheme
claim_status: Derived
source_relation: "Exact technical construction; argued native relation and offered experimental application"
---

# Preference Gauge and Reference Policy

## #0 — State the comparison model

For a fixed context `x`, let `r_i,r_j` be real scores for two alternatives. The logistic paired-comparison model is `P(i≻j|x)=σ(r_i−r_j)`, where `σ(t)=1/(1+e^(−t))`. The [DPO source house](../../episteme/sources/computer-science-ml/rafailov/rafailov-et-al-2023-dpo/rafailov-et-al-2023-dpo.md) gives this exact formulation and its reference-policy reparameterisation. The [Bradley–Terry house](../../episteme/sources/mathematics-logic/bradley/bradley-terry-1952-paired-comparisons/bradley-terry-1952-paired-comparisons.md) retains the original model's distinct source identity and pending passage locator.

## #1 — Prove the additive freedom

Replace every score by `r_i+c(x)`. Then `(r_i+c)−(r_j+c)=r_i−r_j`, so every pairwise probability is unchanged. The comparison data consequently cannot identify a common score origin from these differences alone. For a disconnected comparison graph, each disconnected component can have its own undetermined shift; sufficient connection is needed for a single shared origin constraint.

A chosen constraint, such as fixing one score or setting the mean to zero, picks a representation. That numerical gauge choice is distinct from choosing evaluators, alternatives or a reference policy, which can change the comparisons themselves.

## #2 — Work a concrete pair

Take scores `(0,ln3)`. The probability that the second beats the first is `σ(ln3)=3/4`. Shift both by −20 and the probability remains 3/4. Swap their order and it becomes 1/4. Multiplying both scores by 2 changes the difference to `ln9`, giving 9/10: scale is not the additive invariance unless another parameter compensates it.

The formal result concerns an unidentifiable common level. It does not establish that the level is an invisible political governor or that every choice of origin is a normative defect. Those are different empirical and institutional questions.

## #3 — Derive the DPO cancellation

For a finite completion set, positive reference probabilities on the relevant support, and `β>0`, the KL-regularised optimum has the form

`π*(y|x)=π_ref(y|x) exp(r(x,y)/β)/Z(x)`.

Rearrange:

`r(x,y)=β log[π*(y|x)/π_ref(y|x)]+β log Z(x)`.

Subtract the expressions for two completions. The shared `β log Z(x)` cancels, leaving the difference of two policy log-ratios. Substituting into the logistic model gives the DPO preference expression. A learned `π_θ` supplies the trainable version; the loss is the negative log probability assigned to the preferred ordering, averaged over the declared dataset.

## #4 — Keep the reference policy operational

With `β=1`, reference `(1/2,1/2)` and optimal policy `(3/4,1/4)`, the two log-ratios differ by `ln3`, yielding preference probability 3/4. If the reference is instead `(3/4,1/4)` while the candidate policy stays the same, both log-ratios are 0, yielding 1/2. Changing the reference policy therefore differs from merely shifting every reward by a common constant.

The source records that the reference can be chosen or estimated when the generating supervised policy is unavailable. Its provenance matters operationally. Population, preference labels, model support and regularisation also matter; the algebra cannot determine them from the observed pair alone.

## #5→0 — Return the judgment through its comparisons

The result gives the essay's hidden-zero argument a bounded exact carrier: differences can be fully legible while a shared numerical origin remains unidentified. The [core's](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) broader accounting asks whether the conditions of comparison are declared and revisable. Numerical invariance and governance interpretation keep their distinct standing.

This record returns-to [Movement40](../../../section-rooms/06-objective-internality/movements/40-s5-p3-preference-hidden-zero.md), [softmax](softmax-argmax.md), and [operational parity](operational-parity.md). A technical gauge experiment must distinguish harmless reparameterisation from a changed policy or evaluative field.
