"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("crypto");
const util_1 = require("util");
exports.sha256 = (preimage) => crypto_1.createHash('sha256')
    .update(preimage)
    .digest();
// Use the async version to prevent blocking the event loop:
// https://nodejs.org/en/docs/guides/dont-block-the-event-loop/#blocking-the-event-loop-node-core-modules
exports.generateSecret = () => util_1.promisify(crypto_1.randomBytes)(32);
exports.base64url = (buffer) => buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
// TODO This is super unclear... rename to generateAuthToken() ? Use it elsewhere?
exports.generateToken = async () => exports.base64url(await exports.generateSecret());
//# sourceMappingURL=crypto.js.map