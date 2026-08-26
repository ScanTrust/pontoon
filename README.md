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

```sh
# 1. Start from a main that matches the remote exactly
git fetch upstream
git switch main
git pull --ff-only origin main

# 2. Do the merge on a scratch branch, so a bad merge never touches main
git switch -c merge/upstream-$(date +%Y%m%d)
git merge upstream/main
```

Resolve any conflicts, then **verify before publishing** - the merge is not
done until these pass:

```sh
git grep -nE '^(<<<<<<<|>>>>>>>|=======)$'   # no leftover conflict markers
ruff check pontoon/                          # no F821 undefined names
python manage.py makemigrations --check --dry-run   # single migration leaf
make build-translate                         # the frontend still builds
make test-server                             # runs in docker compose; compare
                                             # failures against the pre-merge
                                             # baseline, not zero
```

Watch for two things git will *not* flag as conflicts: an import that both
sides added (duplicated, not conflicted) and two migrations added independently
on either side (different filenames, so no conflict - but two leaf nodes).

```sh
# 3. Fast-forward main onto the verified merge and push - no -f
git switch main
git merge --ff-only merge/upstream-$(date +%Y%m%d)

# This must print nothing and exit 0. If it fails, history was rewritten
# somewhere - stop and investigate rather than reaching for `git push -f`.
git merge-base --is-ancestor origin/main main

git push origin main
```

`main` requires changes to go through a pull request. Pushing directly works if
you hold the bypass permission, but it skips review - prefer opening a PR from
the merge branch and letting it merge normally.

If `git push origin main` is ever rejected as non-fast-forward, someone else
has pushed. Re-run step 1 and merge again; never resolve it with `-f`.

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
