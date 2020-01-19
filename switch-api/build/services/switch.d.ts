import BigNumber from 'bignumber.js';
import { ReadyUplinks } from '../uplink';
import { State } from '..';
export interface StreamMoneyOpts {
    /** Amount of money to be sent over stream, in units of exchange */
    readonly amount: BigNumber;
    /** Send assets via the given source ledger/plugin */
    readonly source: ReadyUplinks;
    /** Receive assets via the given destination ledger/plugin */
    readonly dest: ReadyUplinks;
    /**
     * Maximum percentage of slippage allowed. If the per-packet exchange rate
     * drops below the price oracle's rate minus this slippage,
     * the packet will be rejected
     */
    readonly slippage?: BigNumber.Value;
}
/**
 * Send money between the two upinks, with the total untrusted
 * amount bounded by the given maxInFlightUsd
 *
 * @param amount Total (maximum) amount to send, in units of exchange of source uplink
 * @param source Source uplink to send outgoing money
 * @param dest Destination uplink to receive incoming money
 * @param slippage Maximum per-packet slippage from latest exchange rate as decimal
 */
export declare const streamMoney: (state: State) => ({ amount, source, dest, slippage }: StreamMoneyOpts) => Promise<void>;
