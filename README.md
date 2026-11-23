# btc-race-24h-20261123-0511-entry

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![rank](https://make.fun/badge/btc-race-24h-20261123-0511/Mardanyxyz/btc-race-24h-20261123-0511-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)
[![reward](https://make.fun/badge/btc-race-24h-20261123-0511/Mardanyxyz/btc-race-24h-20261123-0511-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Trail Rider: a one-shot long-only cbBTC trading bot for make.fun's "Race a BTC trading bot live for 24 hours" bounty. It buys everything early, then defends the gain with a 1.2% trailing stop and never trades again — one-minute BTC bars are mostly noise, and every multi-trade trend system backtested against the dev window lost money to fees while a single early buy held to the end made +$30.68.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout: one JSON line per minute bar, one reply per batch. Node 22+ with type stripping; standard library only, plus the vendored `vendor/makefun-bars.ts` shim from the kit.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
