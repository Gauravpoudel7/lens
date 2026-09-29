#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
exec node scripts/docker-entry.mjs
