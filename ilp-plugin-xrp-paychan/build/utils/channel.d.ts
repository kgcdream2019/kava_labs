/// <reference types="node" />
import BigNumber from 'bignumber.js';
import { RippleAPI } from 'ripple-lib';
import { Outcome } from 'ripple-lib/dist/npm/transaction/types';
export interface PaymentChannel {
    lastUpdated: number;
    channelId: string;
    receiver: string;
    sender: string;
    publicKey: string;
    disputeDelay: BigNumber;
    expiresAt?: BigNumber;
    value: BigNumber;
    balance: BigNumber;
    spent: BigNumber;
    signature?: string;
}
export interface ClaimablePaymentChannel extends PaymentChannel {
    signature: string;
}
export interface SerializedClaim {
    channelId: string;
    signature: string;
    value: string;
}
export declare const deserializePaymentChannel: <TPaymentChannel extends PaymentChannel>(channel: TPaymentChannel) => TPaymentChannel;
export declare const updateChannel: <TPaymentChannel extends PaymentChannel>(api: RippleAPI, cachedChannel: TPaymentChannel) => Promise<TPaymentChannel | undefined>;
export declare const fetchChannel: (api: RippleAPI, channelId: string) => Promise<PaymentChannel | undefined>;
export declare const sendTransaction: (txJSON: string, api: RippleAPI, xrpSecret: string) => Promise<Outcome>;
export declare const computeChannelId: (senderAddress: string, receiverAddress: string, sequence: number) => string;
export declare const hasClaim: (channel?: PaymentChannel | undefined) => channel is ClaimablePaymentChannel;
export declare const spentFromChannel: (channel?: PaymentChannel | undefined) => BigNumber;
export declare const remainingInChannel: (channel?: PaymentChannel | undefined) => BigNumber;
export declare const isDisputed: (channel: PaymentChannel) => boolean;
export declare const isValidClaimSignature: (claim: SerializedClaim, channel: PaymentChannel) => boolean;
export declare const createClaimDigest: (channelId: string, value: string) => Buffer;
