#!/bin/sh
# Steady background traffic through Nginx: three customers sign in, look at their accounts and pass
# one dollar around in a circle (so balances stay level). Roughly 4 requests a second.
BASE="${BASE:-http://nginx}"
JSON="content-type: application/json"

call() { curl -s -o /dev/null --max-time 10 "$@"; }

turn() { # user, from account, payee
  jar="/tmp/$1.jar"
  call -c "$jar" -H "$JSON" -d "{\"email\":\"$1@demobank.test\",\"password\":\"demo1234\"}" "$BASE/api/login"
  call -b "$jar" "$BASE/api/me"
  call -b "$jar" "$BASE/api/accounts"
  call -b "$jar" -H "$JSON" -d "{\"fromAccountId\":\"$2\",\"payeeId\":\"$3\",\"amount\":1,\"note\":\"loadgen\"}" "$BASE/api/transfer"
}

while true; do
  turn amina a1 p-u2
  turn brian a3 p-u3
  turn chloe a5 p-u1
  sleep 2
done
