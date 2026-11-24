<!-- Context: openagents-repo/examples | Priority: high | Version: 1.0 | Updated: 2026-02-15 -->

# Markdown Formatter Hook

**Purpose**: Auto-fix markdown formatting issues after file edits

---

## Configuration

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/markdown_formatter.py"
      }]
    }]
  }
}
```

---

## Python Script

```python
#!/usr/bin/env python3
import json, sys, re, os

def detect_language(code):
    s = code.strip()
    if re.search(r'^\s*[{\[]', s):
        try:
            json.loads(s)
            return 'json'
        except: pass
    if re.search(r'^\s*def\s+\w+\s*\(', s, re.M):
        return 'python'
    if re.search(r'\b(function\s+\w+|const\s+\w+\s*=)', s):
        return 'javascript'
    if re.search(r'\b(SELECT|INSERT|UPDATE)\s+', s, re.I):
        return 'sql'
    return 'text'

def format_markdown(content):
    def add_lang(match):
        indent, info, body, closing = match.groups()
        if not info.strip():
            return f"{indent}```{detect_language(body)}\n{body}{closing}\n"
        return match.group(0)
    
    pattern = r'(?ms)^([ \t]{0,3})```([^\n]*)\n(.*?)(\n\1```)\s*$'
    content = re.sub(pattern, add_lang, content)
    return re.sub(r'\n{3,}', '\n\n', content).rstrip() + '\n'

# Main
data = json.load(sys.stdin)
path = data.get('tool_input', {}).get('file_path', '')
if path.endswith(('.md', '.mdx')) and os.path.exists(path):
    with open(path, 'r') as f:
        content = f.read()
    formatted = format_markdown(content)
    if formatted != content:
        with open(path, 'w') as f:
            f.write(formatted)
        print(f"✓ Fixed formatting in {path}")
```

---

## What It Fixes

- Unlabeled code blocks → detects language
- Excessive blank lines → max 2 consecutive
- Trailing whitespace

---

## Related

- `../../lookup/hook-events.md` - Hook events
- `./formatting-hook.md` - Code formatting

**Reference**: https://docs.anthropic.com/en/docs/claude-code/hooks
