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
exports.TimeSlotRule = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const TimeSlotRuleSchema = new mongoose_1.Schema({
    categoryId: { type: String },
    categoryName: { type: String },
    subserviceId: { type: String },
    ruleName: { type: String, required: true },
    pricingType: {
        type: String,
        enum: ['FIXED_SURCHARGE', 'PERCENTAGE_SURCHARGE', 'FIXED_DISCOUNT', 'PERCENTAGE_DISCOUNT'],
        default: 'FIXED_SURCHARGE'
    },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    extraCharge: { type: Number, required: true, default: 0 },
    priority: { type: Number, default: 10 },
    isStackable: { type: Boolean, default: true },
    isExclusive: { type: Boolean, default: false },
    city: { type: String },
    zone: { type: String },
    membershipRequired: { type: String },
    daysOfWeek: { type: [Number], default: [] },
    validFrom: { type: Date },
    validUntil: { type: Date },
    maxExtraCharge: { type: Number },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'active', 'expired', 'disabled', 'archived'],
        default: 'active'
    },
    version: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
exports.TimeSlotRule = mongoose_1.default.model('TimeSlotRule', TimeSlotRuleSchema);
