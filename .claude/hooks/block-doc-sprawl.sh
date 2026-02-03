#!/bin/bash
# Blocks unauthorized markdown file creation
# Exit 0 = allow, Exit 2 = block

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

# Only check Write and Edit tools
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
  exit 0
fi

# Skip non-markdown files
if [[ "$FILE_PATH" != *.md ]]; then
  exit 0
fi

# Allowed patterns
ALLOWED=(
  "CLAUDE.md"
  "SOURCE_OF_TRUTH.md"
  "BACKLOG.md"
  "CHANGELOG.md"
  "README.md"
  "docs/"
  ".claude/phases/"
  ".claude/subtasks/"
  ".claude/progress/"
  ".claude/validation/"
  ".claude/agents/"
  ".claude/skills/"
  ".claude/environment/"
)

# Check if file matches any allowed pattern
for pattern in "${ALLOWED[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    exit 0  # Allowed
  fi
done

# Block unauthorized markdown
echo "BLOCKED: Unauthorized markdown file: $FILE_PATH" >&2
echo "Allowed locations: docs/, .claude/phases/, .claude/subtasks/, .claude/progress/, .claude/validation/, .claude/agents/, .claude/skills/, .claude/environment/" >&2
exit 2
