#!/bin/bash

tar czf simple_fxcm.tar.gz app package.json package-lock.json
scp simple_fxcm.tar.gz root@206.189.240.54:/home
rm simple_fxcm.tar.gz

ssh root@206.189.240.54 << 'ENDSSH'
cd /home
rm -rf simple_fxcm
pm2 stop simple_fxcm
mkdir simple_fxcm
tar xf simple_fxcm.tar.gz -C simple_fxcm
rm simple_fxcm.tar.gz
cd simple_fxcm
mkdir temp
npm install
npm run production
ENDSSH