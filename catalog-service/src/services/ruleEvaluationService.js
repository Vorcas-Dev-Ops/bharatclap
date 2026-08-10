"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateTimeSlotRules = evaluateTimeSlotRules;
function parseTimeToMinutes(timeStr) {
    if (!timeStr)
        return 0;
    const clean = timeStr.trim().toUpperCase();
    // Check for AM/PM format e.g. "06:00 PM" or "6 PM"
    const ampmMatch = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    if (ampmMatch) {
        let hours = parseInt(ampmMatch[1], 10);
        const minutes = ampmMatch[2] ? parseInt(ampmMatch[2], 10) : 0;
        const meridiem = ampmMatch[3];
        if (meridiem === 'PM' && hours !== 12)
            hours += 12;
        if (meridiem === 'AM' && hours === 12)
            hours = 0;
        return hours * 60 + minutes;
    }
    // Check 24hr format e.g. "18:00"
    const match24 = clean.match(/^(\d{1,2}):(\d{2})/);
    if (match24) {
        return parseInt(match24[1], 10) * 60 + parseInt(match24[2], 10);
    }
    return 0;
}
/** Check if slotTime falls within rule.startTime and rule.endTime range */
function isSlotInRuleWindow(slotTime, startTime, endTime) {
    // Extract slot start time if formatted as "18:00-19:00" or "06:00 PM - 07:00 PM"
    const slotStartStr = slotTime.includes('-') ? slotTime.split('-')[0].trim() : slotTime.trim();
    const slotMinutes = parseTimeToMinutes(slotStartStr);
    const ruleStartMinutes = parseTimeToMinutes(startTime);
    const ruleEndMinutes = parseTimeToMinutes(endTime);
    if (ruleStartMinutes <= ruleEndMinutes) {
        return slotMinutes >= ruleStartMinutes && slotMinutes < ruleEndMinutes;
    }
    else {
        // Overnight rule e.g. 22:00 to 06:00
        return slotMinutes >= ruleStartMinutes || slotMinutes < ruleEndMinutes;
    }
}
function evaluateTimeSlotRules(allRules, context) {
    const basePrice = context.basePrice || 0;
    const evalDate = context.date ? new Date(context.date) : new Date();
    const dayOfWeek = evalDate.getDay(); // 0-6
    const appliedRules = [];
    const ignoredRules = [];
    // Filter active and valid rules
    const eligibleRules = allRules.filter(rule => {
        if (!rule.isActive || rule.status === 'disabled' || rule.status === 'archived' || rule.status === 'draft') {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: 'Rule is disabled or archived' });
            return false;
        }
        if (rule.validFrom && new Date(rule.validFrom) > evalDate) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: 'Rule validFrom date is in the future' });
            return false;
        }
        if (rule.validUntil && new Date(rule.validUntil) < evalDate) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: 'Rule validUntil date has expired' });
            return false;
        }
        if (rule.daysOfWeek && rule.daysOfWeek.length > 0 && !rule.daysOfWeek.includes(dayOfWeek)) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: `Rule active only on days [${rule.daysOfWeek.join(',')}]` });
            return false;
        }
        if (rule.categoryId && context.categoryId && String(rule.categoryId) !== String(context.categoryId)) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: 'Category does not match' });
            return false;
        }
        if (rule.subserviceId && context.subserviceId && String(rule.subserviceId) !== String(context.subserviceId)) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: 'Subservice does not match' });
            return false;
        }
        if (rule.city && context.city && rule.city.toLowerCase() !== context.city.toLowerCase()) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: 'City does not match' });
            return false;
        }
        if (!isSlotInRuleWindow(context.slotTime, rule.startTime, rule.endTime)) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: `Time slot ${context.slotTime} outside rule window ${rule.startTime}-${rule.endTime}` });
            return false;
        }
        return true;
    });
    // Sort by priority descending (higher number = higher priority)
    eligibleRules.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    let hasExclusiveApplied = false;
    for (const rule of eligibleRules) {
        if (hasExclusiveApplied) {
            ignoredRules.push({ ruleId: String(rule._id), ruleName: rule.ruleName, reason: 'Superseded by a higher priority exclusive rule' });
            continue;
        }
        let chargeDelta = 0;
        const value = rule.extraCharge || 0;
        switch (rule.pricingType) {
            case 'FIXED_SURCHARGE':
                chargeDelta = value;
                break;
            case 'PERCENTAGE_SURCHARGE':
                chargeDelta = (basePrice * value) / 100;
                break;
            case 'FIXED_DISCOUNT':
                chargeDelta = -value;
                break;
            case 'PERCENTAGE_DISCOUNT':
                chargeDelta = -((basePrice * value) / 100);
                break;
            default:
                chargeDelta = value;
        }
        // Apply rule cap if maxExtraCharge is defined for positive surcharges
        if (rule.maxExtraCharge && chargeDelta > 0 && chargeDelta > rule.maxExtraCharge) {
            chargeDelta = rule.maxExtraCharge;
        }
        appliedRules.push({
            ruleId: String(rule._id),
            version: rule.version || 1,
            ruleName: rule.ruleName,
            pricingType: rule.pricingType || 'FIXED_SURCHARGE',
            priority: rule.priority || 10,
            value: value,
            chargeDelta: Math.round(chargeDelta * 100) / 100,
            reason: `${rule.ruleName} (${rule.startTime} - ${rule.endTime})`
        });
        if (rule.isExclusive) {
            hasExclusiveApplied = true;
        }
        if (!rule.isStackable && !rule.isExclusive) {
            // Non-stackable stops further stackable rules
            hasExclusiveApplied = true;
        }
    }
    let totalExtraCharge = 0;
    let totalDiscount = 0;
    for (const item of appliedRules) {
        if (item.chargeDelta > 0) {
            totalExtraCharge += item.chargeDelta;
        }
        else {
            totalDiscount += Math.abs(item.chargeDelta);
        }
    }
    const netSlotSurcharge = Math.round((totalExtraCharge - totalDiscount) * 100) / 100;
    return {
        appliedRules,
        ignoredRules,
        totalExtraCharge: Math.round(totalExtraCharge * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        netSlotSurcharge,
        isPeak: netSlotSurcharge > 0
    };
}
