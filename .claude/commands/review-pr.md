# Review PR

Review this pull request comprehensively using parallel sub-agents.

## Instructions

You are reviewing a pull request. Follow these steps:

1. **Get PR context**: Use `git diff` or GitHub API to identify changed files and understand the scope of changes
2. **Understand the context**: Read the PR description and review the changes
3. **Launch parallel reviews**: Start 5 specialized sub-agents to review different aspects simultaneously
4. **Use inline comments**: Always use `mcp__github_inline_comment__create_inline_comment` to comment directly on specific code lines
5. **Summarize findings**: After all sub-agents complete, provide a brief summary

**Note**: In GitHub Actions context, the PR number and repository information are automatically available. Use Bash with `gh pr view` or git commands to get PR details if needed.

## Sub-agents to launch in parallel

**CRITICAL**: Launch all 5 sub-agents in parallel by making 5 Task tool calls in a single message. This allows them to execute simultaneously.

1. **Code Quality Reviewer** (`.claude/sub-agents/code-quality-reviewer.md`)
   - Focus on code readability, maintainability, and best practices

2. **Performance Reviewer** (`.claude/sub-agents/performance-reviewer.md`)
   - Analyze performance implications and optimization opportunities

3. **Security Code Reviewer** (`.claude/sub-agents/security-code-reviewer.md`)
   - Check for security vulnerabilities and potential exploits

4. **Test Coverage Reviewer** (`.claude/sub-agents/test-coverage-reviewer.md`)
   - Evaluate test coverage and test quality

5. **Documentation Accuracy Reviewer** (`.claude/sub-agents/documentation-accuracy-reviewer.md`)
   - Verify documentation accuracy and completeness

Example of launching sub-agents in parallel:
```
[Make 5 Task tool calls in a single message - one for each sub-agent above]
```

## Result Aggregation

After all sub-agents complete:

1. **Check for duplicates**: If multiple sub-agents flag the same issue, consolidate into a single inline comment
2. **Prioritize issues**: Focus on critical and high-priority issues in the summary
3. **Provide overview**: Write a brief summary comment at the PR level listing:
   - Total number of issues found by category
   - Most critical issues that must be addressed
   - Overall code quality assessment

## Error Handling

If sub-agents encounter errors:

- **File read errors**: Skip the file and note it in the summary
- **Tool failures**: Retry once, then skip and report in summary
- **Timeout**: Sub-agents should focus on changed files only to avoid timeouts
- **Large PRs**: For PRs with >20 changed files, prioritize core changes

## Important Notes

- **Always use inline comments** via `mcp__github_inline_comment__create_inline_comment`
- Each sub-agent operates independently with its own context
- Do NOT write long comments at the PR level - use inline comments for specific issues
- Provide suggestions using GitHub's suggestion feature when possible
- Be constructive and specific in feedback
- Focus on changed files only, not the entire codebase
