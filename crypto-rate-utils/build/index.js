"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const bignumber_js_1 = __importDefault(require("bignumber.js"));
var coincap_1 = require("./api/coincap");
exports.connectCoinCap = coincap_1.connectCoinCap;
exports.baseUnit = (unit) => (Object.assign({}, unit, { scale: 0 }));
exports.exchangeUnit = (unit) => (Object.assign({}, unit, { scale: unit.exchangeScale }));
exports.accountUnit = (unit) => (Object.assign({}, unit, { scale: unit.accountScale }));
exports.baseQuantity = (unit, amount) => (Object.assign({}, unit, { scale: 0, amount: 'amount' in unit
        ? unit.amount.shiftedBy(unit.scale)
        : new bignumber_js_1.default(amount) }));
exports.exchangeQuantity = (unit, amount) => (Object.assign({}, unit, { scale: unit.exchangeScale, amount: 'amount' in unit
        ? unit.amount.shiftedBy(unit.scale - unit.exchangeScale)
        : new bignumber_js_1.default(amount) }));
exports.accountQuantity = (unit, amount) => (Object.assign({}, unit, { scale: unit.accountScale, amount: 'amount' in unit
        ? unit.amount.shiftedBy(unit.scale - unit.accountScale)
        : new bignumber_js_1.default(amount) }));
exports.convert = (source, dest, api) => (Object.assign({}, dest, { amount: source.amount.times(exports.getRate(source, dest, api)) }));
exports.getRate = (source, dest, api) => {
    let rate = new bignumber_js_1.default(1);
    if (source.symbol !== dest.symbol) {
        if (!api) {
            throw new Error('API instance is required for non- like-kind conversions (e.g. BTC to ETH)');
        }
        const sourcePrice = api.getPrice(source.symbol);
        const destPrice = api.getPrice(dest.symbol);
        rate = sourcePrice.div(destPrice);
    }
    return rate.shiftedBy(source.scale - source.exchangeScale - (dest.scale - dest.exchangeScale));
};
//# sourceMappingURL=index.js.map