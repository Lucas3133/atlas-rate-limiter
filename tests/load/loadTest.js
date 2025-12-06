// ================================================================
// ATLAS RATE LIMITER - TESTE DE CARGA
// ================================================================
// FIX-003: Simula múltiplas requisições para testar rate limiting
// Agora lê a porta dinamicamente do .env
// ================================================================

require('dotenv').config(); // FIX-003: Carregar variáveis do .env

const http = require('http');

// FIX-003: Porta dinâmica via .env (fallback para 3000)
const PORT = process.env.PORT || 3000;
const TARGET_URL = `http://localhost:${PORT}/api/public`;
const TOTAL_REQUESTS = 150; // Mais que o limite (100)
const CONCURRENT_REQUESTS = 10;

let successCount = 0;
let blockedCount = 0;
let errorCount = 0;

/**
 * Faz uma requisição HTTP
 */
function makeRequest() {
    return new Promise((resolve) => {
        http.get(TARGET_URL, (res) => {
            let data = '';

            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    successCount++;
                    console.log(`✅ [${successCount + blockedCount}/${TOTAL_REQUESTS}] Permitida (200)`);
                } else if (res.statusCode === 429) {
                    blockedCount++;
                    console.log(`🚫 [${successCount + blockedCount}/${TOTAL_REQUESTS}] Bloqueada (429)`);
                }
                resolve();
            });
        }).on('error', (err) => {
            errorCount++;
            console.error(`❌ Erro: ${err.message}`);
            resolve();
        });
    });
}

/**
 * Executa teste de carga
 */
async function runLoadTest() {
    console.log('');
    console.log('========================================');
    console.log('🔥 TESTE DE CARGA - ATLAS RATE LIMITER');
    console.log('========================================');
    console.log(`Target: ${TARGET_URL}`);
    console.log(`Total de requisições: ${TOTAL_REQUESTS}`);
    console.log(`Concorrência: ${CONCURRENT_REQUESTS}`);
    console.log('========================================');
    console.log('');

    const startTime = Date.now();

    // Faz requisições em lotes concorrentes
    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
        const batch = [];
        for (let j = 0; j < CONCURRENT_REQUESTS && (i + j) < TOTAL_REQUESTS; j++) {
            batch.push(makeRequest());
        }
        await Promise.all(batch);

        // Pequeno delay entre lotes (simula carga mais real)
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    // ============================================================
    // RESULTADO
    // ============================================================
    console.log('');
    console.log('========================================');
    console.log('📊 RESULTADOS');
    console.log('========================================');
    console.log(`✅ Permitidas: ${successCount}`);
    console.log(`🚫 Bloqueadas (429): ${blockedCount}`);
    console.log(`❌ Erros: ${errorCount}`);
    console.log(`⏱️  Duração: ${duration}s`);
    console.log(`📈 Taxa: ${(TOTAL_REQUESTS / duration).toFixed(2)} req/s`);
    console.log('========================================');
    console.log('');

    // Validação
    if (blockedCount > 0) {
        console.log('✅ SUCESSO: Rate limiter está bloqueando requisições!');
    } else {
        console.log('⚠️  ATENÇÃO: Nenhuma requisição foi bloqueada. Verifique configuração.');
    }

    if (successCount > 100) {
        console.log('⚠️  ATENÇÃO: Mais de 100 requisições passaram. Possível problema no rate limiter.');
    }
}

// Executa teste
runLoadTest().catch(console.error);
