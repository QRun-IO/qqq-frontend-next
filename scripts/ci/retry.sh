#!/usr/bin/env bash
# Copyright 2026 QRun.IO, Inc.
# Licensed under the Apache License, Version 2.0.
# https://www.apache.org/licenses/LICENSE-2.0
set -euo pipefail

if [[ $# -lt 2 || ! $1 =~ ^[1-9][0-9]*$ ]]; then
   echo 'Usage: retry.sh <attempts> <command...>' >&2
   exit 2
fi
attempts=$1
shift
delays=(15 45 120)
for ((attempt = 1; attempt <= attempts; attempt++)); do
   # stderr keeps command substitution (e.g. Maven version output) clean.
   echo "Attempt $attempt/$attempts" >&2
   if "$@"; then
      exit 0
   else
      status=$?
   fi
   if ((attempt < attempts)); then
      index=$((attempt - 1))
      if ((index > 2)); then index=2; fi
      sleep "${delays[$index]}"
   fi
done
exit "$status"
