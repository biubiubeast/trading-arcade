#!/usr/bin/env bash
set -euo pipefail
umask 077
SOURCE_ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
APP_ROOT="${TRADEGAMES_APP_ROOT:-${HOME}/apps/tradegames}"
mkdir -p "$APP_ROOT"
exec 9>"$APP_ROOT/deploy.lock"
flock -n 9 || { echo 'Another tradegames deployment is running' >&2; exit 1; }
export TRADEGAMES_APP_ROOT="$APP_ROOT"
cd "$SOURCE_ROOT"
exec node ubuntu/deploy.mjs
