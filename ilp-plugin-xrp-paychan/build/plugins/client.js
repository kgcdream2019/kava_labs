"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const account_1 = require("../account");
const ilp_plugin_btp_1 = __importDefault(require("ilp-plugin-btp"));
const btp_packet_1 = require("btp-packet");
const ilp_packet_1 = require("ilp-packet");
class XrpClientPlugin extends ilp_plugin_btp_1.default {
    constructor({ getAccount, loadAccount, ...opts }, { log }) {
        super(opts, { log });
        this.getAccount = () => getAccount('peer');
        this.loadAccount = () => loadAccount('peer');
    }
    _sendMessage(accountName, message) {
        return this._call('', message);
    }
    async _connect() {
        await this.loadAccount();
    }
    _handleData(from, message) {
        return this.getAccount().handleData(message);
    }
    async sendData(buffer) {
        const prepare = ilp_packet_1.deserializeIlpPrepare(buffer);
        if (!ilp_packet_1.isPrepare(prepare)) {
            throw new Error('Packet must be a PREPARE');
        }
        const response = await this._call('', {
            type: btp_packet_1.TYPE_MESSAGE,
            requestId: await account_1.generateBtpRequestId(),
            data: {
                protocolData: [
                    {
                        protocolName: 'ilp',
                        contentType: btp_packet_1.MIME_APPLICATION_OCTET_STREAM,
                        data: buffer
                    }
                ]
            }
        });
        const ilpResponse = response.protocolData.find(p => p.protocolName === 'ilp');
        if (ilpResponse) {
            const reply = ilp_packet_1.deserializeIlpReply(ilpResponse.data);
            this.getAccount().handlePrepareResponse(prepare, reply);
            return ilpResponse.data;
        }
        return Buffer.alloc(0);
    }
    sendMoney(amount) {
        return this.getAccount().sendMoney(amount);
    }
    _disconnect() {
        return this.getAccount().disconnect();
    }
}
exports.XrpClientPlugin = XrpClientPlugin;
//# sourceMappingURL=client.js.map