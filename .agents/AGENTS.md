# Weeber Platform Developer Rules

This document outlines workspace-level conventions, git branch conflict resolutions, and testing practices to maintain the stability of the Weeber codebase.

---

### Git Drift Recovery & Conflict Management
*   **Audit Pulls:** After executing `git pull`, always verify the file status and git history:
    ```bash
    git log -3 --oneline
    git show HEAD --stat
    ```
*   **Automatic Restores:** If a pull reveals that a colleague's commit deleted recently added fixtures, configs, or testing files, immediately checkout the deleted files from the last known good commit and re-commit/push them to `main` (e.g. `git checkout <good-sha> -- <filepath>`).

### Living QA & Documentation Conventions
*   **Living QA Sheet Updates:** When implementing new features, webhook endpoints, or structural configurations, developers must append a manual verification row to the `Active QA Verification Matrix` or `Non-Automatable Manual Test Cases` table in `docs/testing/edge_cases.md`.
*   **Changelog Sync:** Ensure that every feature listed in `docs/CHANGELOG.md` has a matching manual validation step cataloged in `docs/testing/edge_cases.md` before deploying changes to staging or production.
