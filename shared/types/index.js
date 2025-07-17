"use strict";
/**
 * Main export file for shared types
 * This file should be imported by both client and server
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketEvents = exports.ErrorCodes = void 0;
// Domain types
__exportStar(require("./domain"), exports);
// API types
__exportStar(require("./api"), exports);
// Socket types
__exportStar(require("./socket"), exports);
var api_1 = require("./api");
Object.defineProperty(exports, "ErrorCodes", { enumerable: true, get: function () { return api_1.ErrorCodes; } });
var socket_1 = require("./socket");
Object.defineProperty(exports, "SocketEvents", { enumerable: true, get: function () { return socket_1.SocketEvents; } });
