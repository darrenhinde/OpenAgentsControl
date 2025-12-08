<!-- 
  OpenAgent Prompt Template
  
  Copy this file to create a new model-specific prompt.
  Name it by model family: gpt.md, gemini.md, grok.md, llama.md, etc.
  
  Examples:
  - gpt.md (OpenAI GPT family)
  - gemini.md (Google Gemini family)
  - grok.md (xAI Grok family)
  - llama.md (Meta Llama family)
  - claude-opus.md (Claude Opus specifically, if different from default)
-->

---
# Prompt Metadata (YAML frontmatter - optional but recommended)
model_family: "model-name"           # e.g., "gpt", "gemini", "grok", "llama"
recommended_models:
  - "provider/model-id"              # e.g., "openai/gpt-4o" (primary recommendation)
  - "provider/model-id-variant"      # e.g., "openai/gpt-4o-mini" (alternative)
tested_with: "provider/model-id"     # Model used for testing
last_tested: "YYYY-MM-DD"            # Date of last test
maintainer: "your-name"              # Your name/handle
---

## Prompt Info
- **Model Family**: [e.g., GPT, Gemini, Grok, Llama]
- **Target Models**: [List specific model IDs this is optimized for]
- **Status**: [🚧 Needs Testing | ✅ Tested | ⚠️ Experimental]
- **Maintainer**: [Your name/handle]
- **Last Updated**: [YYYY-MM-DD]

## Optimizations for This Model
<!-- Document model-specific optimizations -->
- Optimization 1: [What you changed and why it helps this model]
- Optimization 2: [Description]

**Example:**
- Reduced verbosity for faster models (Grok, GPT-4o-mini)
- Added more explicit instructions for reasoning models (o1, Claude Opus)
- Simplified structure for smaller context windows

## Expected Strengths
<!-- What should this model/prompt combination do well? -->
- [ ] Fast execution
- [ ] Strong reasoning
- [ ] Good context handling
- [ ] Reliable delegation
- [ ] Other: [describe]

## Test Results
<!-- Run: ./scripts/prompts/test-prompt.sh openagent your-variant -->
<!-- Paste results here -->

```
Not tested yet
```

## Known Issues
<!-- Document any problems or limitations -->
- Issue 1: [Description]
- Issue 2: [Description]

---

<!-- START OF PROMPT -->
<!-- Everything below this line is the actual agent prompt -->

# Your Prompt Here

[Your agent prompt content]

<!-- END OF PROMPT -->
