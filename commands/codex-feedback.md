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

3. After receiving feedback:
   - Present the feedback clearly
   - Highlight any disagreements or critical additions
   - Offer to incorporate valid suggestions

$ARGUMENTS
