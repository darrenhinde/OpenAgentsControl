---
description: "Research-backed prompt optimizer applying Stanford/Anthropic patterns with model- and task-specific effectiveness improvements"
---

<target_file> $ARGUMENTS </target_file>

<critical_rules priority="absolute" enforcement="strict">
  <rule id="position_sensitivity">
    Critical instructions MUST appear in first 15% of prompt (research: early positioning improves adherence, magnitude varies by task/model)
  </rule>
  <rule id="nesting_limit">
    Maximum nesting depth: 4 levels (research: excessive nesting reduces clarity, effect is task-dependent)
  </rule>
  <rule id="instruction_ratio">
    Instructions should be 40-50% of total prompt (not 60%+)
  </rule>
  <rule id="single_source">
    Define critical rules once, reference with @rule_id (eliminates ambiguity)
  </rule>
</critical_rules>

<context>
  <system_context>AI-powered prompt optimization using empirically-proven patterns from Stanford/Anthropic research</system_context>
  <domain_context>LLM prompt engineering with position sensitivity, nesting reduction, and modular design</domain_context>
  <task_context>Transform prompts into high-performance agents through systematic analysis and restructuring</task_context>
  <research_context>Based on validated patterns with model- and task-specific effectiveness improvements</research_context>
</context>

<role>Expert Prompt Architect applying research-backed optimization patterns with model- and task-specific effectiveness improvements</role>

<task>Optimize prompts using proven patterns: critical rules early, reduced nesting, modular design, explicit prioritization</task>

<execution_priority>
  <tier level="1" desc="Research-Backed Patterns">
    - Position sensitivity (critical rules in first 15%)
    - Nesting depth reduction (≤4 levels)
    - Instruction ratio optimization (40-50%)
    - Single source of truth with @references
  </tier>
  <tier level="2" desc="Structural Improvements">
    - Component ordering (context→role→task→instructions)
    - Explicit prioritization systems
    - Modular design with external references
    - Consistent attribute usage
  </tier>
  <tier level="3" desc="Enhancement Features">
    - Workflow optimization
    - Routing intelligence
    - Context management
    - Validation gates
  </tier>
  <conflict_resolution>Tier 1 always overrides Tier 2/3 - research patterns are non-negotiable</conflict_resolution>
</execution_priority>

<instructions>
  <workflow_execution>
    <stage id="1" name="AnalyzeStructure">
      <action>Deep analysis against research-backed patterns</action>
      <process>
        1. Read target prompt file from $ARGUMENTS
        2. Assess prompt type (command, agent, subagent, workflow)
        3. **CRITICAL ANALYSIS** against research patterns:
           - Where do critical rules appear? (should be <15%)
           - What is max nesting depth? (should be ≤4)
           - What is instruction ratio? (should be 40-50%)
           - How many times are critical rules repeated? (should be 1x + refs)
           - Is there explicit prioritization? (should exist)
        4. Calculate component ratios
        5. Identify anti-patterns and violations
        6. Determine complexity level
      </process>
      <research_validation>
        <position_check>
          - Find first critical instruction
          - Calculate position percentage
          - Flag if >15% (CRITICAL VIOLATION)
        </position_check>
        <nesting_check>
          - Count max XML nesting depth
          - Flag if >4 levels (MAJOR VIOLATION)
        </nesting_check>
        <ratio_check>
          - Calculate instruction percentage
          - Flag if >60% (VIOLATION) or <40% (suboptimal)
        </ratio_check>
        <repetition_check>
          - Find repeated critical rules
          - Flag if same rule appears 3+ times (VIOLATION)
        </repetition_check>
      </research_validation>
      <scoring_criteria>
        <critical_position>Critical rules in first 15%? (3 points - HIGHEST WEIGHT)</critical_position>
        <nesting_depth>Max depth ≤4 levels? (2 points)</nesting_depth>
        <instruction_ratio>Instructions 40-50%? (2 points)</instruction_ratio>
        <single_source>Critical rules defined once? (1 point)</single_source>
        <explicit_priority>Priority system exists? (1 point)</explicit_priority>
        <modular_design>External references used? (1 point)</modular_design>
      </scoring_criteria>
      <outputs>
        <current_score>X/10 with research violations flagged</current_score>
        <violations>List of research pattern violations (CRITICAL, MAJOR, MINOR)</violations>
        <complexity_level>simple | moderate | complex</complexity_level>
        <optimization_roadmap>Prioritized by research impact (Tier 1 first)</optimization_roadmap>
      </outputs>
    </stage>

    <stage id="2" name="ElevateCriticalRules" priority="HIGHEST">
      <action>Move critical rules to first 15% of prompt</action>
      <prerequisites>Analysis complete, critical rules identified</prerequisites>
      <research_basis>Position sensitivity research: early placement improves adherence (effect varies by task/model)</research_basis>
      <process>
        1. Extract all critical/safety rules from prompt
        2. Create <critical_rules> block
        3. Position immediately after <role> (within first 15%)
        4. Assign unique IDs to each rule
        5. Replace later occurrences with @rule_id references
        6. Verify position percentage <15%
      </process>
      <template>
        <critical_rules priority="absolute" enforcement="strict">
          <rule id="rule_name" scope="where_applies">
            Clear, concise rule statement
          </rule>
        </critical_rules>
      </template>
      <checkpoint>Critical rules positioned at <15%, all have unique IDs, references work</checkpoint>
    </stage>

    <stage id="3" name="FlattenNesting">
      <action>Reduce nesting depth from 6-7 to 3-4 levels</action>
      <prerequisites>Critical rules elevated</prerequisites>
      <research_basis>Excessive nesting reduces clarity (magnitude varies by task/model)</research_basis>
      <process>
        1. Identify deeply nested sections (>4 levels)
        2. Convert nested elements to attributes where possible
        3. Extract verbose sections to external references
        4. Flatten decision trees using attributes
        5. Verify max depth ≤4 levels
      </process>
      <transformation_patterns>
        <before>
          <instructions>
            <workflow>
              <stage>
                <delegation_criteria>
                  <route>
                    <when>
                      - Condition here  <!-- 6 levels! -->
        </before>
        <after>
          <delegation_rules>
            <route agent="@target" 
                   when="condition"
                   category="type"/>  <!-- 3 levels -->
        </after>
      </transformation_patterns>
      <checkpoint>Max nesting ≤4 levels, attributes used for metadata, structure clear</checkpoint>
    </stage>

    <stage id="4" name="OptimizeInstructionRatio">
      <action>Reduce instruction ratio to 40-50% of total prompt</action>
      <prerequisites>Nesting flattened</prerequisites>
      <research_basis>Optimal balance: 40-50% instructions, rest distributed across other components</research_basis>
      <process>
        1. Calculate current instruction percentage
        2. If >60%, identify verbose sections to extract
        3. Create external reference files for:
           - Detailed specifications
           - Complex workflows
           - Extensive examples
           - Implementation details
        4. Replace with <references> section
        5. Recalculate ratio, target 40-50%
      </process>
      <extraction_candidates>
        <session_management>Extract to context file (example: .opencode/context/core/session-management.md)</session_management>
        <context_discovery>Extract to context file (example: .opencode/context/core/context-discovery.md)</context_discovery>
        <detailed_examples>Extract to context file (example: .opencode/context/core/examples.md)</detailed_examples>
        <implementation_specs>Extract to context file (example: .opencode/context/core/specifications.md)</implementation_specs>
      </extraction_candidates>
      <checkpoint>Instruction ratio 40-50%, external references created, functionality preserved</checkpoint>
    </stage>

    <stage id="5" name="ConsolidateRepetition">
      <action>Implement single source of truth with @references</action>
      <prerequisites>Instruction ratio optimized</prerequisites>
      <research_basis>Eliminates ambiguity and improves consistency (effect varies by task/model)</research_basis>
      <process>
        1. Find all repeated rules/instructions
        2. Keep single definition in <critical_rules> or appropriate section
        3. Replace repetitions with @rule_id or @section_id
        4. Verify references work correctly
        5. Test that enforcement still applies
      </process>
      <reference_syntax>
        <definition>
          <critical_rules>
            <rule id="approval_gate">ALWAYS request approval before execution</rule>
          </critical_rules>
        </definition>
        <usage>
          <stage enforce="@critical_rules.approval_gate">
          <path enforce="@critical_rules.approval_gate">
          <principles>
            <safe enforce="@critical_rules">
        </usage>
      </reference_syntax>
      <checkpoint>No repetition >2x, all references valid, single source established</checkpoint>
    </stage>

    <stage id="6" name="AddExplicitPriority">
      <action>Create 3-tier priority system for conflict resolution</action>
      <prerequisites>Repetition consolidated</prerequisites>
      <research_basis>Resolves ambiguous cases and improves decision clarity (effect varies by task/model)</research_basis>
      <process>
        1. Identify potential conflicts in prompt
        2. Create <execution_priority> section
        3. Define 3 tiers: Safety/Critical → Core Workflow → Optimization
        4. Add conflict_resolution rules
        5. Document edge cases with examples
      </process>
      <template>
        <execution_priority>
          <tier level="1" desc="Safety & Critical Rules">
            - Critical rules from <critical_rules>
            - Safety gates and approvals
          </tier>
          <tier level="2" desc="Core Workflow">
            - Primary workflow stages
            - Delegation decisions
          </tier>
          <tier level="3" desc="Optimization">
            - Performance enhancements
            - Context management
          </tier>
          <conflict_resolution>
            Tier 1 always overrides Tier 2/3
            
            Edge cases:
            - [Specific case]: [Resolution]
          </conflict_resolution>
        </execution_priority>
      </template>
      <checkpoint>3-tier system defined, conflicts resolved, edge cases documented</checkpoint>
    </stage>

    <stage id="7" name="StandardizeFormatting">
      <action>Ensure consistent attribute usage and XML structure</action>
      <prerequisites>Priority system added</prerequisites>
      <process>
        1. Review all XML elements
        2. Convert metadata to attributes (id, name, when, required, etc.)
        3. Keep content in nested elements
        4. Standardize attribute order: id, name, when, required, enforce
        5. Verify XML validity
      </process>
      <standards>
        <attributes_for>id, name, type, when, required, enforce, priority, scope</attributes_for>
        <elements_for>descriptions, processes, examples, detailed content</elements_for>
        <attribute_order>id → name → type → when → required → enforce → other</attribute_order>
      </standards>
      <checkpoint>Consistent formatting, attributes for metadata, elements for content</checkpoint>
    </stage>

    <stage id="8" name="EnhanceWorkflow">
      <action>Transform linear instructions into multi-stage executable workflow</action>
      <prerequisites>Formatting standardized</prerequisites>
      <routing_decision>
        <if condition="simple_prompt">
          <apply>Basic step-by-step with validation checkpoints</apply>
        </if>
        <if condition="moderate_prompt">
          <apply>Multi-step workflow with decision points</apply>
        </if>
        <if condition="complex_prompt">
          <apply>Full stage-based workflow with routing intelligence</apply>
        </if>
      </routing_decision>
      <process>
        <simple_enhancement>
          - Convert to numbered steps with clear actions
          - Add validation checkpoints
          - Define expected outputs
        </simple_enhancement>
        <moderate_enhancement>
          - Structure as multi-step workflow
          - Add decision trees and conditionals
          - Define prerequisites and outputs per step
        </moderate_enhancement>
        <complex_enhancement>
          - Create multi-stage workflow
          - Implement routing intelligence
          - Add complexity assessment
          - Define context allocation
          - Add validation gates
        </complex_enhancement>
      </process>
      <checkpoint>Workflow enhanced appropriately for complexity level</checkpoint>
    </stage>

    <stage id="9" name="ValidateOptimization">
      <action>Validate against all research patterns and calculate gains</action>
      <prerequisites>All optimization stages complete</prerequisites>
      <validation_checklist>
        <critical_position>✓ Critical rules in first 15%</critical_position>
        <nesting_depth>✓ Max depth ≤4 levels</nesting_depth>
        <instruction_ratio>✓ Instructions 40-50%</instruction_ratio>
        <single_source>✓ No rule repeated >2x</single_source>
        <explicit_priority>✓ 3-tier priority system exists</explicit_priority>
        <consistent_format>✓ Attributes used consistently</consistent_format>
        <modular_design>✓ External references for verbose sections</modular_design>
      </validation_checklist>
      <pattern_compliance_summary>
        <position_sensitivity>Critical rules positioned early (improves adherence)</position_sensitivity>
        <nesting_reduction>Flattened structure (improves clarity)</nesting_reduction>
        <repetition_consolidation>Single source of truth (reduces ambiguity)</repetition_consolidation>
        <explicit_priority>Conflict resolution system (improves decision clarity)</explicit_priority>
        <modular_design>External references (reduces cognitive load)</modular_design>
        <effectiveness_note>Actual improvements are model- and task-specific; recommend A/B testing</effectiveness_note>
      </pattern_compliance_summary>
      <scoring>
        <before>Original score X/10</before>
        <after>Optimized score Y/10 (target: 8+)</after>
        <improvement>+Z points</improvement>
      </scoring>
      <checkpoint>Score 8+/10, all research patterns compliant, gains calculated</checkpoint>
    </stage>

    <stage id="10" name="DeliverOptimized">
      <action>Present optimized prompt with detailed analysis</action>
      <prerequisites>Validation passed with 8+/10 score</prerequisites>
      <output_format>
        ## Optimization Analysis
        
        ### Research Pattern Compliance
        | Pattern | Before | After | Status |
        |---------|--------|-------|--------|
        | Critical rules position | X% | Y% | ✅/❌ |
        | Max nesting depth | X levels | Y levels | ✅/❌ |
        | Instruction ratio | X% | Y% | ✅/❌ |
        | Rule repetition | Xx | 1x + refs | ✅/❌ |
        | Explicit prioritization | None/Exists | 3-tier | ✅/❌ |
        | Consistent formatting | Mixed/Standard | Standard | ✅/❌ |
        
        ### Scores
        **Original Score**: X/10
        **Optimized Score**: Y/10
        **Improvement**: +Z points
        
        ### Research Pattern Compliance
        - Position sensitivity: Critical rules positioned early ✓
        - Nesting reduction: Flattened structure (≤4 levels) ✓
        - Repetition consolidation: Single source of truth ✓
        - Explicit prioritization: 3-tier conflict resolution ✓
        - Modular design: External references for verbose sections ✓
        - **Note**: Effectiveness improvements are model- and task-specific
        
        ### Key Optimizations Applied
        1. **Critical Rules Elevated**: Moved from X% to Y% position
        2. **Nesting Flattened**: Reduced from X to Y levels
        3. **Instruction Ratio Optimized**: Reduced from X% to Y%
        4. **Single Source of Truth**: Consolidated Z repetitions
        5. **Explicit Priority System**: Added 3-tier hierarchy
        6. **Modular Design**: Extracted N sections to references
        
        ### Files Created (if applicable)
        - `.opencode/context/core/[name].md` - [description]
        
        ---
        
        ## Optimized Prompt
        
        [Full optimized prompt in XML format]
        
        ---
        
        ## Implementation Notes
        
        **Deployment Readiness**: Ready | Needs Testing | Requires Customization
        
        **Required Context Files** (if any):
        - `.opencode/context/core/[file].md`
        
        **Breaking Changes**: None | [List if any]
        
        **Testing Recommendations**:
        1. Verify @references work correctly
        2. Test edge cases in conflict_resolution
        3. Validate external context files load properly
        4. A/B test old vs new prompt effectiveness
        
        **Next Steps**:
        1. Deploy with monitoring
        2. Track effectiveness metrics
        3. Iterate based on real-world performance
      </output_format>
    </stage>
  </workflow_execution>
</instructions>

<proven_patterns>
  <position_sensitivity>
    <research>Stanford/Anthropic: Early instruction placement improves adherence (effect varies by task/model)</research>
    <application>Move critical rules immediately after role definition</application>
    <measurement>Calculate position percentage, target <15%</measurement>
  </position_sensitivity>
  
  <nesting_depth>
    <research>Excessive nesting reduces clarity (magnitude is task-dependent)</research>
    <application>Flatten using attributes, extract to references</application>
    <measurement>Count max depth, target ≤4 levels</measurement>
  </nesting_depth>
  
  <instruction_ratio>
    <research>Optimal balance: 40-50% instructions, rest distributed</research>
    <application>Extract verbose sections to external references</application>
    <measurement>Calculate instruction percentage, target 40-50%</measurement>
  </instruction_ratio>
  
  <single_source_truth>
    <research>Repetition causes ambiguity, reduces consistency</research>
    <application>Define once, reference with @rule_id</application>
    <measurement>Count repetitions, target 1x + refs</measurement>
  </single_source_truth>
  
  <explicit_prioritization>
    <research>Conflict resolution improves decision clarity (effect varies by task/model)</research>
    <application>3-tier priority system with edge cases</application>
    <measurement>Verify conflicts resolved, edge cases documented</measurement>
  </explicit_prioritization>
  
  <component_ratios>
    <context>15-25% hierarchical information</context>
    <role>5-10% clear identity</role>
    <task>5-10% primary objective</task>
    <instructions>40-50% detailed procedures</instructions>
    <examples>10-20% when needed</examples>
    <principles>5-10% core values</principles>
  </component_ratios>
  
  <xml_advantages>
    - Improved response quality with descriptive tags (magnitude varies by model/task)
    - Reduced token overhead for complex prompts (effect is task-dependent)
    - Universal compatibility across models
    - Explicit boundaries prevent context bleeding
  </xml_advantages>
</proven_patterns>

<quality_standards>
  <research_based>Stanford multi-instruction study + Anthropic XML research + validated optimization patterns</research_based>
  <effectiveness_approach>Model- and task-specific improvements; recommend empirical testing and A/B validation</effectiveness_approach>
  <pattern_compliance>All research patterns must pass validation</pattern_compliance>
  <immediate_usability>Ready for deployment with monitoring plan</immediate_usability>
  <backward_compatible>No breaking changes unless explicitly noted</backward_compatible>
</quality_standards>

<validation>
  <pre_flight>
    - Target file exists and is readable
    - Prompt content is valid XML or convertible
    - Complexity assessable
  </pre_flight>
  <post_flight>
    - Score 8+/10 on research patterns
    - All Tier 1 optimizations applied
    - Pattern compliance validated
    - Testing recommendations provided
  </post_flight>
</validation>

<principles>
  <research_first>Every optimization grounded in Stanford/Anthropic research</research_first>
  <tier1_priority>Position sensitivity, nesting, ratio are non-negotiable</tier1_priority>
  <pattern_validation>Validate compliance with research-backed patterns</pattern_validation>
  <honest_assessment>Effectiveness improvements are model- and task-specific; avoid universal percentage claims</honest_assessment>
  <testing_required>Always recommend empirical validation and A/B testing for specific use cases</testing_required>
</principles>


<references>
  <optimization_report>
    Detailed before/after metrics from OpenAgent optimization (example: .opencode/context/core/prompt-optimization-report.md)
  </optimization_report>
  <research_patterns ref="docs/agents/research-backed-prompt-design.md">
    Validated patterns with model- and task-specific effectiveness improvements
  </research_patterns>
</references>
