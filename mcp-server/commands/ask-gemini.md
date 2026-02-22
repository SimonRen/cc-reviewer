# Ask Gemini

Ask Google Gemini CLI for help as a peer engineer.

## Arguments
- `$ARGUMENTS` - Your question or request

## Gemini Strengths
- **Architecture**: Design patterns, structure
- **Scalability**: Load handling, bottlenecks
- **Maintainability**: Code clarity, tech debt

## Tool Invocation

Call `ask_gemini` with:

```json
{
  "workingDir": "<current directory>",
  "prompt": "<your question or request from $ARGUMENTS>",
  "taskType": "<infer from request: plan|debug|explain|question|fix|explore|general>",
  "relevantFiles": ["<files related to the question>"],
  "context": "<any error messages or prior analysis>"
}
```

## After Receiving Response

1. **Read the answer** and key points
2. **Check file references** — verify they exist
3. **Evaluate suggested actions** — do they make sense?
4. **Apply your judgment** — you may disagree
5. **Act on the suggestions** or ask follow-up questions

$ARGUMENTS
