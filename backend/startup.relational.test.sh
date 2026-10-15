#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh postgres:5432
/opt/wait-for-it.sh maildev:1080
/opt/wait-for-it.sh redis:6379
npm install
node test/utils/prepare-test-credentials.cjs
npm run migration:run
./node_modules/.bin/env-cmd -- npm run seed:run:relational
npm run start:dev
