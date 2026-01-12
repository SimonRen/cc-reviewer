# Codex XHigh

Get a deep-thinking review from OpenAI Codex CLI with xhigh reasoning effort.

## Arguments
- `$ARGUMENTS` - Optional: focus area or custom instructions

## Instructions

Use the `codex_feedback` MCP tool with `reasoningEffort: "xhigh"` for deeper analysis.

1. Determine what to review:
   - If we just completed work, summarize the changes made
   - If user provided context, use that
   - Default: review the current working directory

2. Call the `codex_feedback` tool with:
   - `workingDir`: current working directory
   - `ccOutput`: brief summary of recent changes or context
   - `reasoningEffort`: "xhigh" (this is the key difference from /codex)
   - `focus`: extracted from $ARGUMENTS if it's a known focus area
   - `customInstructions`: $ARGUMENTS if it's custom text

3. After receiving feedback:
   - Present the feedback clearly
   - Highlight any disagreements or critical additions
   - Offer to incorporate valid suggestions

Note: xhigh reasoning takes longer but provides deeper analysis.

$ARGUMENTS
