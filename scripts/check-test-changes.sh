#!/usr/bin/env bash
# Fails when a pull request removes or rewrites lines in a test file.
# Only added lines are fine: new test files, new tests, new checks in a test.
#
# Usage: scripts/check-test-changes.sh <base-ref>     e.g. origin/main
set -euo pipefail

base="${1:?usage: check-test-changes.sh <base-ref>}"

# Test files: unit (*.spec.ts), integration (*.int-spec.ts), component
# (*.test.tsx) and everything under apps/frontend/e2e.
is_test_file='(\.spec\.ts|\.int-spec\.ts|\.test\.tsx)$|^apps/frontend/e2e/'

# --no-renames: a renamed or deleted test file shows up as removed lines.
# numstat prints "added<TAB>removed<TAB>path" ("-" for binary files).
offenders=$(
  git diff --numstat --no-renames "$base"...HEAD |
    awk -F'\t' -v pattern="$is_test_file" \
      '$3 ~ pattern && ($2 != 0) { printf "%s removed/rewritten line(s) in %s\n", $2, $3 }'
)

if [ -n "$offenders" ]; then
  echo "Test files with removed or rewritten lines:"
  echo "$offenders"
  echo
  echo "Tests may only grow in a pull request. If a test is really obsolete, say so in the PR and merge anyway: this check does not block the merge."
  exit 1
fi

echo "No test file has removed or rewritten lines."
