"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = __importDefault(require("bignumber.js"));
const ilp_packet_1 = require("ilp-packet");
const packet_1 = require("./packet");
const rxjs_1 = require("rxjs");
const crypto_1 = require("../utils/crypto");
// Almost never use exponential notation
bignumber_js_1.default.config({ EXPONENTIAL_AT: 1e9 });
// TODO Since this isn't really used as a class anymore, could I just use these as standalone functions
//      existing around a plugin?
//      (How do I ensure that stream only calls these functions, though?)
class PluginWrapper {
    constructor({ plugin, maxBalance = Infinity, maxPacketAmount, log, store, assetCode, assetScale }) {
        /* tslint:disable-next-line:readonly-keyword TODO */
        this.dataHandler = packet_1.defaultDataHandler;
        this.plugin = plugin;
        this.plugin.registerDataHandler(data => this.handleData(data));
        this.plugin.registerMoneyHandler(amount => this.handleMoney(amount));
        this.store = store;
        this.log = log;
        this.assetCode = assetCode;
        this.assetScale = assetScale;
        /** Payable balance (outgoing/settlement) */
        this.payableBalance$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(this.store.getSync('payableBalance') || 0));
        this.payableBalance$.subscribe(amount => this.store.putSync('payableBalance', amount.toString()));
        /** Receivable balance (incoming/clearing) */
        this.maxBalance = new bignumber_js_1.default(maxBalance).decimalPlaces(0, bignumber_js_1.default.ROUND_FLOOR);
        this.receivableBalance$ = new rxjs_1.BehaviorSubject(new bignumber_js_1.default(this.store.getSync('receivableBalance') || 0));
        this.receivableBalance$.subscribe(amount => this.store.putSync('receivableBalance', amount.toString()));
        /** Max packet amount */
        this.maxPacketAmount = new bignumber_js_1.default(maxPacketAmount)
            .abs()
            .dp(0, bignumber_js_1.default.ROUND_FLOOR);
    }
    /*
     * Outgoing packets/settlements (payable balance)
     */
    async sendData(data) {
        const next = () => this.plugin.sendData(data);
        const { amount, executionCondition } = ilp_packet_1.deserializeIlpPrepare(data);
        if (amount === '0') {
            return next();
        }
        const response = await next();
        const reply = ilp_packet_1.deserializeIlpReply(response);
        if (ilp_packet_1.isFulfill(reply)) {
            const isValidFulfillment = crypto_1.sha256(reply.fulfillment).equals(executionCondition);
            if (!isValidFulfillment) {
                this.log.debug('Received FULFILL with invalid fulfillment');
                return ilp_packet_1.serializeIlpReject({
                    code: 'F05',
                    message: 'fulfillment did not match expected value.',
                    triggeredBy: '',
                    data: Buffer.alloc(0)
                });
            }
            this.log.debug(`Received FULFILL in response to forwarded PREPARE: credited ${this.format(amount)}`);
            this.payableBalance$.next(this.payableBalance$.value.plus(amount));
        }
        return response;
    }
    async sendMoney(amount) {
        if (parseInt(amount, 10) <= 0) {
            return;
        }
        this.log.info(`Settlement triggered for ${this.format(amount)}`);
        this.payableBalance$.next(this.payableBalance$.value.minus(amount));
        this.plugin
            .sendMoney(amount)
            .catch(err => this.log.error('Error during settlement: ', err));
    }
    /*
     * Incoming packets/settlements (receivable balance)
     */
    async handleMoney(amount) {
        if (parseInt(amount, 10) <= 0) {
            return;
        }
        const newBalance = this.receivableBalance$.value.minus(amount);
        this.log.debug(`Received incoming settlement: credited ${this.format(amount)}, new balance is ${this.format(newBalance)}`);
        this.receivableBalance$.next(newBalance);
    }
    async handleData(data) {
        const next = () => this.dataHandler(data);
        // Ignore 0 amount packets (no middlewares apply, so don't log)
        const { amount } = ilp_packet_1.deserializeIlpPrepare(data);
        if (amount === '0') {
            return next();
        }
        const packetTooLarge = new bignumber_js_1.default(amount).gt(this.maxPacketAmount);
        if (packetTooLarge) {
            return ilp_packet_1.serializeIlpReject({
                code: 'F08',
                triggeredBy: '',
                message: 'Packet size is too large.',
                data: Buffer.from(JSON.stringify({
                    receivedAmount: amount,
                    maximumAmount: this.maxPacketAmount.toString()
                }))
            });
        }
        const newBalance = this.receivableBalance$.value.plus(amount);
        if (newBalance.gt(this.maxBalance)) {
            this.log.debug(`Cannot forward PREPARE: cannot debit ${this.format(amount)}: proposed balance of ${this.format(newBalance)} exceeds maximum of ${this.format(this.maxBalance)}`);
            return ilp_packet_1.serializeIlpReject({
                code: 'T04',
                message: 'Exceeded maximum balance',
                triggeredBy: '',
                data: Buffer.alloc(0)
            });
        }
        this.log.debug(`Forwarding PREPARE: Debited ${this.format(amount)}, new balance is ${this.format(newBalance)}`);
        this.receivableBalance$.next(newBalance);
        const response = await next();
        const reply = ilp_packet_1.deserializeIlpReply(response);
        if (ilp_packet_1.isReject(reply)) {
            this.log.debug(`Credited ${this.format(amount)} in response to REJECT`);
            this.receivableBalance$.next(this.receivableBalance$.value.minus(amount));
        }
        return response;
    }
    /*
     * Plugin wrapper
     */
    registerDataHandler(handler) {
        this.dataHandler = handler;
    }
    deregisterDataHandler() {
        this.dataHandler = packet_1.defaultDataHandler;
    }
    format(amount) {
        return `${new bignumber_js_1.default(amount).shiftedBy(-this.assetScale)} ${this.assetCode.toLowerCase()}`;
    }
}
PluginWrapper.version = 2;
exports.PluginWrapper = PluginWrapper;
//# sourceMappingURL=middlewares.js.map