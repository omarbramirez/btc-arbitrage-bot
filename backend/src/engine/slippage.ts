import type { PriceLevel, SlippageResult } from '../types/index.js';

/**
 * Simulates consuming liquidity from an order book to fill a target volume.
 * Returns the volume-weighted average price (VWAP) and partial fill info.
 *
 * @param levels  - Sorted price levels: asks ascending (for buying), bids descending (for selling)
 * @param targetVolume - BTC volume to fill
 */
export function calculateSlippage(
  levels: PriceLevel[],
  targetVolume: number
): SlippageResult {
  if (levels.length === 0 || targetVolume <= 0) {
    return {
      weightedAvgPrice: 0,
      filledVolume: 0,
      remainingVolume: targetVolume,
      partial: true,
    };
  }

  let remainingVolume = targetVolume;
  let totalCost = 0;
  let filledVolume = 0;

  for (const [price, qty] of levels) {
    if (remainingVolume <= 0) break;

    const fillQty = Math.min(qty, remainingVolume);
    totalCost += price * fillQty;
    filledVolume += fillQty;
    remainingVolume -= fillQty;
  }

  const weightedAvgPrice = filledVolume > 0 ? totalCost / filledVolume : 0;

  return {
    weightedAvgPrice,
    filledVolume,
    remainingVolume,
    partial: remainingVolume > 1e-8, // float tolerance
  };
}

/**
 * Calculates the net profit/loss in USD for a proposed arbitrage.
 *
 * @param buyVwap    - Effective buy price (after slippage)
 * @param sellVwap   - Effective sell price (after slippage)
 * @param volume     - Filled BTC volume
 * @param buyFeeRate - Decimal buy fee, e.g. 0.001 = 0.1%
 * @param sellFeeRate - Decimal sell fee
 * @returns Object with costs, revenues, fees, and net profit
 */
export function calcNetProfit(
  buyVwap: number,
  sellVwap: number,
  volume: number,
  buyFeeRate: number,
  sellFeeRate: number
): { buyFeeUsd: number; sellFeeUsd: number; netProfitUsd: number; netProfitPct: number } {
  const totalBuyCost = buyVwap * volume;
  const buyFeeUsd = totalBuyCost * buyFeeRate;
  const effectiveCost = totalBuyCost + buyFeeUsd;

  const totalSellRevenue = sellVwap * volume;
  const sellFeeUsd = totalSellRevenue * sellFeeRate;
  const effectiveRevenue = totalSellRevenue - sellFeeUsd;

  const netProfitUsd = effectiveRevenue - effectiveCost;
  const netProfitPct = effectiveCost > 0 ? (netProfitUsd / effectiveCost) * 100 : 0;

  return { buyFeeUsd, sellFeeUsd, netProfitUsd, netProfitPct };
}
