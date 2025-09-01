import QuoteRequest from '../models/QuoteRequest.js';

// Rate limit configuration
const RATE_LIMITS = {
    IP: {
        '1m': 30,
        '5m': 100,
        '1h': 1000
    },
    USER: {
        '1m': 50,
        '5m': 200,
        '1h': 2000
    }
};

const generateRateLimitKey = (type, identifier) => {
    return `${type}:${identifier}`;
};

const checkRateLimit = async (rateLimitKey, limits) => {
    try {
        const violations = [];
        
        for (const [timeWindow, maxRequests] of Object.entries(limits)) {
            const rateInfo = await QuoteRequest.getRateLimitInfo(rateLimitKey, timeWindow);
            
            if (rateInfo.requestCount >= maxRequests) {
                violations.push({
                    timeWindow,
                    maxRequests,
                    currentCount: rateInfo.requestCount,
                    resetTime: rateInfo.endTime
                });
            }
        }
        
        return {
            allowed: violations.length === 0,
            violations,
            rateLimitKey
        };
    } catch (error) {
        console.error('Rate limit check failed:', error);
        return { allowed: true, violations: [], rateLimitKey };
    }
};

export const rateLimiter = async (req, res, next) => {
    try {
        const startTime = Date.now();
        
        const ipAddress = req.ip || 
                         req.connection.remoteAddress || 
                         req.socket.remoteAddress || 
                         'unknown';
        
        const userAddress = req.body?.userAddress || req.query?.userAddress || null;
        
        const ipRateLimitKey = generateRateLimitKey('IP', ipAddress);
        const ipRateCheck = await checkRateLimit(ipRateLimitKey, RATE_LIMITS.IP);
        
        if (!ipRateCheck.allowed) {
            const retryAfter = Math.max(...ipRateCheck.violations.map(v => 
                Math.ceil((v.resetTime - new Date()) / 1000)
            ));
            
            return res.status(429).json({
                error: 'Rate limit exceeded',
                message: 'Too many requests from this IP address',
                retryAfter: Math.max(retryAfter, 1),
                violations: ipRateCheck.violations
            });
        }
        
        let userRateCheck = { allowed: true, violations: [] };
        if (userAddress) {
            const userRateLimitKey = generateRateLimitKey('USER', userAddress.toLowerCase());
            userRateCheck = await checkRateLimit(userRateLimitKey, RATE_LIMITS.USER);
            
            if (!userRateCheck.allowed) {
                const retryAfter = Math.max(...userRateCheck.violations.map(v => 
                    Math.ceil((v.resetTime - new Date()) / 1000)
                ));
                
                return res.status(429).json({
                    error: 'Rate limit exceeded',
                    message: 'Too many requests from this user address',
                    retryAfter: Math.max(retryAfter, 1),
                    violations: userRateCheck.violations
                });
            }
        }
        
        req.rateLimitInfo = {
            ipAddress,
            userAddress,
            ipRateLimitKey,
            userRateLimitKey: userAddress ? generateRateLimitKey('USER', userAddress.toLowerCase()) : null,
            startTime
        };
        
        next();
    } catch (error) {
        console.error('Rate limiting middleware error:', error);
        next();
    }
};

export default rateLimiter;
