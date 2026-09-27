---
record_id: matheme-torus-cover-winding
title: "Torus, covering, winding and retained displacement"
record_type: matheme
register: matheme
claim_status: Derived
source_relation: Argued from
source_ids: [taylor-2026-core-theorems-pithy, hatcher-2002-algebraic-topology, taylor-2026-binary-explication]
---
# Torus, covering, winding and retained displacement

## #0

A return on the torus can retain a displacement on its covering plane. The relation begins with an explicit identification. For points of the plane, put

\[
(x,y)\sim(x+m,y+n),\qquad(m,n)\in\mathbb Z^2,
\]

and define \(T^2=\mathbb R^2/\mathbb Z^2\), with projection \(\pi(x,y)=[x,y]\). Brackets mean the entire equivalence class of integer translates. Thus \([1/4,1/3]=[9/4,-2/3]\), although the two displayed plane points differ by \((2,-1)\). Identification changes what counts as one address; it preserves a relation between distinct representatives.

The [native core, VIII](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) gives this quotient the office of a topological expression of `0/1`: distinction determines a surface within the plane's indefinite availability. The slash here acts by equivalence classes. The mathematical operation is Derived; its articulation of the native ground–mark relation is Argued from the core, whose [source house](../../episteme/sources/internal-corpus/taylor/taylor-2026-core-theorems-pithy/taylor-2026-core-theorems-pithy.md) retains its provenance. [A13](../../../section-rooms/arguments/A13-Two-Logics-of-Two-Dia-Syn.md) receives the distinction-with-relation; [A16](../../../section-rooms/arguments/A16-Arche-Topos-as-Differential-Field.md) receives the field in which an address and its paths become possible.

## #1

Take the unit square. Identify its left and right sides by equal height, and its bottom and top sides by equal horizontal coordinate. These identifications give every equivalence class a representative in the square. They also identify all four corners with each other. The resulting cell structure has one vertex, two edge classes and one face:

\[
\chi(T^2)=V-E+F=1-2+1=0.
\]

The square supplies **four boundary sides before gluing**. Its boundary word is \(aba^{-1}b^{-1}\): each of two edge directions occurs forward and backward. The quotient has **two independent generating loops**, represented by \(a(t)=[t,0]\) and \(b(t)=[0,t]\), for \(0\le t\le1\). These counts provide the native `4+2` relation: four explicate sides, assigned #1–#4 in core VIII, and two implicate generators, assigned #0 and #5. They count different structural offices; their sum is the native sixfold correspondence, while the Euler calculation uses the quotient cells. The four sides do not become four quotient vertices, and the two generators remain independent even though both loops begin and end at the single vertex.

This is the exact contribution to [A18's eight-determination field](../../../section-rooms/arguments/A18-Primordial-Symbolon-and-Its-Eight-Determinations.md). The polygon and its generators articulate the sixfold within that field; they do not replace the full sequence from `/ = −/−` through `0/1`, `?/!`, `−/+`, `X/x`, `AM/IS`, `∞/dx` and `1/0`. The torus is compact because the compact square maps onto it. Compactness makes the whole bounded in this topological sense while leaving a continuum of points available for travel.

## #2

The projection has infinitely many sheets. Over any point \([x,y]\), its fibre is

\[
\pi^{-1}([x,y])=\{(x+m,y+n):(m,n)\in\mathbb Z^2\}.
\]

A sufficiently small open disk in the plane—radius less than \(1/2\) suffices—has disjoint integer translates. The projection maps each translated disk homeomorphically onto the same neighbourhood on the torus. These disks exhibit the covering property: an entire family of local copies lies over one local address. Since the plane is simply connected, this is the universal cover.

The quotient inherits a flat metric locally. A familiar embedded doughnut in three-dimensional space depicts its topology but has a different induced geometry. The neighbourhood argument concerns the flat quotient itself. It establishes why a local coordinate patch can be accurate without carrying the entire global identification.

[Hatcher's source house](../../episteme/sources/mathematics-logic/hatcher/hatcher-2002-algebraic-topology/hatcher-2002-algebraic-topology.md) supplies the standard reference for quotient, covering and fundamental-group theory. Its precise passage collation remains Open; the maps and calculations here state the mathematical warrant directly and make no external quotation. The two generators above count independent directions of winding. The number of sheets counts points in a fibre. The native trust revision's orientable double-cover relation belongs to a separate map, from the torus to the Klein bottle. Keeping those maps distinct preserves the inversion-capacity demanded by [A23](../../../section-rooms/arguments/A23-Trust-Faith-and-the-Formal-Limit.md) without assigning two sheets to \(\mathbb R^2\to T^2\).

## #3

Fix a loop \(\gamma\) based at \([0,0]\), and start its unique lift \(\widetilde\gamma\) at \((0,0)\). Closure downstairs requires

\[
\pi(\widetilde\gamma(1))=[0,0],\qquad
\widetilde\gamma(1)=(m,n)\in\mathbb Z^2.
\]

The integer pair is its winding. For example, \(\gamma(t)=[2t,-t]\) returns at \(t=1\), while its lift ends at \((2,-1)\). It goes twice in the first generating direction and once backward in the second. A lift begun at another lattice representative has both endpoints translated equally, so the displacement remains \((2,-1)\).

Under a based homotopy, the lifted endpoint varies continuously in a discrete lattice and therefore stays fixed. Conversely, if two based loops have the same lifted endpoint, straight-line interpolation between their lifted paths gives a homotopy fixing both endpoints; projection gives a based homotopy of the loops. Winding consequently classifies these loops up to based homotopy. Concatenation adds displacements: following winding \((2,-1)\) by \((-1,3)\) gives \((1,2)\). Hence

\[
\pi_1(T^2,[0,0])\cong\mathbb Z\times\mathbb Z.
\]

In particular, \((1,0)\) and \((0,1)\) are independent and commute. A loop contracts precisely when its winding is \((0,0)\); its closed lift contracts in the plane. Retained displacement has this exact scope. The lifted path records a traversal once a starting lift is chosen, while its endpoint records only the homotopy class. Many differently shaped and differently timed paths have the same winding. [A17](../../../section-rooms/arguments/A17-Toroidal-Circulation-and-the-Arche-Topos.md) receives a rigorous coexistence of local closure and global difference. [A21](../../../section-rooms/arguments/A21-Individuation-Recognition.md) draws an Argued relation to recognition through a definite way of travelling, with no reduction of a person to an integer pair.

## #4

A linear flow, with real time \(t\in\mathbb R\), makes the alternatives of recurrence explicit:

\[
\phi_t([x_0,y_0])=[x_0+ut,y_0+vt].
\]

For nonzero velocity, it is periodic exactly when some \(T>0\) makes both \(Tu\) and \(Tv\) integers. With \(u=1\) and \(v=p/q\), where \(p,q\) are coprime integers and \(q>0\), the least positive period is \(q\), with winding \((q,p)\). Velocity \((1,2/3)\) thus returns after three time units with winding \((3,2)\). A vertical flow has its corresponding vertical period; slope notation alone would omit that case.

For velocity \((1,\sqrt2)\), a period would require \(T=k\) and \(k\sqrt2=l\) for integers \(k>0,l\), which is impossible. Its orbit is dense. To see the density mechanism, inspect each crossing of a chosen horizontal coordinate: the heights differ successively by the irrational rotation \(\sqrt2\) modulo one. Integer multiples of an irrational number are dense modulo one. Their closure is an infinite closed subgroup of the circle; a proper closed subgroup is finite, since a least positive gap generates it, whereas arbitrarily small gaps give density. The same conclusion holds on every vertical cross-section, so the continuous orbit approaches every torus point arbitrarily closely. Density does not mean that it passes through every point.

The rational/irrational distinction is a claim about these linear flows, with their stated velocities. It supplies [A15](../../../section-rooms/arguments/A15-Ratio-Rationality-Measure-Reckoning-Harmony-Account.md) with an exact relation between commensurable rates and common period. In [movement 29](../../../section-rooms/04-mathematical-substrate/movements/29-s3-p4-topology-music-resolution.md), cadence and ongoing traversal share one field without sharing one return-time. [Movement 45](../../../section-rooms/07-instrument-returns/movements/45-s50-p2-antikythera-attunement.md) can carry their coordination into the Offered image of an attunement instrument; a winding calculation alone establishes neither a historical gear train nor its meaning.

## #5→0

The quotient has now become a field of possible paths. Its infinite cover, compact surface and zero Euler characteristic give the native `∞/0` relation its precise carrier: identification gives an address while infinitely many representatives remain available. Zero here names \(\chi(T^2)\); infinity names the cover and each fibre's multiplicity. The quotient slash joins them through a construction. No arithmetic division or cancellation is involved.

The [Matheme register's Two Locks](../README.md) preserve the wider operation opened by this carrier. Definition and Quilt retain `0/1 = 4+2 = 5→0 = 0/1`; Process and Music retain `0/1 = 4+2 = 5→0 = 1/0 = 4′+2′ = 5′→0′ = 0/1`. The [Binary Explication house](../../episteme/sources/internal-corpus/taylor/taylor-2026-binary-explication/taylor-2026-binary-explication.md) holds those distinct records. A torus-loop does not by itself traverse every term of either chain: its specified lift makes one relation within them exact, namely return carrying a difference that remains accountable. File 2's inverse-phase primes and File 3's Night sequence retain their respective offices.

[Movement 28](../../../section-rooms/04-mathematical-substrate/movements/28-s3-p3-projective-dimensional-reframing.md) supplies the inherited demand to specify a change of space. The quotient and cover fulfil it here; [movement 30](../../../section-rooms/04-mathematical-substrate/movements/30-s3-p5-arche-topos.md) gathers their contribution to the arche-topos. [A36](../../../section-rooms/arguments/A36-Advent-of-Integral-Zero.md) receives a zero-characteristic surface whose return retains differentiated paths. That contribution leaves the next traversal open: an arrival at the same address can carry a new integer displacement, and the covering plane remains available for another lift.
