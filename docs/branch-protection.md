# Branch protection

`main` is the version of Findr that everyone runs and builds on, so it must always work. We protect it with a GitHub ruleset called **Protect main** (Settings → Rules → Rulesets). It applies to the default branch, `main`.

This page lists each rule and why we use it.

## The rules

| Rule | What it does | Why we use it |
|------|--------------|---------------|
| **Require a pull request before merging** | Nobody can push straight to `main`. Every change goes through a pull request (PR). | Each change gets a place to be discussed, reviewed and tested before it reaches everyone. |
| **1 approving review** | A PR needs at least 1 approval from a teammate before it can be merged. | A second pair of eyes catches bugs, unclear code and leaked secrets. It also means at least two people understand each change. |
| **Dismiss stale approvals when new commits are pushed** | If you push more commits after someone approved, their approval is removed. | The reviewer approved the code they saw. New code needs a new look, or untested changes could slip in after the approval. |
| **Require approval of the most recent push** | The last push must be approved by someone other than the person who pushed it. | You can't approve your own final changes, even on someone else's PR. |
| **Require conversation resolution** | Every review comment must be marked as resolved before merging. | Feedback can't be ignored. Either the change is made, or the reason not to make it is agreed in the thread. |
| **Require status checks to pass** | Four jobs must pass: `Lint and test (backend)`, `Lint and test (frontend)`, `Docker build` and `Terraform scan (Checkov)`. In Formative 1 this was one `test` job. In Formative 2 we split CI into three jobs. In the summative we added the Terraform security scan as a required check, so risky infrastructure settings also block merging (see [SECURITY.md](../SECURITY.md)). The image scan and dependency scan will be added when they are merged. | Broken code, lint errors or a Docker image that doesn't build are caught before they reach `main`. |
| **Require branches to be up to date** | A PR's branch must include the latest `main` before it can be merged. | The checks run against the code as it will really look after merging, so two PRs that each pass alone can't break `main` together. |
| **Squash or rebase merges only** | PRs are merged with **Squash and merge** or **Rebase and merge**. Regular merge commits are turned off. | `main` keeps a clean, straight history. Each feature lands as one clear commit, which is easy to read and to undo. |
| **Block force pushes** | Nobody can `git push --force` to `main`. | A force push can rewrite or delete history that teammates already have, and lose their work. |
| **Restrict deletions** | `main` can't be deleted. | Protects the project's main branch from being removed by accident. |

## How a change gets into `main`

1. Update your local `main`: `git checkout main`, then `git pull`.
2. Create a branch: `git checkout -b feature/your-task`. Use `feature/...` for features and `docs/...` for docs.
3. Commit your work and push the branch: `git push -u origin feature/your-task`.
4. Open a PR into `main`. A backend person reviews frontend PRs, and a frontend person reviews backend PRs, so everyone understands the whole app.
5. Wait for CI to pass and for 1 approval. Fix and resolve any comments.
6. If GitHub says the branch is out of date, click **Update branch** (or merge `main` into your branch locally and push).
7. Click **Squash and merge**.

## Also

- Never commit `.env` files, passwords or keys. `.gitignore` blocks them, and `.env.example` shows which settings are needed.
- Only repository admins can change these rules, under Settings → Rules → Rulesets → **Protect main**.
