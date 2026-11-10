#!/usr/bin/env bash
# Build Banners of Dawn and deploy it to Firebase Hosting (project from .firebaserc).
#
# Usage:
#   scripts/deploy.sh                 # checks + build + deploy to the live site
#   scripts/deploy.sh --preview       # deploy to a temporary preview channel instead (expires in 7d)
#   scripts/deploy.sh --preview NAME  # same, with a named preview channel
#   scripts/deploy.sh --skip-checks   # skip lint / map validation / tests (build still typechecks)
#
# First time only: log in with `npx firebase-tools login` (opens a browser).
set -euo pipefail

cd "$(dirname "$0")/.."

preview=""
skip_checks=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --preview)
      preview="preview"
      if [[ $# -gt 1 && "$2" != --* ]]; then preview="$2"; shift; fi
      ;;
    --skip-checks) skip_checks=1 ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
  shift
done

# Load the Node version from .nvmrc when nvm is installed and npm isn't already on PATH.
if ! command -v npm >/dev/null 2>&1 && [[ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]]; then
  set +u
  # shellcheck disable=SC1091
  source "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  nvm use >/dev/null
  set -u
fi
command -v npm >/dev/null 2>&1 || { echo "npm not found; install Node $(cat .nvmrc)" >&2; exit 1; }

# Use a globally installed Firebase CLI if there is one, otherwise run it through npx.
if command -v firebase >/dev/null 2>&1; then
  firebase=(firebase)
else
  firebase=(npx --yes firebase-tools)
fi

echo "==> Checking Firebase login"
if ! "${firebase[@]}" projects:list >/dev/null 2>&1; then
  echo "Not logged in to Firebase. Run: ${firebase[*]} login" >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "==> Installing dependencies"
  npm ci
fi

if [[ $skip_checks -eq 0 ]]; then
  echo "==> Running checks (typecheck, lint, maps, tests)"
  npm run check
fi

# The deploy build reads its config (Firebase analytics) from .env.prod; see .env.example.
build_args=()
if [[ -f .env.prod ]]; then
  build_args=(-- --mode prod)
else
  echo "Note: no .env.prod (see .env.example); building without analytics."
fi

echo "==> Building"
npm run build "${build_args[@]}"

if [[ -n "$preview" ]]; then
  echo "==> Deploying to preview channel '$preview'"
  "${firebase[@]}" hosting:channel:deploy "$preview" --expires 7d
else
  echo "==> Deploying to live site"
  "${firebase[@]}" deploy --only hosting
fi
