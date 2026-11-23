#!/bin/sh
# bun run greeting <customer> [--customers <dir>]: compose the customer's workshop picture, write
# its score, render, master, and take the poster (the frame at 62.6 s over the greeting band)
export HYPERFRAMES_NO_TELEMETRY=1 DO_NOT_TRACK=1
usage() { echo "usage: bun run greeting <customer> [--customers <dir>] (customer: a-z, 0-9 and -)" >&2; exit 2; }
n=$1
# the name becomes file names under renders/: no path, no dots, no leading "-" (an option)
case $n in '' | -* | *[!abcdefghijklmnopqrstuvwxyz0123456789-]*) usage ;; esac
d=${GREETING_CUSTOMERS:-greeting/customers}
case $#:$2 in
1:) ;;
3:--customers) [ -n "$3" ] || usage; d=$3 ;;
*) usage ;;
esac
GREETING_CUSTOMERS=$(CDPATH= cd -- "$d" && pwd) || exit 1
export GREETING_CUSTOMERS
set -e
# bun makes the link, a junction on Windows, where Git Bash's ln -s copies the folder as it is now
bun -e 'const fs = require("node:fs"); fs.rmSync("greeting/customer", { force: true }); fs.symlinkSync(process.env.GREETING_CUSTOMERS, "greeting/customer", "junction")'
bun scripts/brand.mjs
bun scripts/workshop.mjs compose "$n"
bun scripts/score.mjs "$n"
hyperframes render greeting --experimental-fast-capture=false --variables-file "$GREETING_CUSTOMERS/$n.json" \
  --strict-variables --output "renders/$n.raw.mp4"
bun scripts/master.mjs "renders/$n.raw.mp4" "renders/$n.mp4"
rm "renders/$n.raw.mp4"
ffmpeg -v error -y -ss 62.6 -i "renders/$n.mp4" -i "renders/$n.mp4" -filter_complex \
  "[0:v]trim=end_frame=1[a];[1:v]trim=end_frame=1,crop=1920:180:0:900[b];[a][b]vstack" \
  -frames:v 1 "renders/$n.png"
