#!/bin/bash

set -euxo pipefail

# build the sushi package from sushiswap monorepo submodule
git submodule update --init --recursive
(cd lib/sushiswap && pnpm install --frozen-lockfile)
(cd lib/sushiswap && pnpm exec turbo run build --filter=./packages/sushi) 