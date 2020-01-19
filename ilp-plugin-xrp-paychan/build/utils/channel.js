"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const crypto_1 = require("crypto");
const ilp_logger_1 = __importDefault(require("ilp-logger"));
const libsodium_wrappers_1 = __importDefault(require("libsodium-wrappers"));
const account_1 = require("../account");
const addressCodec = require('ripple-address-codec');
const log = ilp_logger_1.default('ilp-plugin-xrp:tx-submitter');
exports.deserializePaymentChannel = (channel) => ({
    ...channel,
    disputeDelay: new bignumber_js_1.default(channel.disputeDelay),
    expiresAt: channel.expiresAt
        ? new bignumber_js_1.default(channel.expiresAt)
        : channel.expiresAt,
    value: new bignumber_js_1.default(channel.value),
    balance: new bignumber_js_1.default(channel.balance),
    spent: new bignumber_js_1.default(channel.spent)
});
exports.updateChannel = async (api, cachedChannel) => exports.fetchChannel(api, cachedChannel.channelId)
    .then(updatedChannel => updatedChannel && {
    ...cachedChannel,
    ...updatedChannel,
    spent: cachedChannel.spent,
    signature: cachedChannel.signature
})
    .catch(() => cachedChannel);
exports.fetchChannel = (api, channelId) => api
    .getPaymentChannel(channelId)
    .then(channel => {
    const { account, destination, amount, balance, settleDelay, expiration, cancelAfter, publicKey } = channel;
    const disputeExpiration = expiration ? Date.parse(expiration) : Infinity;
    const immutableExpiration = cancelAfter
        ? Date.parse(cancelAfter)
        : Infinity;
    const expiresAt = bignumber_js_1.default.min(disputeExpiration, immutableExpiration);
    return {
        lastUpdated: Date.now(),
        channelId,
        receiver: destination,
        sender: account,
        publicKey,
        disputeDelay: new bignumber_js_1.default(settleDelay),
        expiresAt: expiresAt.isEqualTo(Infinity) ? undefined : expiresAt,
        balance: crypto_rate_utils_1.convert(crypto_rate_utils_1.xrp(balance), crypto_rate_utils_1.drop()).decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN),
        value: crypto_rate_utils_1.convert(crypto_rate_utils_1.xrp(amount), crypto_rate_utils_1.drop()).decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN),
        spent: new bignumber_js_1.default(0)
    };
})
    .catch(err => {
    if (err.message === 'entryNotFound') {
        return undefined;
    }
    else {
        throw err;
    }
});
exports.sendTransaction = async (txJSON, api, xrpSecret) => {
    const { id, signedTransaction } = api.sign(txJSON, xrpSecret);
    await api.submit(signedTransaction);
    const checkForTx = (attempts = 0) => api
        .getTransaction(id)
        .then(({ outcome }) => {
        if (outcome.result !== 'tesSUCCESS') {
            log.error(`Transaction ${id} failed: ${outcome.result}`);
            throw new Error(outcome.result);
        }
        log.debug(`Transaction ${id} was included in a validated ledger`);
        return outcome;
    })
        .catch(async (err) => {
        if (attempts > 50) {
            log.debug(`Failed to verify transaction, despite several attempts: ${err.message}`);
            throw err;
        }
        const shouldRetry = err instanceof api.errors.MissingLedgerHistoryError ||
            err instanceof api.errors.NotFoundError;
        if (shouldRetry) {
            await account_1.delay(200);
            return checkForTx(attempts + 1);
        }
        throw err;
    });
    return checkForTx();
};
exports.computeChannelId = (senderAddress, receiverAddress, sequence) => {
    const sequenceBuffer = Buffer.alloc(4);
    sequenceBuffer.writeUInt32BE(sequence, 0);
    const preimage = Buffer.concat([
        Buffer.from('\0x', 'ascii'),
        Buffer.from(addressCodec.decodeAccountID(senderAddress)),
        Buffer.from(addressCodec.decodeAccountID(receiverAddress)),
        sequenceBuffer
    ]);
    return crypto_1.createHash('sha512')
        .update(preimage)
        .digest()
        .slice(0, 32)
        .toString('hex')
        .toUpperCase();
};
exports.hasClaim = (channel) => !!channel && !!channel.signature;
exports.spentFromChannel = (channel) => channel ? channel.spent : new bignumber_js_1.default(0);
exports.remainingInChannel = (channel) => channel ? channel.value.minus(channel.spent) : new bignumber_js_1.default(0);
exports.isDisputed = (channel) => !!channel.expiresAt;
exports.isValidClaimSignature = (claim, channel) => libsodium_wrappers_1.default.crypto_sign_verify_detached(Buffer.from(claim.signature, 'hex'), exports.createClaimDigest(claim.channelId, claim.value), Buffer.from(channel.publicKey.substring(2), 'hex'));
const MAX_U32 = '4294967296';
const MAX_U64 = '18446744073709551616';
const toU64BE = (n) => {
    const bn = new bignumber_js_1.default(n);
    if (bn.lt(0) || bn.gte(MAX_U64)) {
        throw new Error('number out of range for u64. n=' + n);
    }
    const buf = Buffer.alloc(8);
    const high = bn.dividedBy(MAX_U32);
    const low = bn.modulo(MAX_U32);
    buf.writeUInt32BE(high.toNumber(), 0);
    buf.writeUInt32BE(low.toNumber(), 4);
    return buf;
};
exports.createClaimDigest = (channelId, value) => Buffer.concat([
    Buffer.from('CLM\0'),
    Buffer.from(channelId, 'hex'),
    toU64BE(value)
]);
//# sourceMappingURL=channel.js.map