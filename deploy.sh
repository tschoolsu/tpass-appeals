#!/bin/sh

set -e

git pull
pnpm build
pm2 restart appeals
pm2 reset appeals
