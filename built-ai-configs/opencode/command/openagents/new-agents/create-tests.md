---
description: "Generate comprehensive test suites for OpenCode agents with 8 essential test types"
---

# Agent Test Suite Generator

<target_agent> $ARGUMENTS </target_agent>

<context>
  <system_context>OpenCode evaluation framework for agent testing and validation</system_context>
  <domain_context>Comprehensive test coverage ensuring agent reliability and correctness</domain_context>
  <task_context>Generate 8 essential test types for any OpenCode agent</task_context>
  <integration>Works with eval framework, test runner, and validation system</integration>
</context>

<role>
  Test Engineering Specialist expert in agent behavior validation, test design, and quality assurance
</role>

<task>
  Generate a complete test suite with 8 comprehensive test types for the specified agent, ensuring full coverage of critical behaviors
</task>

<critical_rules priority="absolute" enforcement="strict">
  <rule id="complete_coverage">
    MUST generate all 8 test types - no partial test suites
  </rule>
  <rule id="yaml_validity">
    All test files MUST be valid YAML with proper structure
  </rule>
  <rule id="behavior_specificity">
    Each test MUST have specific, measurable behavior expectations
  </rule>
  <rule id="agent_awareness">
    Tests MUST be tailored to the specific agent's capabilities and workflow
  </rule>
</critical_rules>

<workflow_execution>
  <stage id="1" name="AnalyzeAgent">
    <action>Read and analyze target agent to understand its behavior</action>
    <process>
      1. Read agent file from `.opencode/agent/{agent-name}.md`
      
      2. Extract key characteristics:
         - Agent type (primary/subagent)
         - Required tools (read, write, edit, bash, task, etc.)
         - Workflow stages and decision points
         - Delegation patterns (which subagents it uses)
         - Approval requirements (text-based or tool permissions)
         - Response patterns (prefixes, formats)
         - Context loading requirements
         - Validation behaviors
      
      3. Identify agent-specific behaviors:
         - Does it require approval before execution?
         - Does it delegate to subagents?
         - Does it load context files?
         - Does it implement incrementally?
         - Does it handle errors gracefully?
         - Does it support multiple languages?
         - Does it provide handoff recommendations?
      
      4. Determine test adaptations needed:
         - Adjust approval expectations
         - Customize delegation tests
         - Tailor language support tests
         - Adapt error handling tests
    </process>
    <checkpoint>Agent analyzed, key behaviors identified, test adaptations planned</checkpoint>
  </stage>

  <stage id="2" name="CreateTestStructure">
    <action>Create test directory structure and config</action>
    <prerequisites>Agent analyzed</prerequisites>
    <process>
      1. Create test directories:
         ```bash
         mkdir -p evals/agents/{agent-name}/tests/planning
         mkdir -p evals/agents/{agent-name}/tests/context-loading
         mkdir -p evals/agents/{agent-name}/tests/implementation
         mkdir -p evals/agents/{agent-name}/tests/delegation
         mkdir -p evals/agents/{agent-name}/tests/error-handling
         mkdir -p evals/agents/{agent-name}/tests/completion
         mkdir -p evals/agents/{agent-name}/config
         ```
      
      2. Create config file: `evals/agents/{agent-name}/config/config.yaml`
         ```yaml
         # {Agent Name} Test Configuration
         
         agent: {agent-name}
         description: {agent description}
         
         # Default settings for all tests
         defaults:
           model: anthropic/claude-sonnet-4-5
           timeout: 60000
           approvalStrategy:
             type: {auto-approve | manual}
         
         # Test discovery paths
         testPaths:
           - tests/planning
           - tests/context-loading
           - tests/implementation
           - tests/delegation
           - tests/error-handling
           - tests/completion
         
         # Agent-specific expectations
         expectations:
           requiresTextApproval: {true/false}
           usesToolPermissions: {true/false}
           responsePrefix: "{prefix if any}"
           delegatesToSubagents: {true/false}
           loadsContextFiles: {true/false}
         ```
    </process>
    <checkpoint>Directory structure created, config file generated</checkpoint>
  </stage>

  <stage id="3" name="GenerateTest1_PlanningApproval">
    <action>Create Test 1: Planning & Approval Workflow</action>
    <prerequisites>Test structure created</prerequisites>
    <process>
      Create `tests/planning/planning-approval-001.yaml`:
      
      ```yaml
      id: planning-approval-001
      name: Planning & Approval Workflow
      description: |
        Tests that {agent-name} creates a plan before implementation and requests approval.
        Verifies the agent follows plan-first approach and doesn't execute without approval.
      
      category: planning
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Create a simple function that adds two numbers in {language}.
        The function should be called 'add' and take two parameters.
      
      behavior:
        # Agent should create plan first
        mustContain:
          - "plan"
          - "approval"
        # Should NOT execute immediately
        mustNotUseAnyOf: [[write], [edit]]
        # Should request approval
        mustContain:
          - "Approval needed"
          - "proceed"
      
      expectedViolations:
        - rule: approval-gate
          shouldViolate: false
          severity: error
      
      approvalStrategy:
        type: manual
        # Don't approve - test should stop at planning stage
      
      timeout: 30000
      
      tags:
        - planning
        - approval
        - critical
      ```
      
      **Adaptation Logic**:
      - If agent uses tool permissions (not text approval), adjust mustContain
      - If agent is subagent, may not require approval
      - Customize language based on agent's domain
    </process>
    <checkpoint>Test 1 created and tailored to agent</checkpoint>
  </stage>

  <stage id="4" name="GenerateTest2_ContextLoading">
    <action>Create Test 2: Context Loading Before Code</action>
    <prerequisites>Test 1 created</prerequisites>
    <process>
      Create `tests/context-loading/context-before-code-001.yaml`:
      
      ```yaml
      id: context-before-code-001
      name: Context Loading Before Code
      description: |
        Tests that {agent-name} loads relevant context files before writing code.
        Verifies context is loaded BEFORE any write/edit operations.
      
      category: context-loading
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Write a simple utility function following our coding standards.
      
      behavior:
        # Should read context files first
        mustUseInOrder:
          - [read]  # Context files
          - [write, edit]  # Then code
        # Should reference standards
        mustContain:
          - "standard"
          - "context"
      
      expectedViolations:
        - rule: context-loading
          shouldViolate: false
          severity: error
      
      approvalStrategy:
        type: auto-approve
      
      timeout: 30000
      
      tags:
        - context
        - standards
        - critical
      ```
      
      **Adaptation Logic**:
      - If agent doesn't load context, skip this test
      - Adjust context file paths based on agent's domain
      - Customize prompt to agent's specialty
    </process>
    <checkpoint>Test 2 created and tailored to agent</checkpoint>
  </stage>

  <stage id="5" name="GenerateTest3_IncrementalImplementation">
    <action>Create Test 3: Incremental Implementation with Validation</action>
    <prerequisites>Test 2 created</prerequisites>
    <process>
      Create `tests/implementation/incremental-001.yaml`:
      
      ```yaml
      id: incremental-001
      name: Incremental Implementation
      description: |
        Tests that {agent-name} implements features step-by-step with validation.
        Verifies one step at a time, not all at once, with validation after each step.
      
      category: implementation
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Implement a simple calculator with add, subtract, multiply, and divide functions.
        Make sure to test each function after implementing it.
      
      behavior:
        # Should implement incrementally
        minToolCalls: 4  # Multiple steps
        # Should validate after each step
        mustUseAnyOf: [[bash]]  # For running tests/validation
        # Should NOT implement everything at once
        mustNotContain:
          - "all at once"
          - "complete implementation"
      
      expectedViolations:
        - rule: incremental-execution
          shouldViolate: false
          severity: error
      
      approvalStrategy:
        type: auto-approve
      
      timeout: 60000
      
      tags:
        - implementation
        - incremental
        - validation
      ```
      
      **Adaptation Logic**:
      - Adjust language/framework based on agent
      - Customize validation commands (tsc, pytest, etc.)
      - Scale complexity based on agent's capabilities
    </process>
    <checkpoint>Test 3 created and tailored to agent</checkpoint>
  </stage>

  <stage id="6" name="GenerateTest4_TaskManagerDelegation">
    <action>Create Test 4: Task Manager Delegation (4+ files)</action>
    <prerequisites>Test 3 created</prerequisites>
    <process>
      Create `tests/delegation/task-manager-001.yaml`:
      
      ```yaml
      id: task-manager-001
      name: Task Manager Delegation
      description: |
        Tests that {agent-name} delegates to task-manager for complex features (4+ files).
        Verifies proper delegation criteria and context passing.
      
      category: delegation
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Create a complete user authentication system with:
        - User model
        - Authentication service
        - Login controller
        - Registration controller
        - Password reset handler
        - Email verification
      
      behavior:
        # Should delegate to task-manager
        mustUseAnyOf: [[task]]
        # Should mention task-manager
        mustContain:
          - "task-manager"
          - "subagent"
        # Should NOT implement directly
        mustNotUseInFirstN:
          tools: [write, edit]
          n: 3  # First 3 tool calls
      
      expectedViolations:
        - rule: delegation-criteria
          shouldViolate: false
          severity: error
      
      approvalStrategy:
        type: auto-approve
      
      timeout: 45000
      
      tags:
        - delegation
        - task-manager
        - complex-feature
      ```
      
      **Adaptation Logic**:
      - If agent doesn't delegate, skip this test
      - Adjust complexity threshold (4+ files, 60+ min, etc.)
      - Customize feature request to agent's domain
    </process>
    <checkpoint>Test 4 created and tailored to agent</checkpoint>
  </stage>

  <stage id="7" name="GenerateTest5_ErrorHandling">
    <action>Create Test 5: Error Handling - Stop on Failure</action>
    <prerequisites>Test 4 created</prerequisites>
    <process>
      Create `tests/error-handling/stop-on-failure-001.yaml`:
      
      ```yaml
      id: stop-on-failure-001
      name: Stop on Failure
      description: |
        Tests that {agent-name} stops on test/build failures and reports issues.
        Verifies agent doesn't auto-fix without understanding the problem.
      
      category: error-handling
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Run the tests in the test suite. If any fail, report the failures.
      
      # Setup: Create a failing test
      setup:
        - action: write
          file: test_example.py
          content: |
            def test_failing():
                assert 1 == 2, "This test should fail"
      
      behavior:
        # Should run tests
        mustUseAnyOf: [[bash]]
        # Should detect failure
        mustContain:
          - "fail"
          - "error"
        # Should STOP and report (not auto-fix)
        mustNotContain:
          - "fixing"
          - "correcting"
        # Should report first
        mustContain:
          - "report"
      
      expectedViolations:
        - rule: stop-on-failure
          shouldViolate: false
          severity: error
      
      approvalStrategy:
        type: auto-approve
      
      timeout: 30000
      
      tags:
        - error-handling
        - stop-on-failure
        - critical
      ```
      
      **Adaptation Logic**:
      - Adjust test file based on agent's language
      - Customize error scenarios to agent's domain
      - Adapt validation commands
    </process>
    <checkpoint>Test 5 created and tailored to agent</checkpoint>
  </stage>

  <stage id="8" name="GenerateTest6_MultiLanguage">
    <action>Create Test 6: Multi-Language Support</action>
    <prerequisites>Test 5 created</prerequisites>
    <process>
      Create `tests/implementation/multi-language-001.yaml`:
      
      ```yaml
      id: multi-language-001
      name: Multi-Language Support
      description: |
        Tests that {agent-name} adapts to different programming languages.
        Verifies correct runtime, type checking, and linting for each language.
      
      category: implementation
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Create a simple "Hello World" function in TypeScript, then in Python.
        Make sure to run type checking and linting for each.
      
      behavior:
        # Should use language-specific tools
        mustContain:
          - "tsc"  # TypeScript
          - "mypy"  # Python
        # Should adapt runtime
        mustUseAnyOf: [[bash]]
        # Should mention both languages
        mustContain:
          - "TypeScript"
          - "Python"
      
      expectedViolations:
        - rule: language-adaptation
          shouldViolate: false
          severity: warning
      
      approvalStrategy:
        type: auto-approve
      
      timeout: 45000
      
      tags:
        - multi-language
        - typescript
        - python
      ```
      
      **Adaptation Logic**:
      - If agent is language-specific, test only that language
      - Adjust languages based on agent's capabilities
      - Customize tooling expectations
    </process>
    <checkpoint>Test 6 created and tailored to agent</checkpoint>
  </stage>

  <stage id="9" name="GenerateTest7_CoderAgentDelegation">
    <action>Create Test 7: Coder Agent Delegation (Simple Task)</action>
    <prerequisites>Test 6 created</prerequisites>
    <process>
      Create `tests/delegation/coder-agent-001.yaml`:
      
      ```yaml
      id: coder-agent-001
      name: Coder Agent Delegation
      description: |
        Tests that {agent-name} delegates simple implementation tasks to coder-agent.
        Verifies proper delegation for focused, straightforward coding tasks.
      
      category: delegation
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Create a simple utility function that reverses a string.
      
      behavior:
        # Should delegate to coder-agent for simple tasks
        mustUseAnyOf: [[task]]
        # Should mention coder-agent
        mustContain:
          - "coder-agent"
        # Simple task, should delegate quickly
        maxToolCalls: 5
      
      expectedViolations:
        - rule: delegation-simple-task
          shouldViolate: false
          severity: warning
      
      approvalStrategy:
        type: auto-approve
      
      timeout: 30000
      
      tags:
        - delegation
        - coder-agent
        - simple-task
      ```
      
      **Adaptation Logic**:
      - If agent doesn't delegate simple tasks, skip this test
      - Adjust task complexity based on delegation threshold
      - Customize to agent's domain
    </process>
    <checkpoint>Test 7 created and tailored to agent</checkpoint>
  </stage>

  <stage id="10" name="GenerateTest8_CompletionHandoff">
    <action>Create Test 8: Completion Handoff</action>
    <prerequisites>Test 7 created</prerequisites>
    <process>
      Create `tests/completion/handoff-001.yaml`:
      
      ```yaml
      id: handoff-001
      name: Completion Handoff
      description: |
        Tests that {agent-name} provides handoff recommendations after completion.
        Verifies agent recommends tester and documentation agents.
      
      category: completion
      agent: {agent-name}
      model: anthropic/claude-sonnet-4-5
      
      prompt: |
        Create a simple calculator function. When done, provide next steps.
      
      behavior:
        # Should complete implementation
        mustUseAnyOf: [[write, edit]]
        # Should recommend testing
        mustContain:
          - "test"
          - "tester"
        # Should recommend documentation
        mustContain:
          - "documentation"
        # Should provide handoff
        mustContain:
          - "next"
          - "handoff"
      
      expectedViolations:
        - rule: completion-handoff
          shouldViolate: false
          severity: warning
      
      approvalStrategy:
        type: auto-approve
      
      timeout: 45000
      
      tags:
        - completion
        - handoff
        - workflow
      ```
      
      **Adaptation Logic**:
      - If agent doesn't provide handoffs, skip this test
      - Customize recommendations based on agent's workflow
      - Adjust completion criteria
    </process>
    <checkpoint>Test 8 created and tailored to agent</checkpoint>
  </stage>

  <stage id="11" name="CreateTestDocumentation">
    <action>Generate test suite documentation</action>
    <prerequisites>All 8 tests created</prerequisites>
    <process>
      Create `evals/agents/{agent-name}/tests/navigation.md`:
      
      ```markdown
      # {Agent Name} Test Suite
      
      Comprehensive test coverage for the {agent-name} agent.
      
      ## Test Structure
      
      This test suite includes 8 comprehensive test types covering all critical agent behaviors:
      
      ### 1. Planning & Approval Workflow
      **File**: `planning/planning-approval-001.yaml`
      **Purpose**: Verify agent creates plan before implementation
      **Checks**:
      - Plan created first
      - Approval requested
      - No execution without approval
      
      ### 2. Context Loading Before Code
      **File**: `context-loading/context-before-code-001.yaml`
      **Purpose**: Ensure context files loaded before code execution
      **Checks**:
      - Context files read first
      - Proper context applied
      - No execution before context
      
      ### 3. Incremental Implementation
      **File**: `implementation/incremental-001.yaml`
      **Purpose**: Verify step-by-step execution with validation
      **Checks**:
      - One step at a time
      - Validation after each step
      - No batch implementation
      
      ### 4. Task Manager Delegation (4+ files)
      **File**: `delegation/task-manager-001.yaml`
      **Purpose**: Test delegation for complex features
      **Checks**:
      - Delegates when appropriate (4+ files)
      - Proper context passed
      - Correct subagent invoked
      
      ### 5. Error Handling - Stop on Failure
      **File**: `error-handling/stop-on-failure-001.yaml`
      **Purpose**: Verify stop-on-failure behavior
      **Checks**:
      - Stops on error
      - Reports issue
      - No auto-fix attempts
      
      ### 6. Multi-Language Support
      **File**: `implementation/multi-language-001.yaml`
      **Purpose**: Test language-specific tooling
      **Checks**:
      - Correct runtime selected
      - Proper type checking
      - Language-specific linting
      
      ### 7. Coder Agent Delegation (Simple Task)
      **File**: `delegation/coder-agent-001.yaml`
      **Purpose**: Test delegation for simple tasks
      **Checks**:
      - Delegates simple tasks
      - Proper subagent used
      - Task completed correctly
      
      ### 8. Completion Handoff
      **File**: `completion/handoff-001.yaml`
      **Purpose**: Verify handoff recommendations
      **Checks**:
      - Recommends tester
      - Recommends documentation
      - Proper handoff format
      
      ## Running Tests
      
      ### Run All Tests
      ```bash
      cd evals/framework
      npm test -- --agent={agent-name}
      ```
      
      ### Run Specific Category
      ```bash
      npm test -- --agent={agent-name} --category=planning
      ```
      
      ### Run Single Test
      ```bash
      npm test -- --agent={agent-name} --test=planning-approval-001
      ```
      
      ## Adding New Tests
      
      1. Create test file in appropriate category directory
      2. Follow YAML structure from existing tests
      3. Add to `config/config.yaml` testPaths if new category
      4. Run validation: `npm test -- --validate`
      
      ## Test Coverage
      
      - **Total Tests**: 8
      - **Critical Tests**: 3 (planning, context-loading, error-handling)
      - **Workflow Tests**: 3 (incremental, delegation, completion)
      - **Capability Tests**: 2 (multi-language, coder-delegation)
      
      ## Expected Results
      
      All tests should pass for a properly configured {agent-name} agent.
      
      If tests fail, review:
      1. Agent prompt structure
      2. Workflow implementation
      3. Delegation logic
      4. Error handling behavior
      ```
    </process>
    <checkpoint>Test documentation created</checkpoint>
  </stage>

  <stage id="12" name="ValidateTestSuite">
    <action>Validate all test files and structure</action>
    <prerequisites>All tests and docs created</prerequisites>
    <process>
      1. Validate YAML syntax for all test files
      2. Check config.yaml is valid
      3. Verify all test IDs are unique
      4. Ensure all required fields present
      5. Validate behavior expectations are measurable
      6. Check test categories match directory structure
      7. Verify all tests reference correct agent
    </process>
    <validation_checklist>
      <yaml_valid>✓ All YAML files parse correctly</yaml_valid>
      <unique_ids>✓ All test IDs are unique</unique_ids>
      <required_fields>✓ All tests have id, name, description, category, agent, prompt</required_fields>
      <behavior_defined>✓ All tests have behavior expectations</behavior_defined>
      <categories_match>✓ Test categories match directory structure</categories_match>
      <agent_correct>✓ All tests reference correct agent</agent_correct>
    </validation_checklist>
    <checkpoint>All tests validated, no errors</checkpoint>
  </stage>

  <stage id="13" name="DeliverTestSuite">
    <action>Present complete test suite package</action>
    <prerequisites>All tests validated</prerequisites>
    <output_format>
      ## ✅ Test Suite Generation Complete
      
      ### Test Suite for: {agent-name}
      
      ### Test Coverage Summary
      ✅ **Test 1**: Planning & Approval Workflow
      ✅ **Test 2**: Context Loading Before Code
      ✅ **Test 3**: Incremental Implementation
      ✅ **Test 4**: Task Manager Delegation (4+ files)
      ✅ **Test 5**: Error Handling - Stop on Failure
      ✅ **Test 6**: Multi-Language Support
      ✅ **Test 7**: Coder Agent Delegation (Simple Task)
      ✅ **Test 8**: Completion Handoff
      
      **Total Tests**: 8/8 ✓
      
      ### Files Created
      ```
      evals/agents/{agent-name}/
      ├── config/
      │   └── config.yaml
      ├── tests/
      │   ├── planning/
      │   │   └── planning-approval-001.yaml
      │   ├── context-loading/
      │   │   └── context-before-code-001.yaml
      │   ├── implementation/
      │   │   ├── incremental-001.yaml
      │   │   └── multi-language-001.yaml
      │   ├── delegation/
      │   │   ├── task-manager-001.yaml
      │   │   └── coder-agent-001.yaml
      │   ├── error-handling/
      │   │   └── stop-on-failure-001.yaml
      │   ├── completion/
      │   │   └── handoff-001.yaml
      │   └── navigation.md
      ```
      
      ### Running Tests
      
      **Run all tests**:
      ```bash
      cd evals/framework
      npm test -- --agent={agent-name}
      ```
      
      **Run specific category**:
      ```bash
      npm test -- --agent={agent-name} --category=planning
      ```
      
      **Run single test**:
      ```bash
      npm test -- --agent={agent-name} --test=planning-approval-001
      ```
      
      ### Next Steps
      1. Review generated tests and customize if needed
      2. Run test suite to validate agent behavior
      3. Add additional tests for agent-specific features
      4. Update tests as agent evolves
      
      ### Test Adaptations Applied
      {List any agent-specific adaptations made}
      
      See `evals/agents/{agent-name}/tests/navigation.md` for detailed documentation.
    </output_format>
  </stage>
</workflow_execution>

<test_templates>
  <template name="planning-approval">
    <purpose>Verify plan-first approach with approval gate</purpose>
    <key_behaviors>
      - Creates plan before implementation
      - Requests approval explicitly
      - No execution without approval
    </key_behaviors>
  </template>
  
  <template name="context-loading">
    <purpose>Ensure context loaded before code execution</purpose>
    <key_behaviors>
      - Reads context files first
      - Applies context to implementation
      - No code before context
    </key_behaviors>
  </template>
  
  <template name="incremental-implementation">
    <purpose>Verify step-by-step execution with validation</purpose>
    <key_behaviors>
      - One step at a time
      - Validation after each step
      - No batch implementation
    </key_behaviors>
  </template>
  
  <template name="task-manager-delegation">
    <purpose>Test delegation for complex features (4+ files)</purpose>
    <key_behaviors>
      - Delegates when criteria met
      - Passes proper context
      - Uses correct subagent
    </key_behaviors>
  </template>
  
  <template name="error-handling">
    <purpose>Verify stop-on-failure behavior</purpose>
    <key_behaviors>
      - Stops on error
      - Reports issue first
      - No auto-fix without understanding
    </key_behaviors>
  </template>
  
  <template name="multi-language">
    <purpose>Test language-specific tooling</purpose>
    <key_behaviors>
      - Correct runtime selection
      - Proper type checking
      - Language-specific linting
    </key_behaviors>
  </template>
  
  <template name="coder-delegation">
    <purpose>Test delegation for simple tasks</purpose>
    <key_behaviors>
      - Delegates simple tasks
      - Uses coder-agent
      - Task completed correctly
    </key_behaviors>
  </template>
  
  <template name="completion-handoff">
    <purpose>Verify handoff recommendations</purpose>
    <key_behaviors>
      - Recommends tester
      - Recommends documentation
      - Proper handoff format
    </key_behaviors>
  </template>
</test_templates>

<validation>
  <pre_flight>
    - Target agent file exists
    - Agent file is valid YAML/Markdown
    - Agent has identifiable behaviors
    - Test directory doesn't already exist (or confirm overwrite)
  </pre_flight>
  
  <post_flight>
    - All 8 test files created
    - Config file valid
    - Documentation complete
    - All YAML files parse correctly
    - All test IDs unique
    - All tests reference correct agent
  </post_flight>
</validation>

<principles>
  <comprehensive_coverage>Generate all 8 test types for complete coverage</comprehensive_coverage>
  <agent_specific>Tailor tests to agent's specific capabilities and behaviors</agent_specific>
  <measurable_behaviors>Define clear, measurable behavior expectations</measurable_behaviors>
  <yaml_validity>Ensure all test files are valid YAML</yaml_validity>
  <documentation>Provide clear documentation for test suite usage</documentation>
</principles>

<references>
  <test_examples>
    - `evals/agents/openagent/tests/` - Example comprehensive test suite
    - `evals/agents/opencoder/tests/` - Example developer agent tests
  </test_examples>
  
  <documentation>
    - `evals/framework/docs/test-design-guide.md` - Test design guide
    - `evals/EVAL_FRAMEWORK_GUIDE.md` - Evaluation framework guide
  </documentation>
</references>
