/**
 * BigInt Serialization Utilities
 * Handles conversion of BigInt values to strings for JSON serialization
 */

/**
 * Recursively converts BigInt values to strings in an object
 * @param {any} obj - The object to process
 * @returns {any} - The object with BigInt values converted to strings
 */
export function serializeBigInts(obj) {
    if (obj === null || obj === undefined) {
        return obj;
    }
    
    if (typeof obj === 'bigint') {
        return obj.toString();
    }
    
    if (Array.isArray(obj)) {
        return obj.map(item => serializeBigInts(item));
    }
    
    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = serializeBigInts(value);
        }
        return result;
    }
    
    return obj;
}

/**
 * Custom JSON replacer function that converts BigInt to string
 * @param {string} key - The object key
 * @param {any} value - The value to process
 * @returns {any} - The processed value
 */
export function bigIntReplacer(key, value) {
    if (typeof value === 'bigint') {
        return value.toString();
    }
    return value;
}

/**
 * Safely stringify an object that may contain BigInt values
 * @param {any} obj - The object to stringify
 * @returns {string} - The JSON string
 */
export function safeStringify(obj) {
    return JSON.stringify(obj, bigIntReplacer);
}
