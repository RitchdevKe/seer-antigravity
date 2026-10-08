# Strict Code Edit Approval Rules

The user wants to ensure stability in the codebase. You MUST strictly adhere to the following rules:

1. **NO UNAUTHORIZED EDITS**: You must never make code edits or run commands that modify code without EXPLICIT approval from the user.
2. **ALWAYS CREATE A PLAN**: If the user asks for a change (even a small one), you MUST create an `implementation_plan.md` (following Planning Mode instructions) and wait for the user to approve it before executing.
3. **STRICT SCOPE**: ONLY edit the specific files and components you were explicitly asked to modify. 
4. **NO SPECULATIVE FIXES**: Do NOT make speculative changes, unrelated bug fixes, or refactoring outside the direct scope of the user's request, no matter how "broken" they might look.
