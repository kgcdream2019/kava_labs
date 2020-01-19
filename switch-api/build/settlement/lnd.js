"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_rate_utils_1 = require("@kava-labs/crypto-rate-utils");
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const Option_1 = require("fp-ts/lib/Option");
const ilp_plugin_lightning_1 = __importStar(require("ilp-plugin-lightning"));
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const url_1 = require("url");
const util_1 = require("util");
const engine_1 = require("../engine");
const log_1 = __importDefault(require("../utils/log"));
const store_1 = require("../utils/store");
const assets_1 = require("../assets");
const satToBtc = (amount) => crypto_rate_utils_1.exchangeQuantity(crypto_rate_utils_1.baseQuantity(assets_1.btcAsset, amount));
const setupEngine = async (ledgerEnv) => ({
    settlerType: engine_1.SettlementEngineType.Lnd
});
/*
 * ------------------------------------
 * CREDENTIAL
 * ------------------------------------
 */
/**
 * Confirm a host is semantically valid (e.g. "localhost:8080")
 * and split into component hostname and port
 */
exports.splitHost = (host) => Option_1.tryCatch(() => new url_1.URL('https://' + host)).map(({ hostname, port }) => ({
    hostname,
    port: parseInt(port, 10)
}));
const fetchChannelBalance = async (lightning) => {
    const res = await lightning.channelBalance({});
    return satToBtc(res.balance.toString()).amount;
};
const uniqueId = (cred) => cred.identityPublicKey;
const setupCredential = (opts) => async () => {
    // Create and connect the internal LND service (passed to plugins)
    const grpcClient = ilp_plugin_lightning_1.createGrpcClient(opts);
    await util_1.promisify(grpcClient.waitForReady.bind(grpcClient))(Date.now() + 10000);
    const service = ilp_plugin_lightning_1.createLnrpc(grpcClient);
    // Fetch the public key so the user doesn't have to provide it
    // (necessary as a unique identifier for this LND node)
    const response = await service.getInfo({});
    const identityPublicKey = response.identityPubkey;
    const paymentStream = ilp_plugin_lightning_1.createPaymentStream(service);
    const payments$ = rxjs_1.fromEvent(paymentStream, 'data');
    const invoiceStream = ilp_plugin_lightning_1.createInvoiceStream(service);
    const invoices$ = rxjs_1.fromEvent(invoiceStream, 'data').pipe(
    // Only refresh when invoices are paid/settled
    operators_1.filter(invoice => !!invoice.settled));
    // Fetch an updated channel balance every 3s, or whenever an invoice is paid (by us or counterparty)
    const channelBalance$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    rxjs_1.merge(invoices$, payments$, rxjs_1.interval(3000))
        .pipe(
    // Limit balance requests to 10 per second
    operators_1.throttleTime(100), operators_1.mergeMap(() => rxjs_1.from(fetchChannelBalance(service))))
        .subscribe(channelBalance$);
    return {
        settlerType: engine_1.SettlementEngineType.Lnd,
        grpcClient,
        service,
        paymentStream,
        invoiceStream,
        identityPublicKey,
        channelBalance$,
        config: opts
    };
};
// TODO Also unsubscribe/end all of the event listeners (confirm there aren't any memory leaks)
exports.closeCredential = async ({ grpcClient }) => grpcClient.close();
exports.configFromLndCredential = (cred) => cred.config;
// TODO Is the base config fine?
const connectUplink = (credential) => (state) => async (config) => {
    const server = config.plugin.btp.serverUri;
    const store = config.plugin.store;
    const plugin = new ilp_plugin_lightning_1.default({
        role: 'client',
        server,
        /**
         * Inject the existing LND service, since it may be shared across multiple uplinks
         * Share the same payment/invoice stream across multiple plugins
         */
        lnd: credential.service,
        paymentStream: credential.paymentStream,
        invoiceStream: credential.invoiceStream
    }, {
        log: log_1.default('ilp-plugin-lightning'),
        store: new store_1.MemoryStore(store)
    });
    const outgoingCapacity$ = credential.channelBalance$;
    const incomingCapacity$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(Infinity));
    const totalReceived$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    const totalSent$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(0));
    return {
        settlerType: engine_1.SettlementEngineType.Lnd,
        asset: assets_1.btcAsset,
        credentialId: uniqueId(credential),
        plugin,
        outgoingCapacity$,
        incomingCapacity$,
        totalSent$,
        totalReceived$
    };
};
exports.getBaseBalance = async (credential) => {
    const lndService = credential.service;
    const baseBalance = await lndService.walletBalance({});
    return satToBtc(baseBalance.confirmedBalance.toString());
};
/**
 * ------------------------------------
 * SETTLEMENT MODULE
 * ------------------------------------
 */
exports.Lnd = {
    setupEngine,
    setupCredential,
    uniqueId,
    closeCredential: exports.closeCredential,
    connectUplink,
    getBaseBalance: exports.getBaseBalance
};
//# sourceMappingURL=lnd.js.map