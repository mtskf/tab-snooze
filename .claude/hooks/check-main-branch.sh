#!/bin/bash
# Claude Code hook: Warn when working on main branch

current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

if [ "$current_branch" = "main" ]; then
  echo "Warning: You are on the 'main' branch."
  echo "Consider creating a feature branch first:"
  echo "  git checkout -b <type>/<context>"
  exit 0
fi

exit 0
