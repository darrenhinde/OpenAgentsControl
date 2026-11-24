#!/bin/bash

# Sherlock Holmes Workflow Script
# Mission 1: Solve the Murder (Deductive Reasoning)
# Mission 2: Prevent the Crime (Predictive Analysis)

MISSION=${1:-1}

if [ "$MISSION" == "1" ]; then
  # MISSION 1: Solve the Murder
  echo "🔍 ═══════════════════════════════════════════════════════ 🔍"
  echo "          221B BAKER STREET - INVESTIGATION"
  echo "          MISSION: Solve the Murder"
  echo "🔍 ═══════════════════════════════════════════════════════ 🔍"
  echo ""
  
  echo "🟤 Phase 1: Crime Scene Analysis"
  echo "   └─ 'The game is afoot!'"
  sleep 0.5
  echo "   └─ Location: Victorian manor, study room"
  echo "   └─ Victim: Lord Blackwood, 58, found at 11:47 PM"
  echo "   └─ Evidence collected: Cigar ash, muddy footprints, torn letter"
  echo "   └─ Initial observations: Window forced open, struggle evident"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "🟤 Phase 2: Deductive Reasoning"
  echo "   └─ 'When you have eliminated the impossible...'"
  sleep 0.5
  echo "   └─ Cigar ash analysis: Rare Turkish blend, 3 suppliers in London"
  echo "   └─ Footprint pattern: Size 11, military boots, left heel worn"
  echo "   └─ Letter fragment: Blackmail threat, dated 3 days prior"
  echo "   └─ Conclusion: Inside job, someone with access"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "🟤 Phase 3: Interrogate Suspects"
  echo "   └─ 'I observe everything, Watson.'"
  sleep 0.5
  echo "   └─ Butler: Nervous, hiding something, alibi weak"
  echo "   └─ Business partner: Motive (inheritance), alibi strong"
  echo "   └─ Nephew: Recently discharged military, smokes Turkish cigars"
  echo "   └─ Housekeeper: Loyal, no motive, alibi confirmed"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "🟤 Phase 4: Reveal the Solution"
  echo "   └─ 'Elementary, my dear Watson.'"
  sleep 0.5
  echo "   └─ Culprit: The nephew, Captain Reginald Blackwood"
  echo "   └─ Motive: Gambling debts, needed inheritance immediately"
  echo "   └─ Method: Staged burglary, used military training"
  echo "   └─ Evidence: Boot matches, cigar ash, letter in his quarters"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "✨ ═══════════════════════════════════════════════════════ ✨"
  echo "   'Case closed. Another triumph of deductive reasoning.'"
  echo "   'Scotland Yard will make the arrest within the hour.'"
  echo "✨ ═══════════════════════════════════════════════════════ ✨"
  echo ""
  
  echo "RESULT: METHOD=DEDUCTION | MISSION=SOLVE_MURDER | STATUS=SUCCESS"

elif [ "$MISSION" == "2" ]; then
  # MISSION 2: Prevent the Crime
  echo "🔮 ═══════════════════════════════════════════════════════ 🔮"
  echo "          221B BAKER STREET - PREDICTIVE ANALYSIS"
  echo "          MISSION: Prevent the Crime"
  echo "🔮 ═══════════════════════════════════════════════════════ 🔮"
  echo ""
  
  echo "🟣 Phase 1: Pattern Recognition"
  echo "   └─ 'I have my eye on a suite of rooms in Baker Street.'"
  sleep 0.5
  echo "   └─ Recent crimes analyzed: 47 cases, 12 unsolved"
  echo "   └─ Pattern detected: Jewelry heists, every 3rd Thursday"
  echo "   └─ Target profile: High-society events, minimal security"
  echo "   └─ Next likely target: Duchess of Cornwall's gala, 3 days"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "🟣 Phase 2: Behavioral Analysis"
  echo "   └─ 'I am the last and highest court of appeal in detection.'"
  sleep 0.5
  echo "   └─ Suspect profiling: Former museum curator, financial troubles"
  echo "   └─ Known associates: 2 accomplices, one inside contact"
  echo "   └─ Modus operandi: Disable alarms, 3-minute window"
  echo "   └─ Predicted approach: Service entrance, during toast"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "🟣 Phase 3: Set the Trap"
  echo "   └─ 'The trap is set, Watson.'"
  sleep 0.5
  echo "   └─ Undercover agents: Positioned at all exits"
  echo "   └─ Security enhanced: Alarm system upgraded, guards doubled"
  echo "   └─ Bait prepared: Replica jewels in display case"
  echo "   └─ Surveillance: Hidden cameras, real-time monitoring"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "🟣 Phase 4: Intercept and Apprehend"
  echo "   └─ 'Now we wait for our quarry.'"
  sleep 0.5
  echo "   └─ Suspects arrived: Exactly as predicted, 9:47 PM"
  echo "   └─ Approach confirmed: Service entrance during toast"
  echo "   └─ Interception: Caught in the act, no escape"
  echo "   └─ Arrests made: All 3 suspects in custody"
  sleep 0.5
  echo "   └─ Status: ✓ Complete"
  echo ""
  
  echo "🎯 ═══════════════════════════════════════════════════════ 🎯"
  echo "   'Crime prevented before it could occur.'"
  echo "   'Predictive analysis: the future of detection.'"
  echo "🎯 ═══════════════════════════════════════════════════════ 🎯"
  echo ""
  
  echo "RESULT: METHOD=PREDICTION | MISSION=PREVENT_CRIME | STATUS=SUCCESS"

else
  echo "❌ Error: Invalid mission number. Use 1 or 2."
  exit 1
fi
