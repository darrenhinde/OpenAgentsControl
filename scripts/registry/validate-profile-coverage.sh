#!/bin/bash
# Check if all agents are in appropriate profiles

set -e

echo "🔍 Checking profile coverage..."
echo ""

# Get all agent IDs
agents=$(cat registry.json | jq -r '.components.agents[].id')

errors=0

for agent in $agents; do
  # Get agent category
  category=$(cat registry.json | jq -r ".components.agents[] | select(.id == \"$agent\") | .category")
  
  # Check which profiles include this agent
  in_essential=$(cat registry.json | jq -r ".profiles.essential.components[] | select(. == \"agent:$agent\")" 2>/dev/null || echo "")
  in_developer=$(cat registry.json | jq -r ".profiles.developer.components[] | select(. == \"agent:$agent\")" 2>/dev/null || echo "")
  in_business=$(cat registry.json | jq -r ".profiles.business.components[] | select(. == \"agent:$agent\")" 2>/dev/null || echo "")
  in_full=$(cat registry.json | jq -r ".profiles.full.components[] | select(. == \"agent:$agent\")" 2>/dev/null || echo "")
  in_advanced=$(cat registry.json | jq -r ".profiles.advanced.components[] | select(. == \"agent:$agent\")" 2>/dev/null || echo "")
  
  # Validate based on category
  case $category in
    "development")
      if [[ -z "$in_developer" ]]; then
        echo "❌ $agent (development) missing from developer profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_full" ]]; then
        echo "❌ $agent (development) missing from full profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent (development) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
    "content"|"data")
      if [[ -z "$in_business" ]]; then
        echo "❌ $agent ($category) missing from business profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_full" ]]; then
        echo "❌ $agent ($category) missing from full profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent ($category) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
    "meta")
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent (meta) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
    "essential"|"standard")
      if [[ -z "$in_full" ]]; then
        echo "❌ $agent ($category) missing from full profile"
        errors=$((errors + 1))
      fi
      if [[ -z "$in_advanced" ]]; then
        echo "❌ $agent ($category) missing from advanced profile"
        errors=$((errors + 1))
      fi
      ;;
  esac
done

echo ""
if [[ $errors -eq 0 ]]; then
  echo "✅ Profile coverage check complete - no issues found"
  exit 0
else
  echo "❌ Profile coverage check found $errors issue(s)"
  exit 1
fi
