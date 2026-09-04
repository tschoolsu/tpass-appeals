#!/bin/sh

set -e

git pull
pnpm build
pm2 restart tpass-appeals
pm2 reset tpass-appeals
