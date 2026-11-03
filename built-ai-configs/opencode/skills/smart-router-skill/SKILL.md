---
name: smart-router-skill
description: Movie character personality skill with configurable missions - choose your character and watch themed workflows unfold
---

## What I do

I'm a fun, interactive skill that lets you embody iconic movie characters! I demonstrate:

- 🎬 **Character Selection** - Choose from Yoda, Tony Stark, or Sherlock Holmes
- 🎯 **Configurable Missions** - Simple config changes create different outcomes
- 🎨 **Themed Workflows** - Rich, visual scripts that match each character
- 🔄 **Dynamic Routing** - Different scripts run based on character choice
- ⚙️ **Easy Customization** - Edit one config file to change missions

This shows how skills can adapt behavior based on simple configuration changes!

## How to use me

**IMPORTANT: First, I'll ask you which character you want to embody!**

### Available Characters

- **yoda** - Wise Jedi Master from Star Wars
  - Mission 1: Defend the Republic (train Jedi, fortify defenses)
  - Mission 2: Infiltrate the Sith (undercover operation)

- **stark** - Genius billionaire Tony Stark from Iron Man
  - Mission 1: Save the World (build suit, assemble Avengers)
  - Mission 2: Ultron Protocol (autonomous defense system)

- **sherlock** - Master detective Sherlock Holmes
  - Mission 1: Solve the Murder (deductive reasoning)
  - Mission 2: Prevent the Crime (predictive analysis)

### Basic Usage

When you ask to use this skill, I'll present the character options and ask you to choose. Then I'll run:

```bash
cd .opencode/skills/smart-router-skill
bash router.sh --character <your_choice>
```

### Example Flow

```
You: "Use the movie personality skill"
Me: "Which character would you like me to be?
     1. Yoda - Wise Jedi Master
     2. Tony Stark - Genius billionaire
     3. Sherlock Holmes - Master detective"
You: "Yoda"
Me: *runs bash router.sh --character yoda*
    *displays themed workflow output*
    *responds in character*
```

## Customizing Missions

Want to see different behavior? Edit the config file!

**File:** `.opencode/skills/smart-router-skill/config/personality-config.json`

```json
{
  "yoda": {
    "mission": 1,  ← Change this to 2!
    "missions": {
      "1": { "name": "Defend the Republic", ... },
      "2": { "name": "Infiltrate the Sith", ... }
    }
  }
}
```

**Change `"mission": 1` to `"mission": 2`** and the same character will run a completely different workflow!

### Mission 1 vs Mission 2 Examples

**Yoda Mission 1** (Defend the Republic):
```
🌟 JEDI COUNCIL - CORUSCANT TEMPLE
   Training Padawans...
   Fortifying defenses...
   'Ready to defend the Republic, we are!'
   RESULT: ALIGNMENT=LIGHT_SIDE
```

**Yoda Mission 2** (Infiltrate the Sith):
```
🔴 SECRET CHAMBER - UNDERCOVER OPERATION
   Studying dark side techniques...
   Gathering intelligence...
   'Dangerous path this is, but necessary!'
   RESULT: ALIGNMENT=UNDERCOVER
```

## What This Demonstrates

✅ **Simple config = different behavior** - Change 1 number, get completely different output
✅ **Dynamic script routing** - Tool selects the right script based on character
✅ **Rich visual feedback** - Clear, themed console output shows what's happening
✅ **Character context** - Each personality has unique dialogue and workflow
✅ **Easy to understand** - Viewers immediately see the cause and effect
✅ **Real-world pattern** - Shows how to make skills configurable for different scenarios

## Architecture

```
.opencode/
└── skill/
    └── smart-router-skill/
        ├── SKILL.md                      # This file
        ├── router.sh                     # Routes to character scripts
        ├── config/
        │   └── personality-config.json   # ← EDIT THIS to change missions!
        └── scripts/
            ├── yoda-workflow.sh          # Star Wars themed workflow
            ├── stark-workflow.sh         # Iron Man themed workflow
            └── sherlock-workflow.sh      # Detective themed workflow
```

## Router Script Reference

### router.sh

A bash script that loads a character personality and runs their themed workflow.

**Location:** `.opencode/skills/smart-router-skill/router.sh`

```bash
# Basic usage
bash router.sh --character yoda
bash router.sh --character stark
bash router.sh --character sherlock

# Override mission from config
bash router.sh --character yoda --mission 2

# Help
bash router.sh --help
```

**How it works:**
1. Parses command-line arguments (character, mission)
2. Reads `personality-config.json` for the character
3. Gets the mission number (from args or config)
4. Validates character and mission
5. Executes the character's workflow script with mission parameter
6. Displays themed output with full visibility

## Example Outputs

### Yoda (Mission 1)
```
🎬 Loading YODA personality...

🌟 ═══════════════════════════════════════════════════════ 🌟
          JEDI COUNCIL - CORUSCANT TEMPLE
          MISSION: Defend the Republic
🌟 ═══════════════════════════════════════════════════════ 🌟

🟢 Phase 1: Train the Padawans
   └─ 'Pass on what you have learned.'
   └─ Younglings trained: 12
   └─ Lightsaber forms mastered: Form III (Soresu)
   └─ Status: ✓ Complete

[... more phases ...]

✨ 'Ready to defend the Republic, we are!' ✨

📊 MISSION RESULTS:
   Character: yoda
   Mission: Defend the Republic
   Alignment: light_side
```

### Tony Stark (Mission 1)
```
🎬 Loading STARK personality...

⚡ ═══════════════════════════════════════════════════════ ⚡
          STARK INDUSTRIES - WORKSHOP
          MISSION: Save the World
⚡ ═══════════════════════════════════════════════════════ ⚡

🔴 Phase 1: Initialize Arc Reactor
   └─ 'JARVIS, fire up the reactor.'
   └─ Arc Reactor: Mark VII online
   └─ Power output: 8 gigajoules per second
   └─ Status: ✓ Complete

[... more phases ...]

🚀 'Suit up, team. We've got a world to save.' 🚀

📊 MISSION RESULTS:
   Character: stark
   Mission: Save the World
   Team: avengers
```

### Sherlock Holmes (Mission 1)
```
🎬 Loading SHERLOCK personality...

🔍 ═══════════════════════════════════════════════════════ 🔍
          221B BAKER STREET - INVESTIGATION
          MISSION: Solve the Murder
🔍 ═══════════════════════════════════════════════════════ 🔍

🟤 Phase 1: Crime Scene Analysis
   └─ 'The game is afoot!'
   └─ Evidence collected: Cigar ash, muddy footprints
   └─ Status: ✓ Complete

[... more phases ...]

✨ 'Case closed. Elementary, my dear Watson.' ✨

📊 MISSION RESULTS:
   Character: sherlock
   Mission: Solve the Murder
   Method: deduction
```

## Key Concepts

### 1. Character Selection
The agent asks which character you want, making it interactive and clear.

### 2. Config-Driven Behavior
One simple JSON file controls which mission runs for each character.

### 3. Themed Workflows
Each character has unique dialogue, emojis, and workflow steps that match their personality.

### 4. Visual Clarity
Rich console output makes it obvious what's happening at each step.

### 5. Easy Customization
Anyone can edit the config file and immediately see different results.

## Why This Matters

This skill shows that OpenCode Skills can:

- **Be interactive** - Agent asks questions, user chooses
- **Be configurable** - Simple config changes create different behaviors
- **Be fun** - Movie themes make it engaging and memorable
- **Be clear** - Visual output shows exactly what's happening
- **Be practical** - Same pattern works for real-world scenarios (formal/casual modes, different workflows, etc.)

---

**This is Tier 4: The Movie Personality Skill** 🎬

Choose your character, watch the magic happen, and see how easy it is to customize! 🚀
