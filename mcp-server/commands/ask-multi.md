# Ask Multi

Ask both Codex and Gemini for help in parallel — get multiple perspectives.

## Arguments
- `$ARGUMENTS` - Your question or request

## When to Use

Use `/ask-multi` when you want perspectives from both models on the same question.

## Tool Invocation

Call `ask_multi` with:

```json
{
  "workingDir": "<current directory>",
  "prompt": "<your question or request from $ARGUMENTS>",
  "taskType": "<infer from request: plan|debug|explain|question|fix|explore|general>",
  "relevantFiles": ["<files related to the question>"],
  "context": "<any error messages or prior analysis>"
}
```

## After Receiving Responses

You will receive separate responses from each model.

### Synthesize

1. **Find agreements** — both models say the same thing (higher confidence)
2. **Identify conflicts** — they disagree (YOU decide who's right)
3. **Note unique insights** — findings only one model provided
4. **Verify file references** — check they exist
5. **Make YOUR recommendation** — don't just relay, apply judgment

$ARGUMENTS
