#!/bin/sh
# Packs paceifier, installs the tarball into a temporary app and runs the
# runtime checks there with node, deno or bun, the way users would import it.
# Usage: test/runtimes/run.sh <node|deno|bun>
set -e
runtime=${1:-node}
here=$(cd "$(dirname "$0")" && pwd)
app=$(mktemp -d)
trap 'rm -rf "$app"' EXIT

tarball=$(cd "$here/../.." && npm pack --silent --pack-destination "$app")
cp "$here/smoke.cjs" "$here/esm.mjs" "$app"
cd "$app"
echo '{ "name": "app", "private": true }' > package.json
npm install --silent --no-audit --no-fund "./$tarball"

case "$runtime" in
	deno) run="deno run --allow-read --allow-env" ;;
	bun) run="bun" ;;
	*) run="node" ;;
esac
$run smoke.cjs
$run esm.mjs
