// Trail Rider: a one-shot long-only cbBTC bot for agent-fun/bars-replay/v1.
//
// Idea, in one paragraph: one-minute BTC bars are mostly noise — fast
// trend systems (EMA crosses, Donchian breakouts, RSI mean reversion)
// whipsaw themselves to death on this data, each round trip costing
// ~30 bps in fees, slippage and pool impact. The dev window's whole
// gain is one clean multi-hour rise followed by flat chop, and every
// multi-trade system I backtested against it lost money while a single
// early buy held to the end made +$32. So this bot makes exactly one
// decision: buy everything early, then defend the gain with a trailing
// stop and never trade again. The stop bounds the loss on a falling
// window to roughly the trail width plus one fill, while an up window
// is ridden almost in full.
//
// Rules:
//   - Wait 30 tradable bars (half an hour of closes) so the bot has
//     seen the open, then spend all cash on CBBTC in a single buy.
//     If that buy is rejected, retry on later bars, up to bar 120.
//   - While holding, remember the highest close seen since the fill.
//     Sell the whole position the first time a close prints more than
//     1.2% below that peak. A minute with no bar for CBBTC carries no
//     new price, so it moves neither the peak nor the stop: only bars
//     the batch actually carries count as fresh closes. The peak is
//     seeded from the fill price itself, the price actually paid,
//     rather than the first close reported after it.
//   - After the sell, stay in cash for the rest of the window. There
//     is no re-entry: re-entering after a stop-out is exactly the
//     churn that kills every other design on this data.
//   - No wall clock, no randomness, no environment, no files: the
//     orders are a pure function of the bars received, so two runs on
//     the same data produce the same action log.
//
// Costs: one round trip at full size pays about 4 bps fee + 2 bps
// slippage + ~11 bps of pool impact per side at the dev window's
// median depth, so a trade needs a move well over ~0.3% to pay. The
// 1.2% trail is wide enough that ordinary 1-minute noise (the largest
// close-to-next-open move on the dev window is ~20 bps) never trips
// it, and tight enough that a real reversal costs at most ~1.2% of
// equity plus the fill costs.

import { runBars, type BarsState, type Batch, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
/** Tradable bars to watch before the single entry. */
const ENTRY_AFTER_BARS = 30;
/** Last tradable bar on which a rejected entry may be retried. */
const ENTRY_RETRY_UNTIL_BARS = 120;
/** Sell when a close falls this far below the peak close since entry (bps). */
const TRAIL_BPS = 120;
/** Slippage cap per order, vs the latest close; 1-minute moves on the
 *  dev window never exceed ~20 bps, so 100 bps never binds in practice
 *  and only guards against a freak gap. */
const MAX_SLIPPAGE_BPS = 100;

type Phase = 'wait' | 'sent' | 'hold' | 'done';

let phase: Phase = 'wait';
/** Tradable (non-warm-up) batches answered so far. */
let tradable = 0;
/** Highest close printed while holding, in the bar's own price units. */
let peakClose = 0;

function sellAll(state: BarsState): SellInput[] {
  const held = state.positions.get(SYMBOL);
  if (held === undefined || held.qty === 0n) return [];
  return [{ side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS }];
}

await runBars({
  onBatch(state, batch: Batch) {
    // Fold in what the previous reply's orders did before deciding.
    for (const fill of batch.fills) {
      if (fill.symbol !== SYMBOL) continue;
      if (fill.side === 'buy' && phase === 'sent') {
        if (fill.status === 'filled') {
          phase = 'hold';
          // Seed the peak from the price actually paid (fill.price is
          // in the same price-scale units as a bar's close); closes
          // after it can only raise it.
          peakClose = Number(fill.price);
        } else {
          // Rejected (cash, slippage, no bar): try again while in window.
          phase = 'wait';
        }
      } else if (fill.side === 'sell' && fill.status === 'filled') {
        phase = 'done';
      }
    }

    // Warm-up batches build history only; the replay rejects every
    // order decided on one, so send nothing.
    if (state.warmingUp) return [];
    tradable += 1;

    // A batch with no fresh bar for the symbol carries no new price:
    // fills above are still folded in, but no peak, stop or entry
    // decision may rest on a stale close.
    const fresh = batch.bars.some((bar) => bar.symbol === SYMBOL);
    if (!fresh) return [];
    const close = state.close(SYMBOL);
    if (close === null) return [];
    const price = Number(close);

    if (phase === 'hold') {
      if (price > peakClose) peakClose = price;
      if (price < peakClose * (1 - TRAIL_BPS / 10000)) return sellAll(state);
      return [];
    }

    if (phase === 'wait' && tradable >= ENTRY_AFTER_BARS && tradable <= ENTRY_RETRY_UNTIL_BARS) {
      if (state.cash > 0n) {
        phase = 'sent';
        const buy: BuyInput = {
          side: 'buy',
          symbol: SYMBOL,
          notional_quote_units: state.cash,
          max_slippage_bps: MAX_SLIPPAGE_BPS,
        };
        return [buy];
      }
    }

    return [];
  },
});
