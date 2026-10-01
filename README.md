# Description

Pontoon is a translation management system used and developed by the
[Mozilla localization community](https://pontoon.mozilla.org/). It
specializes in open source localization that is driven by the community and
uses version control systems for storing translations.

It specializes in open source localization that is driven by the community and uses version-control systems for storing translations.

# Docs

- [Pontoon User Doc](https://docs.google.com/document/d/1PIr68vmqWcSi9SRGsYDwKy4VaLRq9wek9d9DnAerma8)
- [Pontoon Admin Doc](https://docs.google.com/document/d/12enkYKPpQZFIpvPaWIVMlol0crWmjhgJ7e4xNt_RAvI)

# Local development

Prerequisites:

- pyenv
- nvm

1. Set up local Git repo

```sh
git clone https://github.com/scantrust/pontoon
cd pontoon

# Add the Mozilla Pontoon git repo as remote: upstream
git remote add upstream https://github.com/mozilla/pontoon
```

2. Install dependencies

```sh
pyenv install `pyenv local`
nvm install v24 --lts

python -m venv venv
pip install -r requirements/default.txt
pip install -r requirements/dev.txt
```

3. Start up a postgres database container

```sh
docker-compose up -d postgres
```

Or, execute below SQL commands on an existing database to create Pontoon database

```sql
CREATE USER pontoon WITH CREATEDB PASSWORD 'asdf';
CREATE DATABASE pontoon WITH owner = 'pontoon';
```

4. Create env file

```sh
# Add real value to below vrabiles
KEYCLOAK_CLIENT_ID=""
KEYCLOAK_CLIENT_SECRET=""
GOOGLE_TRANSLATE_API_KEY=""
SSH_KEY=""

cat >> .env <<EOF
# Env Vars
SECRET_KEY=random_key
DJANGO_DEV=True
DJANGO_DEBUG=True
CI=False
DATABASE_URL=postgres://pontoon:asdf@localhost:5555/pontoon
ENABLE_INSIGHTS_TAB=True
SESSION_COOKIE_SECURE=False
SITE_URL=http://localhost:8000
ALLOWED_HOSTS="localhost,127.0.0.1,0.0.0.0,pontoon.scantrust.io,192.168.0.0/16"

AUTHENTICATION_METHOD=keycloak

# Keycloak Authentication
KEYCLOAK_URL=https://keycloak.scantrust.io
KEYCLOAK_REALM=Pontoon
KEYCLOAK_CLIENT_ID=${KEYCLOAK_CLIENT_ID}
KEYCLOAK_CLIENT_SECRET=${KEYCLOAK_CLIENT_SECRET}

GOOGLE_TRANSLATE_API_KEY=${GOOGLE_TRANSLATE_API_KEY}

SSH_KEY="${SSH_KEY}"
KNOWN_HOSTS="
|1|1INgyaCPxmwTuu8P1DTvy6zp3N0=|4Yu0ELWteoeZS5D9Z2SbyAIrLFE= ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
|1|DSlVMBhVZ5hDQVIMeS0IbQ6jl/Y=|hlAmJsXzR4hOJbKGS2nTT+NA6Us= ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
|1|YoQH0KUOlpSBALw3KTNem3ptCdw=|DCD0carpoEY34sdwSk4wm+ALfXA= ecdsa-sha2-nistp256 AAAAE2VjZHNhLXNoYTItbmlzdHAyNTYAAAAIbmlzdHAyNTYAAABBBEmKSENjQEezOmxkZMy7opKgwFB9nkt5YRrYMjNuG5N87uRgg6CLrbo5wAdT/y6v0mKV0U2w0WZ2YB/++Tpockg=
"
GIT_CONFIG="
[user]
	name = pontoon.scantrust.io
[url \"git@github.com:\"]
	insteadOf = git://github.com/
[url \"git@github.com:\"]
	insteadOf = https://github.com/
"
```

5. Run server locally

```sh
source venv/bin/activate
# Create admin user
python manage.py createsuperuser
# Add Keycloak as auth provider
python manage.py update_auth_providers
python manage.py runserver
```

6. Update from the upstream repo - mozilla/pontoon

**Merge upstream into `main` - do not rebase `main`, and do not force push it.**

`main` is a shared, protected branch. Rebasing it rewrites commits that are
already on `origin/main`, which leaves `git push -f` as the only way to publish
the result. A force push to a shared branch silently deletes any teammate's
commit pushed in the meantime, and forces everyone else to reset their clone.
Merging keeps `origin/main` as an ancestor, so the push is an ordinary
fast-forward and nothing can be lost.

**This runs automatically.** `.github/workflows/sync-upstream.yml` runs every
Monday (and on demand from the Actions tab). It merges `upstream/main` into a
`sync/upstream` branch cut from `main`, verifies the result, and opens a pull
request. If the merge has conflicts it pushes nothing and lists the files in the
job summary - finish it locally:

```sh
make sync-upstream          # fetch, merge onto sync/upstream, verify
# on conflicts: fix the listed files, `git add` them, then
make sync-upstream-verify
git commit --no-edit        # the message already records the auto-resolutions
make sync-upstream-pr       # plain push of sync/upstream + open the PR
```

`make sync-upstream` needs a clean working tree, and refuses to start if a
`sync/upstream` branch already exists (finish or delete it first). Pass
`PYTHON=venv/bin/python` if `python` is not your project interpreter.

**Merge sync PRs with "Create a merge commit" only.** Squash or rebase merging
drops `upstream/main` as a parent of `main`, so the next sync sees `main` as
behind and re-merges the same commits, with the same conflicts, every week.

If verification reports more than one leaf migration for an app, add a merge
migration on the sync branch and commit it:
`python manage.py makemigrations --merge <app>`.

Some paths are resolved by fixed policy, and each one is listed in the merge
commit and the PR so nothing is dropped silently:

- `.github/` - always ours. ScanTrust runs only its own workflows.
- `README.md` - always ours; it is ScanTrust content, not upstream's README.
- `package-lock.json` - regenerated from the merged `package.json` files, when
  those merged cleanly.

The verification (`make sync-upstream-verify`) checks for unresolved conflicts
and leftover markers, undefined names and duplicated imports (`ruff` F821 and
F811), more than one leaf migration per app, and that `npm ci` plus the frontend
build succeed. Two of these catch hazards git does *not* report as conflicts: an
import both sides added, and migrations added independently on each side
(different filenames, so no conflict - but two leaf nodes). It deliberately
does not run the test suite; compare `make test-server` against the pre-merge
baseline yourself before merging the PR.

The workflow expects a repository secret `UPSTREAM_SYNC_TOKEN`: a token with
Contents, Pull requests and Workflows write access. `GITHUB_TOKEN` has no
Workflows permission, and upstream's history modifies `.github/workflows`, so a
push made with it is likely to be refused. Without the secret the workflow falls
back to `GITHUB_TOKEN`, which also requires allowing Actions to create pull
requests (Settings > Actions > General).

<details>
<summary>What the make targets do, step by step</summary>

```sh
# 1. Start from a main that matches the remote exactly
git fetch origin
git fetch upstream

# 2. Merge on a branch, so a bad merge never touches main
git switch -c sync/upstream origin/main
git merge --no-ff upstream/main
```

Resolve conflicts, verify, then publish the branch - no `-f`:

```sh
git ls-files -u                              # nothing left unmerged
git grep -nE '^(<<<<<<<|>>>>>>>)( |$)'       # no leftover conflict markers
git push -u origin sync/upstream
gh pr create --base main --head sync/upstream
```

If a push is ever rejected as non-fast-forward, someone else has pushed.
Reconcile with their work or start again; never resolve it with `-f`.

</details>

7. Build the image

Normally you do not need to do this by hand. Pushing a change to
`.bumpversion.cfg` on `main` triggers `.github/workflows/build-docker.yaml`,
which builds the image and pushes it to ECR tagged with `make version`. The
workflow can also be run manually from the Actions tab with an explicit tag
(`workflow_dispatch`).

Note the workflow runs `make build-translate`, so a frontend build failure
blocks the release even when the Python side is fine.

To build locally anyway, run below command in terminal

```sh
# bump the current version
bumpversion patch

# build the image
nvm use v22 && \
    make build-translate && \
    docker build -f ./docker/Dockerfile --build-arg USER_ID=1000 --build-arg GROUP_ID=1000 \
        -t 715161504141.dkr.ecr.eu-west-1.amazonaws.com/pontoon:$(make version) .
```

8. Push the image to AWS ECR

```sh
# Login to AWS ECR
aws ecr get-login-password | docker login -u AWS --password-stdin \
  715161504141.dkr.ecr.eu-west-1.amazonaws.com

# Push the image
docker push 715161504141.dkr.ecr.eu-west-1.amazonaws.com/pontoon:$(make version)
```

# Todos

- [✓] Create Postgres database statefulset in the namespace `apps`
- [✓] Create Docker image of Pontoon and upload to ECR
- [✓] Deploy Pontoon service
- [✓] Integrate Google authentication
- [✓] Create a example project
- [✓] Setup a dedicated Git account for Pontoon's Git Sync (generate a Git
  access token and update pontoon-secret)
- [✓] Solve SSH_KEY not working problem
- [✓] Hide the duplicated localized files in the pontoon projects
- [✓] Migrate backend-api from Transifex to Pontoon
- [✓] Migrate Android STE and IOS STE translations and showcase the workflow to
  the project managers
- [✓] Replace Google Oauth with the production one
- [✓] ~~To download project configuration files, Pontoon requires a http request
  URL. Currently it’s set up to download the raw file from the github private
  repo with a personal access token. It might be worth considering putting the
  config files to S3.~~ Going with hosting configuration files in S3 bucket
  `dl.scantrust.com`.
- [ ] There is an option to download the translation files in the translating
      page of the file. It’s returning 404.
- [✓] ~~Pontoon private projects are not visible to default users, translators
  nor even team managers . Public projects are public to non-login users. So
  it’s probably not a good way.~~ Going with assigning users superuser role in
  Pontoon.
- [✓] Set up Google Translation suggestion in the translating page
- [✓] Hold a knowledge transfer meeting for the translators
- [ ] Requesting a new Team (locale) in a project or a new project in a Team
      (locale) is not working. Need to set up an SMTP account.
- [✓] Add per-project permissions for users
- [✓] Integrate Keycloak auth
- [✓] Fix unauthorized page showing Django debug page instead of login page.
- [✓] Add project action for exporting project translations
- [ ] Correlate Keycloak user groups with user groups in Pontoon
- [✓] Export/import translations in project page
- [✓] Add versioning using bumpversion

# References

- [📚 **Documentation**](https://mozilla-pontoon.readthedocs.io/)
- [Developer Setup using Docker](https://mozilla-pontoon.readthedocs.io/en/latest/dev/setup.html).
