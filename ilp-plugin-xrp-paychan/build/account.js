"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const btp_packet_1 = require("btp-packet");
const crypto_1 = require("crypto");
const ilp_packet_1 = require("ilp-packet");
const libsodium_wrappers_1 = __importDefault(require("libsodium-wrappers"));
const schema_validator_1 = require("ripple-lib/dist/npm/common/schema-validator");
const util_1 = require("util");
const channel_1 = require("./utils/channel");
const queue_1 = __importDefault(require("./utils/queue"));
bignumber_js_1.default.config({ EXPONENTIAL_AT: 1e9 });
const CHANNEL_KEY_STRING = 'ilp-plugin-xrp-paychan-channel';
const hmac = (key, message) => crypto_1.createHmac('sha256', key)
    .update(message)
    .digest();
const getBtpSubprotocol = (message, name) => message.data.protocolData.find((p) => p.protocolName === name);
exports.generateBtpRequestId = async () => (await util_1.promisify(crypto_1.randomBytes)(4)).readUInt32BE(0);
exports.delay = (timeout) => new Promise(r => setTimeout(r, timeout));
exports.format = (num) => crypto_rate_utils_1.convert(num, crypto_rate_utils_1.xrp()) + ' xrp';
var IncomingTaskPriority;
(function (IncomingTaskPriority) {
    IncomingTaskPriority[IncomingTaskPriority["ClaimChannel"] = 1] = "ClaimChannel";
    IncomingTaskPriority[IncomingTaskPriority["ValidateClaim"] = 0] = "ValidateClaim";
})(IncomingTaskPriority || (IncomingTaskPriority = {}));
class XrpAccount {
    constructor({ accountName, accountData, master, sendMessage, dataHandler, moneyHandler }) {
        this.validateClaim = (claim) => async (cachedChannel, attempts = 0) => {
            const shouldFetchChannel = !cachedChannel ||
                new bignumber_js_1.default(claim.value).isGreaterThan(cachedChannel.value);
            const updatedChannel = shouldFetchChannel
                ? await channel_1.fetchChannel(this.master._api, claim.channelId)
                : cachedChannel;
            if (!cachedChannel) {
                if (!updatedChannel) {
                    if (attempts > 20) {
                        this.master._log.debug(`Invalid claim: channel ${claim.channelId} doesn't exist, despite several attempts to refresh channel state`);
                        return cachedChannel;
                    }
                    await exports.delay(250);
                    return this.validateClaim(claim)(cachedChannel, attempts + 1);
                }
                const amReceiver = updatedChannel.receiver === this.master._xrpAddress;
                if (!amReceiver) {
                    this.master._log.debug(`Invalid claim: the recipient for new channel ${claim.channelId} is not ${this.master._xrpAddress}`);
                    return cachedChannel;
                }
                if (channel_1.isDisputed(updatedChannel)) {
                    this.master._log.debug(`Invalid claim: new channel ${claim.channelId} has fixed expiration or the dispute period has already began`);
                    return cachedChannel;
                }
                const isAboveMinDisputePeriod = updatedChannel.disputeDelay.isGreaterThanOrEqualTo(this.master._minIncomingDisputePeriod);
                if (!isAboveMinDisputePeriod) {
                    this.master._log.debug(`Invalid claim: new channel ${claim.channelId} has dispute period of ${updatedChannel.disputeDelay} seconds, below floor of ${this.master._minIncomingDisputePeriod} seconds`);
                    return cachedChannel;
                }
            }
            else {
                if (!updatedChannel) {
                    this.master._log.error(`Invalid claim: channel is unexpectedly closed`);
                    return cachedChannel;
                }
                const wrongChannel = claim.channelId !== cachedChannel.channelId;
                if (wrongChannel) {
                    this.master._log.debug('Invalid claim: channel is not the previously linked channel');
                    return cachedChannel;
                }
            }
            const hasNegativeValue = new bignumber_js_1.default(claim.value).isNegative();
            if (hasNegativeValue) {
                this.master._log.error(`Invalid claim: value is negative`);
                return cachedChannel;
            }
            const isSigned = channel_1.isValidClaimSignature(claim, updatedChannel);
            if (!isSigned) {
                this.master._log.debug('Invalid claim: signature is invalid');
                return cachedChannel;
            }
            const sufficientChannelValue = updatedChannel.value.isGreaterThanOrEqualTo(claim.value);
            if (!sufficientChannelValue) {
                if (attempts > 20) {
                    this.master._log.debug(`Invalid claim: value of ${exports.format(crypto_rate_utils_1.drop(claim.value))} is above value of channel, despite several attempts to refresh channel state`);
                    return cachedChannel;
                }
                await exports.delay(250);
                return this.validateClaim(claim)(cachedChannel, attempts + 1);
            }
            if (!cachedChannel) {
                const channelKey = `${claim.channelId}:incoming-channel`;
                await this.master._store.load(channelKey);
                const linkedAccount = this.master._store.get(channelKey);
                if (typeof linkedAccount === 'string') {
                    this.master._log.debug(`Invalid claim: channel ${claim.channelId} is already linked to a different account`);
                    return cachedChannel;
                }
                this.master._store.set(channelKey, this.account.accountName);
                this.master._log.debug(`Incoming channel ${claim.channelId} is now linked to account ${this.account.accountName}`);
            }
            const claimIncrement = bignumber_js_1.default.min(claim.value, updatedChannel.value).minus(cachedChannel ? cachedChannel.spent : 0);
            const isBestClaim = claimIncrement.gt(0);
            if (!isBestClaim && cachedChannel) {
                this.master._log.debug(`Invalid claim: value of ${exports.format(crypto_rate_utils_1.drop(claim.value))} is less than previous claim for ${exports.format(crypto_rate_utils_1.drop(updatedChannel.spent))}`);
                return cachedChannel;
            }
            if (isBestClaim) {
                this.account.receivableBalance = this.account.receivableBalance.minus(claimIncrement);
                await this.moneyHandler(claimIncrement.toString());
            }
            this.master._log.debug(`Accepted incoming claim from account ${this.account.accountName} for ${exports.format(crypto_rate_utils_1.drop(claimIncrement))}`);
            if (!this.watcher) {
                this.watcher = this.startChannelWatcher();
            }
            return {
                ...updatedChannel,
                channelId: claim.channelId,
                signature: claim.signature,
                spent: new bignumber_js_1.default(claim.value)
            };
        };
        this.refreshChannel = (channelOrId, predicate) => async (attempts = 0) => {
            if (attempts > 20) {
                throw new Error('Unable to confirm updated channel state after 20 attempts despite 1 block confirmation');
            }
            const updatedChannel = typeof channelOrId === 'string'
                ? (await channel_1.fetchChannel(this.master._api, channelOrId).catch(() => undefined))
                : await channel_1.updateChannel(this.master._api, channelOrId);
            return predicate(updatedChannel)
                ?
                    updatedChannel
                :
                    exports.delay(1000).then(() => this.refreshChannel(channelOrId, predicate)(attempts + 1));
        };
        this.master = master;
        this.sendMessage = sendMessage;
        this.dataHandler = dataHandler;
        this.moneyHandler = moneyHandler;
        this.account = new Proxy(accountData, {
            set: (account, key, val) => {
                this.persistAccountData();
                return Reflect.set(account, key, val);
            }
        });
        this.account.incoming.on('data', () => this.persistAccountData());
        this.account.outgoing.on('data', () => this.persistAccountData());
        this.watcher = this.startChannelWatcher();
        const { privateKey, publicKey } = libsodium_wrappers_1.default.crypto_sign_seed_keypair(hmac(this.master._xrpSecret, CHANNEL_KEY_STRING + accountName));
        this.privateKey = privateKey;
        this.publicKey =
            'ED' +
                Buffer.from(publicKey)
                    .toString('hex')
                    .toUpperCase();
        if (!this.account.xrpAddress) {
            this.autoFundOutgoingChannel().catch(err => {
                this.master._log.error('Error attempting to auto fund outgoing channel: ', err);
            });
        }
    }
    persistAccountData() {
        this.master._store.set(`${this.account.accountName}:account`, this.account);
    }
    async fetchXrpAddress() {
        if (typeof this.account.xrpAddress === 'string')
            return;
        try {
            const response = await this.sendMessage({
                type: btp_packet_1.TYPE_MESSAGE,
                requestId: await exports.generateBtpRequestId(),
                data: {
                    protocolData: [
                        {
                            protocolName: 'info',
                            contentType: btp_packet_1.MIME_APPLICATION_JSON,
                            data: Buffer.from(JSON.stringify({
                                xrpAddress: this.master._xrpAddress
                            }))
                        }
                    ]
                }
            });
            const info = response.protocolData.find((p) => p.protocolName === 'info');
            if (info) {
                this.linkXrpAddress(info);
            }
            else {
                this.master._log.debug(`Failed to link XRP address: BTP response did not include any 'info' subprotocol data`);
            }
        }
        catch (err) {
            this.master._log.debug(`Failed to exchange XRP addresses: ${err.message}`);
        }
    }
    linkXrpAddress(info) {
        try {
            const { xrpAddress } = JSON.parse(info.data.toString());
            if (typeof xrpAddress !== 'string') {
                return this.master._log.debug(`Failed to link XRP address: invalid response, no address provided`);
            }
            if (!schema_validator_1.isValidAddress(xrpAddress)) {
                return this.master._log.debug(`Failed to link XRP address: not a valid address`);
            }
            const currentAddress = this.account.xrpAddress;
            if (currentAddress) {
                if (currentAddress.toLowerCase() === xrpAddress.toLowerCase()) {
                    return;
                }
                return this.master._log.debug(`Cannot link XRP address ${xrpAddress} to ${this.account.accountName}: ${currentAddress} is already linked for the lifetime of the account`);
            }
            this.account.xrpAddress = xrpAddress;
            this.master._log.debug(`Successfully linked XRP address ${xrpAddress} to ${this.account.accountName}`);
        }
        catch (err) {
            this.master._log.debug(`Failed to link XRP address: ${err.message}`);
        }
    }
    async fundOutgoingChannel(value, authorize = () => Promise.resolve()) {
        await this.account.outgoing.add(cachedChannel => cachedChannel
            ? this.depositToChannel(cachedChannel, value, authorize)
            : this.openChannel(value, authorize));
    }
    async autoFundOutgoingChannel() {
        await this.account.outgoing.add(async (cachedChannel) => {
            const requiresTopUp = !cachedChannel ||
                channel_1.remainingInChannel(cachedChannel).isLessThan(this.master._outgoingChannelAmount.dividedBy(2));
            const incomingChannel = this.account.incoming.state;
            const sufficientIncoming = (incomingChannel
                ? incomingChannel.value
                : new bignumber_js_1.default(0)).isGreaterThanOrEqualTo(this.master._minIncomingChannelAmount);
            if (requiresTopUp && sufficientIncoming) {
                return cachedChannel
                    ? this.depositToChannel(cachedChannel, this.master._outgoingChannelAmount)
                    : this.openChannel(this.master._outgoingChannelAmount);
            }
            return cachedChannel;
        });
    }
    async openChannel(value, authorize = () => Promise.resolve()) {
        await this.fetchXrpAddress();
        if (!this.account.xrpAddress) {
            this.master._log.debug('Failed to open channel: no XRP address is linked');
            return;
        }
        const fundAmount = crypto_rate_utils_1.convert(crypto_rate_utils_1.drop(value), crypto_rate_utils_1.xrp()).toFixed(6, bignumber_js_1.default.ROUND_DOWN);
        const instructions = await this.master._queueTransaction(async () => {
            const { txJSON, instructions } = await this.master._api.preparePaymentChannelCreate(this.master._xrpAddress, {
                amount: fundAmount,
                destination: this.account.xrpAddress,
                settleDelay: this.master._outgoingDisputePeriod.toNumber(),
                publicKey: this.publicKey
            });
            const txFee = new bignumber_js_1.default(instructions.fee);
            await authorize(txFee);
            this.master._log.debug(`Opening channel for ${exports.format(crypto_rate_utils_1.drop(value))} and fee of ${exports.format(crypto_rate_utils_1.xrp(txFee))}`);
            await channel_1.sendTransaction(txJSON, this.master._api, this.master._xrpSecret);
            return instructions;
        });
        const channelId = channel_1.computeChannelId(this.master._xrpAddress, this.account.xrpAddress, instructions.sequence);
        const newChannel = await this.refreshChannel(channelId, (channel) => !!channel)();
        const signedChannel = this.signClaim(new bignumber_js_1.default(0), newChannel);
        this.sendClaim(signedChannel).catch(err => this.master._log.error('Error sending proof-of-channel to peer: ', err));
        this.master._log.debug(`Successfully opened channel for ${exports.format(crypto_rate_utils_1.drop(value))}`);
        return signedChannel;
    }
    async depositToChannel(channel, value, authorize = () => Promise.resolve()) {
        this.depositQueue = new queue_1.default(channel);
        this.depositQueue
            .add(this.createClaim.bind(this))
            .catch(err => this.master._log.error('Error queuing task to create new claim:', err));
        try {
            const totalNewValue = channel.value.plus(value);
            const isDepositSuccessful = (updatedChannel) => !!updatedChannel && updatedChannel.value.isEqualTo(totalNewValue);
            const fundAmount = crypto_rate_utils_1.convert(crypto_rate_utils_1.drop(value), crypto_rate_utils_1.xrp()).toFixed(6, bignumber_js_1.default.ROUND_DOWN);
            await this.master._queueTransaction(async () => {
                const { txJSON, instructions } = await this.master._api.preparePaymentChannelFund(this.master._xrpAddress, {
                    channel: channel.channelId,
                    amount: fundAmount
                });
                const txFee = new bignumber_js_1.default(instructions.fee);
                await authorize(txFee);
                this.master._log.debug(`Depositing ${exports.format(crypto_rate_utils_1.drop(value))} to channel for fee of ${exports.format(crypto_rate_utils_1.xrp(txFee))}`);
                await channel_1.sendTransaction(txJSON, this.master._api, this.master._xrpSecret);
            });
            const updatedChannel = await this.refreshChannel(channel, isDepositSuccessful)();
            this.master._log.debug('Informing peer of channel top-up');
            this.sendMessage({
                type: btp_packet_1.TYPE_MESSAGE,
                requestId: await exports.generateBtpRequestId(),
                data: {
                    protocolData: [
                        {
                            protocolName: 'channelDeposit',
                            contentType: btp_packet_1.MIME_APPLICATION_OCTET_STREAM,
                            data: Buffer.alloc(0)
                        }
                    ]
                }
            }).catch(err => {
                this.master._log.error('Error informing peer of channel deposit:', err);
            });
            this.master._log.debug(`Successfully deposited ${exports.format(crypto_rate_utils_1.drop(value))} to channel ${channel.channelId} for total value of ${exports.format(crypto_rate_utils_1.drop(totalNewValue))}`);
            const bestClaim = this.depositQueue.clear();
            delete this.depositQueue;
            const forkedState = await bestClaim;
            return forkedState
                ? {
                    ...updatedChannel,
                    signature: forkedState.signature,
                    spent: forkedState.spent
                }
                : updatedChannel;
        }
        catch (err) {
            this.master._log.error(`Failed to deposit to channel:`, err);
            const bestClaim = this.depositQueue.clear();
            delete this.depositQueue;
            return bestClaim;
        }
    }
    async sendMoney(amount) {
        const amountToSend = amount || bignumber_js_1.default.max(0, this.account.payableBalance);
        this.account.payoutAmount = this.account.payoutAmount.plus(amountToSend);
        this.depositQueue
            ? await this.depositQueue.add(this.createClaim.bind(this))
            : await this.account.outgoing.add(this.createClaim.bind(this));
    }
    async createClaim(cachedChannel) {
        this.autoFundOutgoingChannel().catch(err => this.master._log.error('Error attempting to auto fund outgoing channel: ', err));
        const settlementBudget = this.account.payoutAmount;
        if (settlementBudget.isLessThanOrEqualTo(0)) {
            return cachedChannel;
        }
        if (!cachedChannel) {
            this.master._log.debug(`Cannot send claim: no channel is open`);
            return cachedChannel;
        }
        if (!channel_1.remainingInChannel(cachedChannel).isGreaterThan(0)) {
            this.master._log.debug(`Cannot send claim to: no remaining funds in outgoing channel`);
            return cachedChannel;
        }
        const claimIncrement = bignumber_js_1.default.min(channel_1.remainingInChannel(cachedChannel), settlementBudget);
        this.master._log.info(`Settlement attempt triggered with ${this.account.accountName}`);
        const value = channel_1.spentFromChannel(cachedChannel).plus(claimIncrement);
        const updatedChannel = this.signClaim(value, cachedChannel);
        this.master._log.debug(`Sending claim for total of ${exports.format(crypto_rate_utils_1.drop(value))}, incremented by ${exports.format(crypto_rate_utils_1.drop(claimIncrement))}`);
        this.sendClaim(updatedChannel).catch(err => this.master._log.debug(`Error while sending claim to peer: ${err.message}`));
        this.account.payableBalance = this.account.payableBalance.minus(claimIncrement);
        this.account.payoutAmount = bignumber_js_1.default.min(0, this.account.payoutAmount.minus(claimIncrement));
        return updatedChannel;
    }
    signClaim(value, cachedChannel) {
        const signature = libsodium_wrappers_1.default.crypto_sign_detached(channel_1.createClaimDigest(cachedChannel.channelId, value.toString()), this.privateKey);
        return {
            ...cachedChannel,
            spent: value,
            signature: Buffer.from(signature).toString('hex')
        };
    }
    async sendClaim({ channelId, signature, spent }) {
        const claim = {
            channelId,
            signature,
            value: spent.toString()
        };
        return this.sendMessage({
            type: btp_packet_1.TYPE_MESSAGE,
            requestId: await exports.generateBtpRequestId(),
            data: {
                protocolData: [
                    {
                        protocolName: 'claim',
                        contentType: btp_packet_1.MIME_APPLICATION_JSON,
                        data: Buffer.from(JSON.stringify(claim))
                    }
                ]
            }
        });
    }
    async handleData(message) {
        const info = getBtpSubprotocol(message, 'info');
        if (info) {
            this.linkXrpAddress(info);
            return [
                {
                    protocolName: 'info',
                    contentType: btp_packet_1.MIME_APPLICATION_JSON,
                    data: Buffer.from(JSON.stringify({
                        xrpAddress: this.master._xrpAddress
                    }))
                }
            ];
        }
        const channelDeposit = getBtpSubprotocol(message, 'channelDeposit');
        if (channelDeposit) {
            const cachedChannel = this.account.incoming.state;
            if (!cachedChannel) {
                return [];
            }
            this.master._log.debug('Checking if peer has deposited to channel');
            const checkForDeposit = async (attempts = 0) => {
                if (attempts > 20) {
                    return this.master._log.debug(`Failed to confirm incoming deposit after several attempts`);
                }
                const updatedChannel = await channel_1.updateChannel(this.master._api, cachedChannel);
                if (!updatedChannel) {
                    return;
                }
                const wasDeposit = updatedChannel.value.isGreaterThan(cachedChannel.value);
                if (!wasDeposit) {
                    await exports.delay(250);
                    return checkForDeposit(attempts + 1);
                }
                await this.account.incoming.add(async (newCachedChannel) => {
                    const isSameChannel = newCachedChannel &&
                        newCachedChannel.channelId === cachedChannel.channelId;
                    if (!newCachedChannel || !isSameChannel) {
                        this.master._log.debug(`Incoming channel was closed while confirming deposit: reverting to old state`);
                        return newCachedChannel;
                    }
                    this.master._log.debug('Confirmed deposit to incoming channel');
                    return {
                        ...newCachedChannel,
                        value: bignumber_js_1.default.max(updatedChannel.value, newCachedChannel.value)
                    };
                });
            };
            await checkForDeposit().catch(err => {
                this.master._log.error('Error confirming incoming deposit:', err);
            });
            return [];
        }
        const requestClose = getBtpSubprotocol(message, 'requestClose');
        if (requestClose) {
            this.master._log.info(`Channel close requested for account ${this.account.accountName}`);
            await this.claimChannel(false).catch(err => this.master._log.error(`Error attempting to claim channel: ${err.message}`));
            return [
                {
                    protocolName: 'requestClose',
                    contentType: btp_packet_1.MIME_TEXT_PLAIN_UTF8,
                    data: Buffer.alloc(0)
                }
            ];
        }
        const claim = getBtpSubprotocol(message, 'claim');
        if (claim) {
            this.master._log.debug(`Handling claim for account ${this.account.accountName}`);
            const parsedClaim = JSON.parse(claim.data.toString());
            const hasValidSchema = (o) => typeof o.value === 'string' &&
                typeof o.channelId === 'string' &&
                typeof o.signature === 'string';
            if (!hasValidSchema(parsedClaim)) {
                this.master._log.debug('Invalid claim: schema is malformed');
                return [];
            }
            await this.account.incoming
                .add(this.validateClaim(parsedClaim))
                .catch(err => this.master._log.error('Failed to validate claim: ', err));
            this.autoFundOutgoingChannel().catch(err => this.master._log.error('Error attempting to auto fund outgoing channel: ', err));
            return [];
        }
        const ilp = getBtpSubprotocol(message, 'ilp');
        if (ilp) {
            try {
                const { amount } = ilp_packet_1.deserializeIlpPrepare(ilp.data);
                const amountBN = new bignumber_js_1.default(amount);
                if (amountBN.gt(this.master._maxPacketAmount)) {
                    throw new ilp_packet_1.Errors.AmountTooLargeError('Packet size is too large.', {
                        receivedAmount: amount,
                        maximumAmount: this.master._maxPacketAmount.toString()
                    });
                }
                const newBalance = this.account.receivableBalance.plus(amount);
                if (newBalance.isGreaterThan(this.master._maxBalance)) {
                    this.master._log.debug(`Cannot forward PREPARE: cannot debit ${exports.format(crypto_rate_utils_1.drop(amount))}: proposed balance of ${exports.format(crypto_rate_utils_1.drop(newBalance))} exceeds maximum of ${exports.format(crypto_rate_utils_1.drop(this.master._maxBalance))}`);
                    throw new ilp_packet_1.Errors.InsufficientLiquidityError('Exceeded maximum balance');
                }
                this.master._log.debug(`Forwarding PREPARE: Debited ${exports.format(crypto_rate_utils_1.drop(amount))}, new balance is ${exports.format(crypto_rate_utils_1.drop(newBalance))}`);
                this.account.receivableBalance = newBalance;
                const response = await this.dataHandler(ilp.data);
                const reply = ilp_packet_1.deserializeIlpReply(response);
                if (ilp_packet_1.isReject(reply)) {
                    this.master._log.debug(`Credited ${exports.format(crypto_rate_utils_1.drop(amount))} in response to REJECT`);
                    this.account.receivableBalance = this.account.receivableBalance.minus(amount);
                }
                else if (ilp_packet_1.isFulfill(reply)) {
                    this.master._log.debug(`Received FULFILL in response to forwarded PREPARE`);
                }
                return [
                    {
                        protocolName: 'ilp',
                        contentType: btp_packet_1.MIME_APPLICATION_OCTET_STREAM,
                        data: response
                    }
                ];
            }
            catch (err) {
                return [
                    {
                        protocolName: 'ilp',
                        contentType: btp_packet_1.MIME_APPLICATION_OCTET_STREAM,
                        data: ilp_packet_1.errorToReject('', err)
                    }
                ];
            }
        }
        return [];
    }
    handlePrepareResponse(prepare, reply) {
        if (ilp_packet_1.isFulfill(reply)) {
            const amount = new bignumber_js_1.default(prepare.amount);
            this.master._log.debug(`Received a FULFILL in response to forwarded PREPARE: credited ${exports.format(crypto_rate_utils_1.drop(amount))}`);
            this.account.payableBalance = this.account.payableBalance.plus(amount);
            this.sendMoney().catch((err) => this.master._log.debug('Error queueing outgoing settlement: ', err));
        }
        else if (ilp_packet_1.isReject(reply)) {
            this.master._log.debug(`Received a ${reply.code} REJECT in response to the forwarded PREPARE`);
            const outgoingChannel = this.account.outgoing.state;
            if (reply.code === 'T04' && channel_1.hasClaim(outgoingChannel)) {
                this.sendClaim(outgoingChannel).catch((err) => this.master._log.debug('Failed to send latest claim to peer on T04 error:', err));
            }
        }
    }
    startChannelWatcher() {
        const timer = setInterval(async () => {
            const cachedChannel = this.account.incoming.state;
            if (!cachedChannel) {
                this.watcher = null;
                clearInterval(timer);
                return;
            }
            const updatedChannel = await channel_1.updateChannel(this.master._api, cachedChannel);
            if (!updatedChannel || channel_1.isDisputed(updatedChannel)) {
                this.claimChannel(true).catch((err) => {
                    this.master._log.debug(`Error attempting to claim channel or confirm channel was closed: ${err.message}`);
                });
            }
        }, this.master._channelWatcherInterval.toNumber());
        return timer;
    }
    claimChannel(requireDisputed = false, authorize) {
        return this.account.incoming.add(async (cachedChannel) => {
            if (!cachedChannel) {
                return cachedChannel;
            }
            const updatedChannel = await channel_1.updateChannel(this.master._api, cachedChannel);
            if (!updatedChannel) {
                this.master._log.error(`Cannot claim channel ${cachedChannel.channelId} with ${this.account.accountName}: linked channel is unexpectedly closed`);
                return updatedChannel;
            }
            const { channelId, spent, signature, publicKey } = updatedChannel;
            if (requireDisputed && !channel_1.isDisputed(updatedChannel)) {
                this.master._log.debug(`Won't claim channel ${updatedChannel.channelId} with ${this.account.accountName}: channel is not disputed`);
                return updatedChannel;
            }
            const claim = spent.isGreaterThan(0)
                ? {
                    publicKey,
                    signature: signature.toUpperCase(),
                    balance: crypto_rate_utils_1.convert(crypto_rate_utils_1.drop(spent), crypto_rate_utils_1.xrp()).toFixed(6, bignumber_js_1.default.ROUND_DOWN)
                }
                : {};
            await this.master._queueTransaction(async () => {
                const { txJSON, instructions } = await this.master._api.preparePaymentChannelClaim(this.master._xrpAddress, {
                    channel: channelId,
                    close: true,
                    ...claim
                });
                const txFee = new bignumber_js_1.default(instructions.fee);
                if (authorize) {
                    const isAuthorized = await authorize(updatedChannel, txFee)
                        .then(() => true)
                        .catch(() => false);
                    if (!isAuthorized) {
                        return updatedChannel;
                    }
                }
                this.master._log.debug(`Attempting to claim channel ${channelId} for ${exports.format(crypto_rate_utils_1.drop(spent))}`);
                await channel_1.sendTransaction(txJSON, this.master._api, this.master._xrpSecret);
            });
            const closedChannel = await this.refreshChannel(updatedChannel, (channel) => !channel)();
            this.master._log.debug(`Successfully claimed incoming channel ${channelId} for ${exports.format(crypto_rate_utils_1.drop(spent))}`);
            return closedChannel;
        }, IncomingTaskPriority.ClaimChannel);
    }
    async requestClose() {
        return this.account.outgoing.add(async (cachedChannel) => {
            if (!cachedChannel) {
                return;
            }
            try {
                await this.sendMessage({
                    requestId: await exports.generateBtpRequestId(),
                    type: btp_packet_1.TYPE_MESSAGE,
                    data: {
                        protocolData: [
                            {
                                protocolName: 'requestClose',
                                contentType: btp_packet_1.MIME_TEXT_PLAIN_UTF8,
                                data: Buffer.alloc(0)
                            }
                        ]
                    }
                });
                const updatedChannel = await this.refreshChannel(cachedChannel, (channel) => !channel)();
                this.master._log.debug(`Peer successfully closed our outgoing channel ${cachedChannel.channelId}, returning at least ${exports.format(crypto_rate_utils_1.drop(channel_1.remainingInChannel(cachedChannel)))} of collateral`);
                return updatedChannel;
            }
            catch (err) {
                this.master._log.debug('Error while requesting peer to claim channel:', err);
                return cachedChannel;
            }
        });
    }
    async disconnect() {
        if (this.watcher) {
            clearInterval(this.watcher);
        }
    }
    unload() {
        if (this.watcher) {
            clearInterval(this.watcher);
        }
        this.account.outgoing.removeAllListeners();
        this.account.incoming.removeAllListeners();
        this.master._store.unload(`${this.account.accountName}:account`);
        this.master._accounts.delete(this.account.accountName);
    }
}
exports.default = XrpAccount;
//# sourceMappingURL=account.js.map