"use strict";
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DispatchSetting = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const dispatchSettingSchema = new mongoose_1.Schema({
    distanceWeight: { type: Number, default: 40 },
    ratingWeight: { type: Number, default: 20 },
    priorityPackageWeight: { type: Number, default: 15 },
    loadBalancingWeight: { type: Number, default: 15 },
    recencyWeight: { type: Number, default: 10 },
    maxConcurrentJobs: { type: Number, default: 3 },
    maxJobsPerDay: { type: Number, default: 20 },
    responseTimeoutSeconds: { type: Number, default: 60 },
    dispatchRadiusMeters: { type: Number, default: 5000 },
    cooldownConsecutiveLimit: { type: Number, default: 5 },
    cooldownPenaltyFactor: { type: Number, default: 20 },
    autoReassignSeconds: { type: Number, default: 60 },
    defaultSafetyBufferMinutes: { type: Number, default: 15 },
    defaultCleanupMinutes: { type: Number, default: 10 },
    maxAcceptableLatenessMinutes: { type: Number, default: 5 },
    urbanTrafficSpeedKmh: { type: Number, default: 25 },
    routingEngine: { type: String, enum: ['haversine', 'osrm', 'google'], default: 'haversine' },
    osrmBaseUrl: { type: String, default: 'http://router.project-osrm.org' },
    highValueCashConfirmationThreshold: { type: Number, default: 2000 },
    paymentExpiryHours: { type: Number, default: 24 },
    // Finance settlement config
    gstRateOnCommission: { type: Number, default: 18 },
    tdsRateOnGross: { type: Number, default: 1 },
    tcsRateOnGross: { type: Number, default: 1 },
    settlementHoldDays: { type: Number, default: 3 },
    codBlockThreshold: { type: Number, default: 2000 },
    codRemitDays: { type: Number, default: 3 },
    defaultCommissionPercentage: { type: Number, default: 20 },
}, { timestamps: true });
exports.DispatchSetting = mongoose_1.default.model('DispatchSetting', dispatchSettingSchema);
