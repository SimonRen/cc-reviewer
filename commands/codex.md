# Codex Feedback

Get a second-opinion review from OpenAI Codex CLI on Claude Code's recent work.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions (e.g., "security", "Check for race conditions")

## Instructions

Use the `codex_feedback` MCP tool to get feedback from Codex CLI.

1. Determine what to review:
   - If we just completed work, summarize the changes made
   - If user provided context, use that
   - Default: review the current working directory

2. Call the `codex_feedback` tool with:
   - `workingDir`: current working directory
   - `ccOutput`: brief summary of recent changes or context
   - `focus`: extracted from $ARGUMENTS if it's a known focus area (security, performance, architecture, correctness, maintainability, scalability, testing, documentation)
   - `customInstructions`: $ARGUMENTS if it's custom text

3. After receiving feedback - VALIDATE before accepting:

   IMPORTANT: Do NOT blindly accept external feedback. You must:

   a. **Verify file references exist**
      - Check any mentioned file:line actually exists
      - Flag hallucinated paths immediately

   b. **Cross-check claims by reading code**
      - Read the actual files mentioned
      - Verify the issue described matches reality

   c. **Mark your confidence level for each finding:**
      - ✓✓ Verified (you checked the code yourself)
      - ✓ Likely (plausible but not verified)
      - ? Uncertain (needs more investigation)
      - ✗ Rejected (you disagree after checking)

   d. **Make YOUR recommendation**
      - Don't just relay their findings
      - Apply your own judgment
      - You may disagree with external feedback

4. Present synthesis:
   - Show validated findings with confidence levels
   - Highlight anything that looks like a hallucination
   - Offer to incorporate only verified/likely suggestions

$ARGUMENTS
