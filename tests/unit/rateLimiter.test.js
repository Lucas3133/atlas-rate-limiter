// ============================================================
// ATLAS RATE LIMITER - UNIT TEST
// TEST-001: Simple isolated test with mocked Redis
// ============================================================

const rateLimiter = require('../../src/middleware/rateLimiter');

// Mock Redis client
jest.mock('../../src/core/redisClient', () => ({
    getRedisClient: () => ({
        // Mock EVALSHA to simulate token exhaustion
        evalsha: jest.fn().mockResolvedValue([0, 0]) // 0 tokens = blocked
    })
}));

// Mock metrics
jest.mock('../../src/utils/metrics', () => ({
    incrementBlocked: jest.fn(),
    incrementAllowed: jest.fn(),
    incrementRedisError: jest.fn(),
    recordResponseTime: jest.fn(),
    trackClient: jest.fn(),
    trackViolation: jest.fn(),
    isClientBanned: jest.fn().mockReturnValue(false)
}));

describe('Rate Limiter Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        // Mock Express request/response/next
        req = {
            ip: '127.0.0.1',
            path: '/api/test'
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn()
        };
        next = jest.fn();
    });

    test('should return 429 when tokens are exhausted', async () => {
        const middleware = rateLimiter();

        await middleware(req, res, next);

        // Should block request
        expect(res.status).toHaveBeenCalledWith(429);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                error: 'Too Many Requests'
            })
        );

        // Should NOT call next()
        expect(next).not.toHaveBeenCalled();
    });

    test('should include rate limit headers in 429 response', async () => {
        const middleware = rateLimiter();

        await middleware(req, res, next);

        const jsonCall = res.json.mock.calls[0][0];
        expect(jsonCall).toHaveProperty('retryAfter');
        expect(jsonCall).toHaveProperty('limit');
    });
});
