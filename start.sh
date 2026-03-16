#!/bin/bash

node server.js &
node start-worker.js

wait