"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const btp_packet_1 = require("btp-packet");
const debug_1 = __importDefault(require("debug"));
const eventemitter2_1 = require("eventemitter2");
const ilp_logger_1 = __importDefault(require("ilp-logger"));
const account_1 = __importDefault(require("./account"));
exports.XrpAccount = account_1.default;
const client_1 = require("./plugins/client");
const server_1 = require("./plugins/server");
const channel_1 = require("./utils/channel");
exports.remainingInChannel = channel_1.remainingInChannel;
exports.spentFromChannel = channel_1.spentFromChannel;
const queue_1 = __importDefault(require("./utils/queue"));
const store_1 = require("./utils/store");
const ripple_lib_1 = require("ripple-lib");
const ripple_keypairs_1 = require("ripple-keypairs");
btp_packet_1.registerProtocolNames(['claim', 'requestClose', 'channelDeposit']);
bignumber_js_1.default.config({ EXPONENTIAL_AT: 1e9 });
const defaultDataHandler = () => {
    throw new Error('no request handler registered');
};
const defaultMoneyHandler = () => {
    throw new Error('no money handler registered');
};
const DAY_IN_SECONDS = 24 * 60 * 60;
class XrpPlugin extends eventemitter2_1.EventEmitter2 {
    constructor({ role = 'client', xrpSecret, xrpServer = 'wss://s1.ripple.com', outgoingChannelAmount = crypto_rate_utils_1.convert(crypto_rate_utils_1.xrp(5), crypto_rate_utils_1.drop()), minIncomingChannelAmount = Infinity, outgoingDisputePeriod = 6 * DAY_IN_SECONDS, minIncomingDisputePeriod = 3 * DAY_IN_SECONDS, maxPacketAmount = Infinity, channelWatcherInterval = new bignumber_js_1.default(60 * 1000), ...opts }, { log, store = new store_1.MemoryStore() } = {}) {
        super();
        this._accounts = new Map();
        this._dataHandler = defaultDataHandler;
        this._moneyHandler = defaultMoneyHandler;
        this._txPipeline = Promise.resolve();
        this._store = new store_1.StoreWrapper(store);
        this._log = log || ilp_logger_1.default(`ilp-plugin-xrp-${role}`);
        this._log.trace = this._log.trace || debug_1.default(`ilp-plugin-xrp-${role}:trace`);
        this._api = new ripple_lib_1.RippleAPI({ server: xrpServer });
        this._xrpSecret = xrpSecret;
        this._xrpAddress = ripple_keypairs_1.deriveAddress(ripple_keypairs_1.deriveKeypair(xrpSecret).publicKey);
        this._outgoingChannelAmount = new bignumber_js_1.default(outgoingChannelAmount)
            .absoluteValue()
            .decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN);
        this._minIncomingChannelAmount = new bignumber_js_1.default(minIncomingChannelAmount)
            .absoluteValue()
            .decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN);
        this._minIncomingDisputePeriod = new bignumber_js_1.default(minIncomingDisputePeriod)
            .absoluteValue()
            .decimalPlaces(0, bignumber_js_1.default.ROUND_CEIL);
        this._outgoingDisputePeriod = new bignumber_js_1.default(outgoingDisputePeriod)
            .absoluteValue()
            .decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN);
        this._maxPacketAmount = new bignumber_js_1.default(maxPacketAmount)
            .absoluteValue()
            .decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN);
        this._maxBalance = new bignumber_js_1.default(role === 'client' ? Infinity : 0).decimalPlaces(0, bignumber_js_1.default.ROUND_FLOOR);
        this._channelWatcherInterval = new bignumber_js_1.default(channelWatcherInterval)
            .absoluteValue()
            .decimalPlaces(0, bignumber_js_1.default.ROUND_DOWN);
        const loadAccount = (accountName) => this._loadAccount(accountName);
        const getAccount = (accountName) => {
            const account = this._accounts.get(accountName);
            if (!account) {
                throw new Error(`Account ${accountName} is not yet loaded`);
            }
            return account;
        };
        this._plugin =
            role === 'server'
                ? new server_1.XrpServerPlugin({ getAccount, loadAccount, ...opts }, { store, log })
                : new client_1.XrpClientPlugin({ getAccount, loadAccount, ...opts }, { store, log });
        this._plugin.on('connect', () => this.emitAsync('connect'));
        this._plugin.on('disconnect', () => this.emitAsync('disconnect'));
        this._plugin.on('error', e => this.emitAsync('error', e));
    }
    async _loadAccount(accountName) {
        const accountKey = `${accountName}:account`;
        await this._store.loadObject(accountKey);
        const accountData = this._store.getObject(accountKey);
        if (!this._accounts.has(accountName)) {
            const account = new account_1.default({
                sendMessage: (message) => this._plugin._sendMessage(accountName, message),
                dataHandler: (data) => this._dataHandler(data),
                moneyHandler: (amount) => this._moneyHandler(amount),
                accountName,
                accountData: {
                    ...accountData,
                    accountName,
                    receivableBalance: new bignumber_js_1.default(accountData ? accountData.receivableBalance : 0),
                    payableBalance: new bignumber_js_1.default(accountData ? accountData.payableBalance : 0),
                    payoutAmount: new bignumber_js_1.default(accountData ? accountData.payoutAmount : 0),
                    incoming: new queue_1.default(accountData && accountData.incoming
                        ? await channel_1.updateChannel(this._api, channel_1.deserializePaymentChannel(accountData.incoming))
                        : undefined),
                    outgoing: new queue_1.default(accountData && accountData.outgoing
                        ? await channel_1.updateChannel(this._api, channel_1.deserializePaymentChannel(accountData.outgoing))
                        : undefined)
                },
                master: this
            });
            this._accounts.set(accountName, account);
            this._store.set('accounts', [...this._accounts.keys()]);
        }
        return this._accounts.get(accountName);
    }
    async _queueTransaction(sendTransaction) {
        return new Promise((resolve, reject) => {
            this._txPipeline = this._txPipeline
                .then(sendTransaction)
                .then(resolve, reject);
        });
    }
    async connect() {
        await this._api.connect();
        await this._store.loadObject('accounts');
        const accounts = this._store.getObject('accounts') || [];
        for (const accountName of accounts) {
            this._log.trace(`Loading account ${accountName} from store`);
            await this._loadAccount(accountName);
            await new Promise(r => setTimeout(r, 10));
        }
        return this._plugin.connect();
    }
    async disconnect() {
        await this._plugin.disconnect();
        for (const account of this._accounts.values()) {
            account.unload();
        }
        await this._store.close();
    }
    isConnected() {
        return this._plugin.isConnected();
    }
    sendData(data) {
        return this._plugin.sendData(data);
    }
    sendMoney(amount) {
        return this._plugin.sendMoney(amount);
    }
    registerDataHandler(dataHandler) {
        if (this._dataHandler !== defaultDataHandler) {
            throw new Error('request handler already registered');
        }
        this._dataHandler = dataHandler;
        return this._plugin.registerDataHandler(dataHandler);
    }
    deregisterDataHandler() {
        this._dataHandler = defaultDataHandler;
        return this._plugin.deregisterDataHandler();
    }
    registerMoneyHandler(moneyHandler) {
        if (this._moneyHandler !== defaultMoneyHandler) {
            throw new Error('money handler already registered');
        }
        this._moneyHandler = moneyHandler;
        return this._plugin.registerMoneyHandler(moneyHandler);
    }
    deregisterMoneyHandler() {
        this._moneyHandler = defaultMoneyHandler;
        return this._plugin.deregisterMoneyHandler();
    }
}
XrpPlugin.version = 2;
exports.default = XrpPlugin;
//# sourceMappingURL=index.js.map