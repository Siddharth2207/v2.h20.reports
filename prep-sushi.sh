#!/bin/bash

set -euxo pipefail

pnpm -v
git submodule update --init --recursive

(cd lib/sushiswap && pnpm install)
(cd lib/sushiswap && pnpm exec turbo run build --filter=./packages/sushi) 