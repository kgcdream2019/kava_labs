"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ilp_packet_1 = require("ilp-packet");
const uplink_1 = require("../uplink");
const oer_utils_1 = require("oer-utils");
const crypto_1 = require("../utils/crypto");
const log_1 = __importDefault(require("../utils/log"));
const log = log_1.default('ilp-sdk:stream');
bignumber_js_1.default.config({ EXPONENTIAL_AT: 1e9 }); // Almost never use exponential notation
// TODO Remove this rule... fix this eventually, make better use of RxJS!
/* tslint:disable:no-let */
/** End stream if no packets are successfully fulfilled within this interval */
const IDLE_TIMEOUT = 10000;
/** Amount of time in the future when packets should expire */
const EXPIRATION_WINDOW = 5000;
/**
 * Send money between the two upinks, with the total untrusted
 * amount bounded by the given maxInFlightUsd
 *
 * @param amount Total (maximum) amount to send, in units of exchange of source uplink
 * @param source Source uplink to send outgoing money
 * @param dest Destination uplink to receive incoming money
 * @param slippage Maximum per-packet slippage from latest exchange rate as decimal
 */
exports.streamMoney = (state) => async ({ amount, source, dest, slippage = 0.01 }) => {
    const amountToSend = crypto_rate_utils_1.accountQuantity(crypto_rate_utils_1.exchangeQuantity(source.asset, amount)).amount.decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN);
    /**
     * Why no test packets?
     * 1) While sending BIG packets provide a more precise exchange rate,
     *    if we lose that precision with normal-sized packets due to rounding
     *    anyways, it doesn't matter!
     * 2) Default packet size is based on prefund amount/credit with connector
     * 3) Packet size will automatically be reduced as F08 errors are encountered
     * 4) We assume the connector extends 0 credit
     *
     * But what about getting the exchange rate?
     * - We'd rather hold the connector's rate accountable to our
     *   own price oracle, rather than simply getting a quote from the
     *   connector and ensuring it stays consistent (like in Stream).
     * - So, we compare the exchange rate of each packet to our price oracle,
     *   and use that to determine whether to fulfill it.
     */
    // TODO Move this to uplink.ts so it's more abstracted
    const format = (amount, uplink = source) => `${crypto_rate_utils_1.convert(crypto_rate_utils_1.accountQuantity(uplink.asset, amount), crypto_rate_utils_1.exchangeUnit(uplink.asset))
        .amount} ${uplink.asset.symbol.toLowerCase()}`;
    const sendPacket = async (prepare) => ilp_packet_1.deserializeIlpReply(await source.pluginWrapper.sendData(ilp_packet_1.serializeIlpPrepare(prepare)));
    log.debug(`starting streaming exchange from ${source.asset.symbol} -> ${dest.asset.symbol}`);
    // If no packets get through for 10 seconds, kill the stream
    let fulfilledPacketDeadline;
    const bumpIdle = () => {
        fulfilledPacketDeadline = Date.now() + IDLE_TIMEOUT;
    };
    bumpIdle();
    let prepareCount = 0;
    let fulfillCount = 0;
    let totalFulfilled = new bignumber_js_1.default(0);
    let maxPacketAmount = new bignumber_js_1.default(Infinity);
    const trySendPacket = async () => {
        // TODO Add error for "poor exchange rate" if every (?) error within window was due to an exchange rate problem?
        const isFailing = Date.now() > fulfilledPacketDeadline;
        if (isFailing) {
            log.error('stream timed out: no packets fulfilled within idle window');
            return Promise.reject();
        }
        const remainingAmount = amountToSend.minus(totalFulfilled);
        if (remainingAmount.isZero()) {
            return log.info(`stream succeeded: total amount of ${format(amountToSend)} was fulfilled`);
        }
        else if (remainingAmount.isNegative()) {
            return log.info(`stream sent too much: ${format(remainingAmount.negated())} more was fulfilled above the requested amount of ${format(amountToSend)}`);
        }
        const availableToSend = source.availableToSend$.getValue();
        const remainingToSend = crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.accountQuantity(source.asset, remainingAmount)).amount;
        if (remainingToSend.isGreaterThan(availableToSend)) {
            log.error(`stream failed: insufficient outgoing capacity to fulfill remaining amount of ${format(remainingAmount)}`);
            return Promise.reject();
        }
        // Subtract slippage from incoming capacity in case exchange rate flows in our favor while the swap is in progress
        // (so it fails immediately, rather than midway through)
        const availableToReceive = dest.availableToReceive$.value.times(new bignumber_js_1.default(1).minus(slippage));
        const remainingToReceive = crypto_rate_utils_1.convert(crypto_rate_utils_1.accountQuantity(source.asset, remainingAmount), crypto_rate_utils_1.exchangeUnit(dest.asset), state.rateBackend).amount;
        if (remainingToReceive.isGreaterThan(availableToReceive)) {
            log.error(`stream failed: insufficient incoming capacity to fulfill remaining amount of ${format(remainingAmount)}`);
            return Promise.reject();
        }
        let packetAmount = bignumber_js_1.default.min(source.maxInFlight, remainingAmount, maxPacketAmount);
        // Distribute the remaining amount to send such that the per-packet amount is approximately equal
        const remainingNumPackets = remainingAmount
            .dividedBy(packetAmount)
            .decimalPlaces(0, bignumber_js_1.default.ROUND_CEIL);
        packetAmount = remainingAmount
            .dividedBy(remainingNumPackets)
            .decimalPlaces(0, bignumber_js_1.default.ROUND_CEIL);
        const packetNum = (prepareCount += 1);
        const fulfillment = await crypto_1.generateSecret();
        const executionCondition = crypto_1.sha256(fulfillment);
        const fulfillPacket = {
            fulfillment,
            data: Buffer.alloc(0)
        };
        // Ensure the exchange rate of this packet is within the slippage bounds
        const acceptExchangeRate = (sourceAmount, destAmount) => new bignumber_js_1.default(destAmount).isGreaterThanOrEqualTo(crypto_rate_utils_1.convert(crypto_rate_utils_1.accountQuantity(source.asset, sourceAmount), crypto_rate_utils_1.accountUnit(dest.asset), state.rateBackend)
            .amount.times(new bignumber_js_1.default(1).minus(slippage))
            .integerValue(bignumber_js_1.default.ROUND_CEIL));
        const correctCondition = (someCondition) => executionCondition.equals(someCondition);
        uplink_1.registerPacketHandler(async ({ executionCondition: someCondition, amount: destAmount }) => !acceptExchangeRate(packetAmount, destAmount)
            ? {
                code: 'F04',
                message: 'Poor exchange rate',
                triggeredBy: dest.clientAddress,
                data: Buffer.alloc(0)
            }
            : !correctCondition(someCondition)
                ? {
                    code: 'F06',
                    message: 'Unexpected payment',
                    triggeredBy: dest.clientAddress,
                    data: Buffer.alloc(0)
                }
                : fulfillPacket)(dest);
        // Only send subsequent settlements if the connector settles such that they owe us 0
        const amountOwedToDestUplink = dest.pluginWrapper.receivableBalance$.value;
        if (amountOwedToDestUplink.isLessThanOrEqualTo(0)) {
            // Top up the amount prefunded so it can cover the packet about to be sent
            const additionalPrefundRequired = source.pluginWrapper.payableBalance$.value.plus(packetAmount);
            source.pluginWrapper
                .sendMoney(additionalPrefundRequired.toString())
                .catch(err => log.error('Error during outgoing settlement:', err));
        }
        else {
            log.error(`cannot prefund: destination uplink awaiting settlement for ${format(amountOwedToDestUplink, dest)}`);
        }
        // Send the ILP packet
        log.debug(`sending packet ${packetNum} for ${packetAmount}`);
        const response = await sendPacket({
            destination: dest.clientAddress,
            amount: packetAmount.toString(),
            executionCondition,
            data: Buffer.alloc(0),
            expiresAt: new Date(Date.now() + EXPIRATION_WINDOW)
        });
        if (ilp_packet_1.isReject(response)) {
            const { code, data } = response;
            log.debug(`packet ${packetNum} rejected with ${code}`);
            // Handle "amount too large" errors
            if (code === 'F08') {
                const reader = oer_utils_1.Reader.from(data);
                // TODO This is slow. Switch to Long per oer-utils update?
                const foreignReceivedAmount = reader.readUInt64BigNum();
                const foreignMaxPacketAmount = reader.readUInt64BigNum();
                /**
                 * Since the data in the reject are in units we're not familiar with,
                 * we can determine the exchange rate via (source amount / dest amount),
                 * then convert the foreign max packet amount into native units
                 */
                const newMaxPacketAmount = packetAmount
                    .times(foreignMaxPacketAmount)
                    .dividedToIntegerBy(foreignReceivedAmount);
                // As we encounter more F08s, max packet amount should never increase!
                if (newMaxPacketAmount.isGreaterThanOrEqualTo(packetAmount)) {
                    log.error('unexpected amount too large error: sent less than the max packet amount');
                }
                else if (newMaxPacketAmount.isLessThan(packetAmount)) {
                    log.debug(`reducing packet amount from ${packetAmount} to ${newMaxPacketAmount}`);
                    maxPacketAmount = newMaxPacketAmount;
                }
            }
        }
        else if (ilp_packet_1.isFulfill(response)) {
            log.debug(`packet ${packetNum} fulfilled for source amount ${format(packetAmount)}`);
            bumpIdle();
            totalFulfilled = totalFulfilled.plus(packetAmount);
            fulfillCount += 1;
        }
        uplink_1.deregisterPacketHandler(dest);
        return trySendPacket();
    };
    return trySendPacket().finally(() => {
        uplink_1.deregisterPacketHandler(dest);
        log.debug(`stream ended: ${fulfillCount} packets fulfilled of ${prepareCount} total packets`);
    });
};
//# sourceMappingURL=switch.js.map