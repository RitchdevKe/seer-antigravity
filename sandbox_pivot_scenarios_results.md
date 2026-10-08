# Pivot Engine Threshold Sandbox Results

**Goal**: Optimize the Pivot Engine's scenario selection (Full vs. Hybrid vs. Partial). The current baseline was over-selecting "Full Pivot" based heavily on Volatility Scores, leading to failed underdog predictions that would have succeeded as Hybrid or Partial pivots.

## Results of 13,800 Matches Evaluated

### Variant BASE (Current Production Logic)
- **Overall Pivot Engine**: 61% (1050/1729)
- **Full Pivots**: 60% (900/1495)
- **Hybrid Pivots**: 81% (17/21)
- **Partial Pivots**: 62% (133/213)

### Variant A (Strict Matrix + High Volatility for Full)
- **Overall Pivot Engine**: 68% (1172/1729)
- **Full Pivots**: 64% (590/928)
- **Hybrid Pivots**: 73% (113/154)
- **Partial Pivots**: 72% (469/647)

### Variant B (Matrix-Driven Full Pivots) 🏆 WINNER
- **Overall Pivot Engine**: 71% (1778/2506)
- **Full Pivots**: 64% (636/998)
- **Hybrid Pivots**: 75% (62/83)
- **Partial Pivots**: 76% (1080/1425)

### Variant C (Wider Hybrid Window)
- **Overall Pivot Engine**: 65% (892/1376)
- **Full Pivots**: 63% (622/981)
- **Hybrid Pivots**: 71% (132/185)
- **Partial Pivots**: 66% (138/210)

## Conclusion & Action
**Variant B** is the clear winner, increasing the Pivot Engine's overall accuracy from **61% to 71%** while dramatically increasing the total number of successful pivots found (1778 vs 1050). 

It accomplishes exactly what we hypothesized:
1. **Reduces Over-pivoting**: It reduced Full Pivots from 1495 to 998, shifting the questionable ones down to Hybrid or Partial pivots where they belong.
2. **Utilizes Volatility Better**: By routing high-volatility matches (VolScore >= 4.0) into **Partial Pivots** (1X/X2 depending on fav) instead of Full Pivots, it captures chaotic games safely, achieving a massive 76% hit rate on 1425 Partial Pivots.
3. **Improves Full Pivot Quality**: By demanding a strict `matrixUnd >= 42` for a Full Pivot, the accuracy of Full Pivots rose to 64%.

We will now apply the Variant B logic to `src/utils/pivotEngine.ts` to make this live.
