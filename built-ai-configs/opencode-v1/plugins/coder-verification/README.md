# CoderAgent Assistant Plugin

Simple plugin that helps CoderAgent by showing toast notifications and reminders.

## Features

- Shows toast when CoderAgent starts
- Validates output after CoderAgent completes
- Shows success/warning toasts based on checks
- Session summary at end

## How It Works

1. **Before CoderAgent**: Shows monitoring toast
2. **After CoderAgent**: Checks for Self-Review and Deliverables
3. **Session End**: Shows completion toast

## Installation

Already installed at `.opencode/plugins/coder-verification/`

Restart OpenCode to load.

## Toast Notifications

### When CoderAgent Starts
```
🤖 CoderAgent Assistant
Monitoring CoderAgent work - checks will be validated
```

### When All Checks Pass
```
✅ CoderAgent Checks Passed
All validation checks completed successfully
```

### When Checks Need Attention
```
⚠️ CoderAgent Validation
Some checks need attention - see console
```

## License

MIT
