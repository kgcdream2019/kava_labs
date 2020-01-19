import { AssetUnit } from '@kava-labs/crypto-rate-utils';
import BigNumber from 'bignumber.js';
import { IlpPrepare, IlpReply } from 'ilp-packet';
import { BtpPacket, BtpPacketData, BtpSubProtocol } from 'ilp-plugin-btp';
import XrpPlugin from '.';
import { DataHandler, MoneyHandler } from './types/plugin';
import { ClaimablePaymentChannel, PaymentChannel, SerializedClaim } from './utils/channel';
import ReducerQueue from './utils/queue';
export declare const generateBtpRequestId: () => Promise<number>;
export declare const delay: (timeout: number) => Promise<{}>;
export declare const format: (num: AssetUnit) => string;
export interface SerializedAccountData {
    accountName: string;
    receivableBalance: string;
    payableBalance: string;
    payoutAmount: string;
    xrpAddress?: string;
    incoming?: ClaimablePaymentChannel;
    outgoing?: PaymentChannel;
}
export interface AccountData {
    accountName: string;
    receivableBalance: BigNumber;
    payableBalance: BigNumber;
    payoutAmount: BigNumber;
    xrpAddress?: string;
    incoming: ReducerQueue<ClaimablePaymentChannel | undefined>;
    outgoing: ReducerQueue<PaymentChannel | undefined>;
}
export default class XrpAccount {
    account: AccountData;
    private master;
    private depositQueue?;
    private sendMessage;
    private dataHandler;
    private moneyHandler;
    private watcher;
    private privateKey;
    private publicKey;
    constructor({ accountName, accountData, master, sendMessage, dataHandler, moneyHandler }: {
        accountName: string;
        accountData: AccountData;
        master: XrpPlugin;
        sendMessage: (message: BtpPacket) => Promise<BtpPacketData>;
        dataHandler: DataHandler;
        moneyHandler: MoneyHandler;
    });
    private persistAccountData;
    private fetchXrpAddress;
    private linkXrpAddress;
    fundOutgoingChannel(value: BigNumber, authorize?: (fee: BigNumber) => Promise<void>): Promise<void>;
    private autoFundOutgoingChannel;
    private openChannel;
    private depositToChannel;
    sendMoney(amount?: string): Promise<void>;
    createClaim(cachedChannel: PaymentChannel | undefined): Promise<PaymentChannel | undefined>;
    signClaim(value: BigNumber, cachedChannel: PaymentChannel): ClaimablePaymentChannel;
    sendClaim({ channelId, signature, spent }: ClaimablePaymentChannel): Promise<BtpPacketData>;
    handleData(message: BtpPacket): Promise<BtpSubProtocol[]>;
    validateClaim: (claim: SerializedClaim) => (cachedChannel: ClaimablePaymentChannel | undefined, attempts?: number) => Promise<ClaimablePaymentChannel | undefined>;
    handlePrepareResponse(prepare: IlpPrepare, reply: IlpReply): void;
    private startChannelWatcher;
    claimChannel(requireDisputed?: boolean, authorize?: (channel: PaymentChannel, fee: BigNumber) => Promise<void>): Promise<ClaimablePaymentChannel | undefined>;
    requestClose(): Promise<PaymentChannel | undefined>;
    disconnect(): Promise<void>;
    unload(): void;
    private refreshChannel;
}
