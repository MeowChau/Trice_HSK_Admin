#!/usr/bin/env bash
set -e

/opt/wait-for-it.sh mongo:27017
/opt/wait-for-it.sh maildev:1080
npm install
node test/utils/prepare-test-credentials.cjs
./node_modules/.bin/env-cmd -- npm run seed:run:document
npm run start:dev
