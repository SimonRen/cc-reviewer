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

3. After receiving feedback from both:
   - Present both reviews clearly (Codex first, then Gemini)
   - Highlight where they agree or disagree
   - Synthesize the most valuable insights
   - Offer to incorporate valid suggestions

$ARGUMENTS
