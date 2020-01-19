"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const ilp_plugin_xrp_paychan_1 = __importStar(require("@kava-labs/ilp-plugin-xrp-paychan"));
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ripple_keypairs_1 = require("ripple-keypairs");
const ripple_lib_1 = require("ripple-lib");
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const credential_1 = require("../credential");
const engine_1 = require("../engine");
const log_1 = __importDefault(require("../utils/log"));
const store_1 = require("../utils/store");
const assets_1 = require("../assets");
const dropsToXrp = (amount) => crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.baseQuantity(assets_1.xrpAsset, amount));
const xrpToDrops = (amount) => crypto_rate_utils_1.baseQuantity(crypto_rate_utils_1.exchangeQuantity(assets_1.xrpAsset, amount));
const getXrpServerWebsocketUri = (ledgerEnv) => ledgerEnv === 'mainnet'
    ? 'wss://s1.ripple.com'
    : 'wss://s.altnet.rippletest.net:51233';
const setupEngine = async (ledgerEnv) => {
    const api = new ripple_lib_1.RippleAPI({
        server: getXrpServerWebsocketUri(ledgerEnv)
    });
    await api.connect();
    return {
        settlerType: engine_1.SettlementEngineType.XrpPaychan,
        api
    };
};
exports.closeXrpPaychanEngine = ({ api }) => api.disconnect();
const setupCredential = (cred) => async (state) => {
    // `deriveKeypair` will throw if the secret is invalid
    const address = ripple_keypairs_1.deriveAddress(ripple_keypairs_1.deriveKeypair(cred.secret).publicKey);
    const settler = state.settlers[cred.settlerType];
    // Rejects if the XRP account does not exist
    await settler.api.getAccountInfo(address);
    return {
        ...cred,
        address
    };
};
const uniqueId = (cred) => cred.address;
exports.configFromXrpCredential = ({ address, ...cred }) => cred;
exports.getBaseBalance = async (settler, credential) => {
    const response = await settler.api.getAccountInfo(credential.address);
    return crypto_rate_utils_1.exchangeQuantity(assets_1.xrpAsset, response.xrpBalance);
};
const connectUplink = (credential) => (state) => async (config) => {
    const server = config.plugin.btp.serverUri;
    const store = config.plugin.store;
    const { secret } = credential;
    const xrpServer = getXrpServerWebsocketUri(state.ledgerEnv);
    const plugin = new ilp_plugin_xrp_paychan_1.default({
        role: 'client',
        server,
        xrpServer,
        xrpSecret: secret
    }, {
        log: log_1.default('ilp-plugin-xrp'),
        store: new store_1.MemoryStore(store)
    });
    const pluginAccount = await plugin._loadAccount('peer');
    const toXrp = operators_1.map(amount => dropsToXrp(amount).amount);
    const totalSent$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.outgoing, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.outgoing.state), operators_1.map(ilp_plugin_xrp_paychan_1.spentFromChannel), toXrp)
        .subscribe(totalSent$);
    const outgoingCapacity$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.outgoing, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.outgoing.state), operators_1.map(ilp_plugin_xrp_paychan_1.remainingInChannel), toXrp)
        .subscribe(outgoingCapacity$);
    const totalReceived$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.incoming, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.incoming.state), operators_1.map(ilp_plugin_xrp_paychan_1.spentFromChannel), toXrp)
        .subscribe(totalReceived$);
    const incomingCapacity$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.fromEvent(pluginAccount.account.incoming, 'data')
        .pipe(operators_1.startWith(pluginAccount.account.incoming.state), operators_1.map(ilp_plugin_xrp_paychan_1.remainingInChannel), toXrp)
        .subscribe(incomingCapacity$);
    return {
        settlerType: engine_1.SettlementEngineType.XrpPaychan,
        asset: assets_1.xrpAsset,
        credentialId: uniqueId(credential),
        plugin,
        pluginAccount,
        outgoingCapacity$,
        incomingCapacity$,
        totalSent$,
        totalReceived$
    };
};
const deposit = (uplink) => (state) => async ({ amount, authorize }) => {
    const { api } = state.settlers[uplink.settlerType];
    const readyCredential = state.credentials.find(credential_1.isThatCredentialId(uplink.credentialId, uplink.settlerType));
    if (!readyCredential) {
        return;
    }
    const { address } = readyCredential;
    const fundAmountDrops = xrpToDrops(amount).amount;
    await uplink.pluginAccount.fundOutgoingChannel(fundAmountDrops, async (feeXrp) => {
        // TODO Check the base layer balance to confirm there's enough $$$ on chain (with fee)!
        // Confirm that the account has sufficient funds to cover the reserve
        // TODO May throw if the account isn't found
        const { ownerCount, xrpBalance } = await api.getAccountInfo(address);
        const { validatedLedger: { reserveBaseXRP, reserveIncrementXRP } } = await api.getServerInfo();
        const minBalance = 
        /* Minimum amount of XRP for every account to keep in reserve */
        +reserveBaseXRP +
            /** Current amount reserved in XRP for each object the account is responsible for */
            +reserveIncrementXRP * ownerCount +
            /** Additional reserve this channel requires, in units of XRP */
            +reserveIncrementXRP +
            /** Amount to fund the channel, in unit sof XRP */
            +amount +
            /** Assume channel creation fee from plugin, in units of XRP */
            +feeXrp;
        const currentBalance = +xrpBalance;
        if (currentBalance < minBalance) {
            // TODO Return a specific type of error
            throw new Error('insufficient funds');
        }
        await authorize({
            value: amount,
            fee: crypto_rate_utils_1.exchangeQuantity(assets_1.xrpAsset, feeXrp)
        });
    });
    // Wait up to 1 minute for incoming capacity to be created
    await uplink.incomingCapacity$
        .pipe(operators_1.first(amount => amount.isGreaterThan(0)), operators_1.timeout(60000))
        .toPromise();
};
// TODO Move some of this into generic uplink code?
const withdraw = (uplink) => async (authorize) => {
    /* tslint:disable-next-line:no-let */
    let claimChannel;
    const isAuthorized = new Promise((resolve, reject) => {
        /* tslint:disable-next-line:no-let */
        let claimChannelAuthReady = false;
        const authorizeOnlyOutgoing = async () => !claimChannelAuthReady &&
            authorize({
                value: uplink.outgoingCapacity$.value,
                fee: dropsToXrp(0)
            }).then(resolve, reject);
        claimChannel = uplink.pluginAccount
            .claimChannel(false, (channel, feeXrp) => {
            claimChannelAuthReady = true;
            const internalAuthorize = authorize({
                value: uplink.outgoingCapacity$.value.plus(dropsToXrp(channel.spent).amount),
                fee: crypto_rate_utils_1.exchangeQuantity(assets_1.xrpAsset, feeXrp)
            });
            internalAuthorize.then(resolve, reject);
            return internalAuthorize;
        })
            // If `authorize` was never called to claim the channel,
            // call `authorize` again, but this time only to request the outgoing channel to be closed
            // (this prevents deadlocks if for some reason the incoming channel was already closed)
            .then(authorizeOnlyOutgoing, authorizeOnlyOutgoing);
    });
    // TODO This won't reject if the withdraw fails!
    // Only request the peer to the close if the withdraw is authorized first
    const requestClose = isAuthorized.then(() => uplink.pluginAccount.requestClose());
    // Simultaneously withdraw and request incoming capacity to be removed
    /* tslint:disable-next-line:no-unnecessary-type-assertion */
    await Promise.all([claimChannel, requestClose]);
    // TODO Confirm the incoming capacity has been closed -- or attempt to dispute it?
};
/**
 * ------------------------------------
 * SETTLEMENT MODULE
 * ------------------------------------
 */
exports.XrpPaychan = {
    setupEngine,
    setupCredential,
    uniqueId,
    connectUplink,
    deposit,
    withdraw,
    getBaseBalance: exports.getBaseBalance
};
//# sourceMappingURL=xrp-paychan.js.map