// ================================================================
// ATLAS RATE LIMITER - LOAD TEST
// ================================================================
// FIX-003: Simulates multiple requests to test rate limiting
// Now reads port dynamically from .env
// ================================================================

require('dotenv').config(); // FIX-003: Load variables from .env

const http = require('http');

// FIX-003: Dynamic port via .env (fallback to 3000)
const PORT = process.env.PORT || 3000;
const TARGET_URL = `http://localhost:${PORT}/api/public`;
const TOTAL_REQUESTS = 150; // More than limit (100)
const CONCURRENT_REQUESTS = 10;

let successCount = 0;
let blockedCount = 0;
let errorCount = 0;

/**
 * Makes an HTTP request
 */
function makeRequest() {
    return new Promise((resolve) => {
        http.get(TARGET_URL, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    successCount++;
                    console.log(`✅ [${successCount + blockedCount}/${TOTAL_REQUESTS}] Allowed (200)`);
                } else if (res.statusCode === 429) {
                    blockedCount++;
                    console.log(`🚫 [${successCount + blockedCount}/${TOTAL_REQUESTS}] Blocked (429)`);
                }
                resolve();
            });
        }).on('error', (err) => {
            errorCount++;
            console.error(`❌ Error: ${err.message}`);
            resolve();
        });
    });
}

/**
 * Runs load test
 */
async function runLoadTest() {
    console.log('');
    console.log('========================================');
    console.log('🔥 LOAD TEST - ATLAS RATE LIMITER');
    console.log('========================================');
    console.log(`Target: ${TARGET_URL}`);
    console.log(`Total requests: ${TOTAL_REQUESTS}`);
    console.log(`Concurrency: ${CONCURRENT_REQUESTS}`);
    console.log('========================================');
    console.log('');

    const startTime = Date.now();

    // Make requests in concurrent batches
    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
        const batch = [];
        for (let j = 0; j < CONCURRENT_REQUESTS && (i + j) < TOTAL_REQUESTS; j++) {
            batch.push(makeRequest());
        }
        await Promise.all(batch);

        // Small delay between batches (simulates more realistic load)
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // ============================================================
    // RESULT
    // ============================================================
    console.log('');
    console.log('========================================');
    console.log('📊 RESULTS');
    console.log('========================================');
    console.log(`✅ Allowed: ${successCount}`);
    console.log(`🚫 Blocked (429): ${blockedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`📈 Rate: ${(TOTAL_REQUESTS / duration).toFixed(2)} req/s`);
    console.log('========================================');
    console.log('');

    // Validation
    if (blockedCount > 0) {
        console.log('✅ SUCCESS: Rate limiter is blocking requests!');
    } else {
        console.log('⚠️  WARNING: No requests were blocked. Check configuration.');
    }

    if (successCount > 100) {
        console.log('⚠️  WARNING: More than 100 requests passed. Possible rate limiter issue.');
    }
}

// Run test
runLoadTest().catch(console.error);
