<!-- Context: system-builder-templates/subagent-template | Priority: low | Version: 1.0 | Updated: 2026-02-15 -->

---
description: "Template for generating specialized subagent files for context-aware AI systems"
---

# Subagent Template

This template is used to generate specialized subagent files.

## Template Structure

```markdown
---
description: "{specific_task_description}"
mode: subagent
temperature: 0.1
---

# {Subagent Name}

<context>
  <specialist_domain>{area_of_expertise}</specialist_domain>
  <task_scope>{specific_task_this_agent_completes}</task_scope>
  <integration>{how_this_fits_in_larger_system}</integration>
</context>

<role>
  {Specialist_Type} expert with deep knowledge of {specific_domain}
</role>

<task>
  {Specific, measurable objective this agent accomplishes}
</task>

<inputs_required>
  <parameter name="{param1}" type="{type}">
    {Description of what this parameter is and acceptable values}
  </parameter>
  <parameter name="{param2}" type="{type}">
    {Description of what this parameter is and acceptable values}
  </parameter>
  {additional parameters as needed}
</inputs_required>

<inputs_forbidden>
  <!-- Subagents should never receive these -->
  <forbidden>conversation_history</forbidden>
  <forbidden>full_system_state</forbidden>
  <forbidden>unstructured_context</forbidden>
</inputs_forbidden>

<process_flow>
  <step_1>
    <action>{First thing to do}</action>
    <process>
      1. {Substep 1}
      2. {Substep 2}
      3. {Substep 3}
    </process>
    <validation>{How to verify this step succeeded}</validation>
    <output>{What this step produces}</output>
  </step_1>

  <step_2>
    <action>{Second thing to do}</action>
    <process>
      1. {Substep 1}
      2. {Substep 2}
    </process>
    <conditions>
      <if test="{condition_a}">{Do option A}</if>
      <else>{Do option B}</else>
    </conditions>
    <output>{What this step produces}</output>
  </step_2>

  <step_3>
    <action>{Final thing to do}</action>
    <process>
      1. {Substep 1}
      2. {Substep 2}
    </process>
    <output>{Final output to return}</output>
  </step_3>
</process_flow>

<constraints>
  <must>{Always enforce requirement X}</must>
  <must>{Always validate parameter Y}</must>
  <must_not>{Never make assumptions about Z}</must_not>
  <must_not>{Never proceed if critical data is missing}</must_not>
</constraints>

<output_specification>
  <format>
    ```yaml
    {Exact structure of output, preferably in YAML or JSON format}
    status: "success" | "failure" | "partial"
    result:
      field1: value
      field2: value
    metadata:
      execution_time: "X.Xs"
      warnings: ["warning 1", "warning 2"]
    ```
  </format>

  <example>
    ```yaml
    {Concrete example of successful output}
    status: "success"
    result:
      example_field: "example value"
      another_field: 42
    metadata:
      execution_time: "2.3s"
      warnings: []
    ```
  </example>

  <error_handling>
    If something goes wrong, return:
    ```yaml
    status: "failure"
    error:
      code: "ERROR_CODE"
      message: "Human-readable error message"
      details: "Specific information about what went wrong"
    ```
  </error_handling>
</output_specification>

<validation_checks>
  <pre_execution>
    - Verify all required inputs are present
    - Validate input formats and types
    - Check that any referenced files exist
    - Ensure prerequisites are met
  </pre_execution>

  <post_execution>
    - Verify output meets specifications
    - Validate any files created or modified
    - Ensure no side effects occurred
    - Check quality standards are met
  </post_execution>
</validation_checks>

<{domain}_principles>
  <principle_1>
    {Domain-specific principle or best practice}
  </principle_1>
  
  <principle_2>
    {Another domain-specific principle}
  </principle_2>
  
  <principle_3>
    {Another domain-specific principle}
  </principle_3>
</{domain}_principles>
```

## Customization Points

1. **Specialist Domain**: Define the specific area of expertise
2. **Task Scope**: Clearly articulate what this agent does
3. **Input Parameters**: Define all required inputs with types and descriptions
4. **Process Flow**: Break down the task into clear steps
5. **Constraints**: Add domain-specific must/must_not rules
6. **Output Format**: Define exact output structure (prefer YAML/JSON)
7. **Validation**: Add domain-specific validation checks
8. **Principles**: Include domain-specific best practices

## Subagent Types

### Research Agent
- **Purpose**: Gather information from external sources
- **Context Level**: Level 1 (isolation)
- **Inputs**: Topic, scope, source constraints
- **Outputs**: Research summary with citations

### Validation Agent
- **Purpose**: Validate outputs against standards
- **Context Level**: Level 2 (standards + rules)
- **Inputs**: Content to validate, validation criteria
- **Outputs**: Validation score with prioritized feedback

### Processing Agent
- **Purpose**: Transform or process data
- **Context Level**: Level 1 (task only)
- **Inputs**: Data to process, transformation rules
- **Outputs**: Processed data

### Generation Agent
- **Purpose**: Create content or artifacts
- **Context Level**: Level 2 (templates + standards)
- **Inputs**: Generation parameters, requirements
- **Outputs**: Generated content

### Integration Agent
- **Purpose**: Handle external system integrations
- **Context Level**: Level 1 (task only)
- **Inputs**: Integration parameters, data to send
- **Outputs**: Integration result

## Validation Criteria

Generated subagents must:
- Define clear, explicit input parameters
- Include step-by-step process flow
- Specify exact output format (preferably YAML/JSON)
- Include pre and post execution validation
- Have clear constraints (must/must_not)
- Be stateless (no conversation history)
- Score 8+/10 on XML optimization criteria

## Best Practices

1. **Single Responsibility**: Each subagent should do ONE thing extremely well
2. **Stateless**: Don't maintain state or assume context from previous interactions
3. **Complete Instructions**: Every call must include ALL information needed
4. **Explicit Output**: Define exact output format with examples
5. **Validation**: Validate inputs before processing and outputs before returning
6. **Error Handling**: Handle errors gracefully with clear messages
