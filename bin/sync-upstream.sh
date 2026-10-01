#!/usr/bin/env bash
#
# Merge upstream mozilla/pontoon into a sync branch cut from origin/main.
#
# This never rebases or modifies main and never force pushes: the result is
# published as a branch plus a pull request. See README step 6 for why.
#
# Usage: bin/sync-upstream.sh merge|verify|pr
#   merge   Fetch, merge upstream into $SYNC_BRANCH, auto-resolve the paths
#           whose resolution is fixed policy, then verify.
#   verify  Run the post-merge checks on the working tree.
#   pr      Push $SYNC_BRANCH (no force) and open a pull request into main.
#
# Exit codes for `merge`, which CI relies on:
#   0   merged, committed and verified
#   10  main already contains upstream, nothing to do
#   20  conflicts need a human; the merge is left in progress on $SYNC_BRANCH
#   30  merged and committed, but verification failed
#   1   any other error

set -euo pipefail

UPSTREAM_REMOTE=${UPSTREAM_REMOTE:-upstream}
UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/mozilla/pontoon.git}
UPSTREAM_REF=${UPSTREAM_REF:-$UPSTREAM_REMOTE/main}
BASE_REF=${BASE_REF:-origin/main}
SYNC_BRANCH=${SYNC_BRANCH:-sync/upstream}
PYTHON=${PYTHON:-python}
# Where `merge` writes a Markdown summary of what it did (CI shows it).
SYNC_REPORT=${SYNC_REPORT:-$(git rev-parse --git-path sync-upstream-report.md)}

# Paths whose upstream changes are always discarded in favour of ours:
# - .github: ScanTrust runs only its own workflows (c2be2a92a).
# - README.md: wholly ScanTrust content, unrelated to upstream's README.
OURS_PATHS=(.github README.md)

die() { echo "!!! $*" >&2; exit 1; }
report() { echo "$*" | tee -a "$SYNC_REPORT"; }

verify() {
    local failed=0
    echo ">>> Checking for unresolved conflicts"
    if [ -n "$(git ls-files -u)" ] || git grep -qnE '^(<<<<<<<|>>>>>>>)( |$)'; then
        git ls-files -u | cut -f2 | sort -u
        git grep -nE '^(<<<<<<<|>>>>>>>)( |$)' || true
        echo "!!! unresolved conflicts or leftover conflict markers"; failed=1
    fi

    # Narrowed to the hazards a merge introduces: undefined names from an
    # import conflict resolved the wrong way, and imports both sides added.
    echo ">>> ruff: undefined names (F821) and redefinitions (F811)"
    "$PYTHON" -m ruff check pontoon --select F821,F811 || failed=1

    # Not `makemigrations --check`: that also flags model drift unrelated to
    # the merge. Two migrations added independently produce two leaf nodes.
    echo ">>> Migration graph: one leaf node per app"
    SECRET_KEY=${SECRET_KEY:-sync-upstream-check} \
    DATABASE_URL=${DATABASE_URL:-postgres://check:check@localhost:5432/check} \
        "$PYTHON" manage.py shell -c "
import sys
from django.db.migrations.loader import MigrationLoader
conflicts = MigrationLoader(None, ignore_no_migrations=True).detect_conflicts()
for app, names in conflicts.items():
    print(f'!!! {app} has multiple leaf migrations: {sorted(names)}')
sys.exit(1 if conflicts else 0)
" || failed=1

    # npm ci rather than install, so a lockfile out of step with package.json
    # fails here instead of being silently rewritten.
    echo ">>> Frontend build"
    { npm ci --no-audit --no-fund && npm run build -w translate; } || failed=1

    if [ "$failed" -ne 0 ]; then
        echo "!!! verification failed"; return 1
    fi
    echo "... all checks passed"
}

merge() {
    git diff --quiet && git diff --cached --quiet || die "working tree has uncommitted changes"
    [ -f "$(git rev-parse --git-path MERGE_HEAD)" ] && die "a merge is already in progress"

    git remote get-url "$UPSTREAM_REMOTE" >/dev/null 2>&1 ||
        git remote add "$UPSTREAM_REMOTE" "$UPSTREAM_URL"
    # Separate fetches: under set -e a failure of either stops the script,
    # rather than leaving a stale ref that makes main look up to date.
    git fetch --quiet origin
    git fetch --quiet "$UPSTREAM_REMOTE"

    : > "$SYNC_REPORT"
    local upstream_sha base_sha
    upstream_sha=$(git rev-parse --short "$UPSTREAM_REF")
    base_sha=$(git rev-parse --short "$BASE_REF")

    if git merge-base --is-ancestor "$UPSTREAM_REF" "$BASE_REF"; then
        report "\`$BASE_REF\` ($base_sha) already contains \`$UPSTREAM_REF\` ($upstream_sha). Nothing to do."
        return 10
    fi
    git rev-parse --verify --quiet "refs/heads/$SYNC_BRANCH" >/dev/null &&
        die "branch $SYNC_BRANCH already exists; finish or delete it first"

    local mb behind
    mb=$(git merge-base "$BASE_REF" "$UPSTREAM_REF")
    behind=$(git rev-list --count "$BASE_REF..$UPSTREAM_REF")
    report "## Upstream sync: \`$UPSTREAM_REF\` ($upstream_sha) into \`$BASE_REF\` ($base_sha)"
    report ""
    report "$behind upstream commits on branch \`$SYNC_BRANCH\`."

    git switch --quiet -c "$SYNC_BRANCH" "$BASE_REF"
    git merge --no-ff --no-commit "$UPSTREAM_REF" >/dev/null 2>&1 || true

    local -a resolved=()
    local path changed
    for path in "${OURS_PATHS[@]}"; do
        changed=$(git diff --name-only "$mb" "$UPSTREAM_REF" -- "$path")
        [ -z "$changed" ] && continue
        git rm -rfq --ignore-unmatch -- "$path"
        if git cat-file -e "$BASE_REF:$path" 2>/dev/null; then
            git checkout "$BASE_REF" -- "$path"
        fi
        while read -r f; do resolved+=("\`$f\`: kept ours, upstream change discarded"); done <<< "$changed"
    done

    # The lockfile is derived from the package.json files, so if those merged
    # cleanly it can be regenerated instead of merged by hand.
    if [ -n "$(git ls-files -u -- package-lock.json)" ]; then
        if [ -n "$(git ls-files -u -- '*package.json')" ]; then
            echo "... package.json conflicts too; leaving package-lock.json for a human"
        else
            git checkout --theirs -- package-lock.json
            npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null
            git add package-lock.json
            resolved+=("\`package-lock.json\`: regenerated from the merged package.json files")
        fi
    fi

    if [ ${#resolved[@]} -gt 0 ]; then
        report ""
        report "Auto-resolved by policy (\`bin/sync-upstream.sh\`):"
        for path in "${resolved[@]}"; do report "- $path"; done
    fi

    # Also used by `git commit --no-edit` after a human resolves conflicts.
    {
        echo "Merge $UPSTREAM_REF ($upstream_sha) into main"
        echo
        echo "Brings in $behind upstream commits."
        if [ ${#resolved[@]} -gt 0 ]; then
            echo
            echo "Auto-resolved by bin/sync-upstream.sh:"
            for path in "${resolved[@]}"; do echo "- ${path//\`/}"; done
        fi
    } > "$(git rev-parse --git-path MERGE_MSG)"

    local conflicts
    conflicts=$(git ls-files -u | cut -f2 | sort -u)
    if [ -n "$conflicts" ]; then
        report ""
        report "Conflicts that need a human:"
        while read -r f; do report "- \`$f\`"; done <<< "$conflicts"
        report ""
        report "Resolve them on \`$SYNC_BRANCH\`, then: \`git add\` the files," \
            "\`make sync-upstream-verify\`, \`git commit --no-edit\`, \`make sync-upstream-pr\`."
        return 20
    fi

    git commit --quiet --no-edit
    report ""
    if verify; then
        report "Merged and verified. Publish with \`make sync-upstream-pr\`."
        return 0
    fi
    report "Merged and committed, but verification failed. Fix it on \`$SYNC_BRANCH\` before opening a PR."
    return 30
}

pr() {
    [ "$(git rev-parse --abbrev-ref HEAD)" = "$SYNC_BRANCH" ] || die "not on $SYNC_BRANCH"
    [ -f "$(git rev-parse --git-path MERGE_HEAD)" ] && die "merge still in progress; commit it first"
    # A plain push: if the remote branch has moved, someone else is working on
    # it, and overwriting that is exactly what this workflow exists to prevent.
    git push --quiet -u origin "$SYNC_BRANCH" ||
        die "push rejected. If origin/$SYNC_BRANCH has diverged, never force it - reconcile" \
            "or delete that branch. If GitHub refused changes under .github/workflows, the" \
            "token lacks the workflow scope (CI: set the UPSTREAM_SYNC_TOKEN secret)."

    local existing
    existing=$(gh pr list --head "$SYNC_BRANCH" --state open --json url --jq '.[0].url // empty')
    if [ -n "$existing" ]; then
        echo "... pull request already open: $existing"
        return 0
    fi
    local body
    body=$(cat "$SYNC_REPORT" 2>/dev/null || true)
    # Squash or rebase would drop upstream as a parent of main, so the next
    # sync would find main "behind" and re-merge the same commits.
    body="> **Merge with \"Create a merge commit\" only.** Squash or rebase drops upstream as a parent, and every later sync re-merges these commits.

${body:-$(git log -1 --format=%b)}"
    gh pr create --base main --head "$SYNC_BRANCH" \
        --title "$(git log -1 --format=%s)" \
        --body "$body"
}

case "${1:-}" in
    merge) merge ;;
    verify) verify ;;
    pr) pr ;;
    *) die "usage: $0 merge|verify|pr" ;;
esac
