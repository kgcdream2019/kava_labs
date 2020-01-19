"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ilp_plugin_mini_accounts_1 = __importDefault(require("ilp-plugin-mini-accounts"));
const ilp_packet_1 = require("ilp-packet");
class XrpServerPlugin extends ilp_plugin_mini_accounts_1.default {
    constructor({ getAccount, loadAccount, ...opts }, api) {
        super(opts, api);
        this._handleCustomData = async (from, message) => {
            return this.getAccount(from).handleData(message);
        };
        this._handlePrepareResponse = async (destination, responsePacket, preparePacket) => {
            if (ilp_packet_1.isPrepare(responsePacket.data)) {
                throw new Error('Received PREPARE in response to PREPARE');
            }
            return this.getAccount(destination).handlePrepareResponse(preparePacket.data, responsePacket.data);
        };
        this.getAccount = (address) => getAccount(this.ilpAddressToAccount(address));
        this.loadAccount = (address) => loadAccount(this.ilpAddressToAccount(address));
    }
    _sendMessage(accountName, message) {
        return this._call(this._prefix + accountName, message);
    }
    async _connect(address, message) {
        await this.loadAccount(address);
    }
    async sendMoney() {
        throw new Error('sendMoney is not supported: use plugin balance configuration');
    }
    async _close(from) {
        return this.getAccount(from).disconnect();
    }
}
exports.XrpServerPlugin = XrpServerPlugin;
//# sourceMappingURL=server.js.map