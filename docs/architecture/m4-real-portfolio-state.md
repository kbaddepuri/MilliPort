# M4 — Real Portfolio State

MilliPort now treats the user's broker snapshot as the source of truth for existing positions.

## Imported broker positions

- APH: 20 shares, $79.00 average price
- GOOG: 3.9 shares, $369.230769 average price
- HUBB: 3.3333 shares, $450.004500 average price
- NVDA: 15.015 shares, $175.158175 average price
- POET: 100 shares, $7.19 average price
- POWL: 10 shares, $171.00 average price
- SKHY: 13 shares, $160.769231 average price
- SMCI: 20 shares, $36.65 average price
- SNDK: 0.4057 shares, $1782.105004 average price
- SPCX: 10.2 shares, $173.529412 average price
- VERA: 10 shares, $38.30 average price

The snapshot market value is $16,458.79 and recorded cash is $10, giving a $16,468.79 portfolio baseline.

## Source-of-truth model

Existing positions use exact imported broker quantities. Live quotes determine market value. Average price is retained as the cost basis per share. Manual broker quantities remain supported and take precedence when entered.

The M3 human approval gate remains separate from broker state: approving a recommendation records the MilliPort transaction and updates the tracked position; it does not submit an order to a broker.
