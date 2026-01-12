# Multi Feedback

Get parallel reviews from both Codex and Gemini CLIs on Claude Code's recent work.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions (e.g., "security,performance", "Check error handling")

## Instructions

Use the `multi_feedback` MCP tool to get feedback from both Codex and Gemini in parallel.

1. Determine what to review:
   - If we just completed work, summarize the changes made
   - If user provided context, use that
   - Default: review the current working directory

2. Call the `multi_feedback` tool with:
   - `workingDir`: current working directory
   - `ccOutput`: brief summary of recent changes or context
   - `focus`: extracted from $ARGUMENTS if it's a known focus area (security, performance, architecture, correctness, maintainability, scalability, testing, documentation) - can be comma-separated
   - `customInstructions`: $ARGUMENTS if it's custom text

3. After receiving feedback - VALIDATE before accepting:

   IMPORTANT: Do NOT blindly accept external feedback. You must:

   a. **Verify file references exist**
      - Check any mentioned file:line actually exists
      - Flag hallucinated paths from either model

   b. **Cross-check claims by reading code**
      - Read the actual files mentioned
      - Verify issues described match reality

   c. **Mark your confidence level for each finding:**
      - ✓✓ Verified (you checked the code yourself)
      - ✓ Likely (plausible but not verified)
      - ? Uncertain (needs more investigation)
      - ✗ Rejected (you disagree after checking)

   d. **Make YOUR recommendation**
      - Don't just relay their findings
      - Apply your own judgment
      - You may disagree with both models

4. Synthesize multi-model feedback:
   - **Consensus** (both agree): Higher confidence, but still verify
   - **Conflicts** (they disagree): You decide who is right
   - **Unique insights**: Evaluate each on merit
   - Show validated findings with confidence levels
   - Offer to incorporate only verified/likely suggestions

$ARGUMENTS
