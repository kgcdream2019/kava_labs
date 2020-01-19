"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ilp_logger_1 = __importDefault(require("ilp-logger"));
exports.default = (name) => ilp_logger_1.default(name);
// export default (name: string) =>
//   pino({
//     name,
//     level: 'trace',
//     base: {
//       name
//     },
//     prettyPrint: {
//       colorize: true,
//       translateTime: 'yyyy-mm-dd HH:MM:ss.l'
//     }
//   })
//# sourceMappingURL=log.js.map