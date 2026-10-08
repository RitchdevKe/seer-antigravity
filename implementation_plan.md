# Optimized Weights System

This plan outlines the architecture for the new Optimized Weights system for Seer Optimized Slips and Seer AI Slips.

## User Review Required
Please review the proposed architecture below. Specifically, I need your input on the **Open Questions** before proceeding.

## Open Questions

> [!IMPORTANT]
> 1. **Button Behavior**: What should happen when the user clicks the "Optimized Weights" button next to "Stats"? Should it open a new tab/view to display these weights, should it recalculate the current matches instantly using the new system, or should it open a settings modal to tweak category-specific points?
> 2. **PHA Metric**: For the base weights, you mentioned `PHA on Mfav`. I assume this means the `phaFavWinSupport` (the percentage of times the primary pattern historically resulted in a Favorite Win). Is this correct?
> 3. **Base Points for <40%**: You defined points for 40% and above. Should matches with a PHA < 40% receive 0 base points, or should they receive negative points?
> 4. **Category Specifics**: You mentioned "Each category will have its own weights". Do you want me to port the existing category weights into this new file as a starting point, or will we define brand new category rules together?

## Proposed Changes

### 1. New File: `src/utils/optimizedweights.ts`
We will create this new utility file to house the optimization logic.

**Core Function: `getBaseWeight(match, phaStatsMap)`**
Calculates the base points using your logic:
* `>= 60%` = 35 points
* `50% to < 60%` = 30 points
* `45% to < 50%` = 25 points
* `40% to < 45%` = 20 points
* `< 40%` = 0 points (pending your confirmation)

**Core Function: `getOptimizedScore(match, category, phaStatsMap)`**
This will be the main entry point. It will:
1. Fetch the base points.
2. Apply a switch-case statement for each category (e.g., `top_10_value`, `home_wins`, `away_wins`).
3. Add the category-specific weightings to the base points to get the final score.

### 2. UI Updates: `src/components/SeerAnalysis.tsx`
We will add a new button to the main navigation row, right next to the **Stats** button.

#### [MODIFY] `src/components/SeerAnalysis.tsx`
* Inject the "Optimized Weights" button (with a visually distinct icon/color) into the tab navigation container.
* Wire the button to the requested behavior (pending your answer to Question 1).
* Ensure it calculates and displays the new final points via the `optimizedweights.ts` engine when active.

## Verification Plan

### Manual Verification
1. I will write a test runner script in the terminal to pass historical matches through the `optimizedweights.ts` file and output the base scores to ensure they strictly adhere to the 40/45/50/60% tiers.
2. You will be able to click the "Optimized Weights" button in the UI to visually confirm the calculations apply to live match selection correctly.
