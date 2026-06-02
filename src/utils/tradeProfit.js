/**
 * Single canonical trade profit calculation used by every component.
 *
 * Rules:
 *  - profit_only  → sell_price is the direct P&L
 *  - option closed → isShort ? premium − close : close − premium
 *  - option open, short → premium (full collected premium = realized P&L)
 *  - option open, long  → null  (position still open, cost not realised)
 *  - regular closed     → (sell − buy) × shares
 *  - regular open       → null
 */
export function tradeProfit(trade) {
  // ── Profit-only record ────────────────────────────────────────────────
  if (trade.trade_type === 'profit_only') return Number(trade.sell_price)

  // Legacy profit-only detection (created before trade_type column existed)
  if (
    trade.shares === 1 &&
    Number(trade.buy_price) === 0 &&
    trade.buy_date === trade.sell_date &&
    trade.notes?.includes('Profit-only trade')
  ) {
    return Number(trade.sell_price)
  }

  // ── Option ────────────────────────────────────────────────────────────
  if (trade.trade_type === 'option') {
    const isShort = trade.position_type === 'short'
    const premium = parseFloat(trade.buy_price)

    if (trade.sell_price != null && trade.sell_date) {
      const close = parseFloat(trade.sell_price)
      return isShort ? premium - close : close - premium
    }

    // Open short option (covered call / put sell) → premium is realised P&L
    if (isShort) return premium

    // Open long option → position still active, no realised P&L yet
    return null
  }

  // ── Regular trade ─────────────────────────────────────────────────────
  const isShort = trade.position_type === 'short'
  const hasData = isShort
    ? trade.sell_price && trade.buy_price && trade.sell_date && trade.buy_date
    : trade.sell_price && trade.sell_date

  if (!hasData) return null
  return (Number(trade.sell_price) - Number(trade.buy_price)) * Number(trade.shares)
}

/** True when the trade is considered closed for P&L reporting purposes */
export function isTradeClosed(trade) {
  if (trade.trade_type === 'profit_only') return true
  if (trade.trade_type === 'option') {
    return !!trade.sell_date || trade.position_type === 'short'
  }
  const isShort = trade.position_type === 'short'
  if (isShort) return !!(trade.sell_price && trade.sell_date && trade.buy_price && trade.buy_date)
  return !!(trade.sell_price && trade.sell_date)
}
