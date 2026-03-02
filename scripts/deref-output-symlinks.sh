#!/bin/bash
# Nitro creates symlinks in .output/server/node_modules/ that point to
# .nitro/<pkg>@<version>/.  npm pack strips symlinks, which breaks
# production deployments.  Replace each symlink with a real copy.
set -e

DIR=".output/server/node_modules"
if [ ! -d "$DIR" ]; then
  exit 0
fi

find "$DIR" -maxdepth 3 -type l | while read -r link; do
  target=$(readlink -f "$link")
  rm "$link"
  cp -r "$target" "$link"
done

echo "Dereferenced symlinks in $DIR"
