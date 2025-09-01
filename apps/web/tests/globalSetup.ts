import { FullConfig, request } from '@playwright/test';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module環境で__dirnameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalSetup(_config: FullConfig) {
    console.log('🚀 Starting global setup...');

    // --- 1. Start Docker Compose ---
    console.log('🐳 Bringing up Docker containers...');
    const compose = process.env.USE_COMPOSE_V1 === '1' ? 'docker-compose' : 'docker compose';
    const buildFlag = process.env.PLAYWRIGHT_BUILD_IMAGES === '1' ? ' --build' : '';
    execSync(`${compose} up -d${buildFlag}`, { stdio: 'inherit' });


    // --- 2. Wait for services to be healthy ---
    const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3003';
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:8080';

    console.log(`⏳ Waiting for frontend service at ${frontendUrl}...`);
    await waitForUrl(frontendUrl);

    console.log(`⏳ Waiting for backend service at ${backendUrl}/health...`);
    await waitForUrl(`${backendUrl}/health`);

    // --- 3. Create a test user for this run ---
    const user = {
        email: `test-${Date.now()}@example.com`,
        password: process.env.TEST_USER_PASSWORD ?? `Test-123abc-${Date.now()}`,
        name: 'E2E Test User',
    };
    console.log(`👤 Registering test user: ${user.email}`);

    const api = await request.newContext({ baseURL: backendUrl });
    try {
        const response = await api.post(`/auth/register`, {
            data: { email: user.email, password: user.password, name: user.name },
            timeout: 30_000,
        });
        if (!response.ok()) {
            throw new Error(`Failed to register user: ${await response.text()}`);
        }
        console.log('✅ Test user registered successfully.');
    } catch (error) {
        console.error('❌ Error registering user:', error);
        // Cleanup and exit if user registration fails
        const compose = process.env.USE_COMPOSE_V1 === '1' ? 'docker-compose' : 'docker compose';
        execSync(`${compose} down`, { stdio: 'inherit' });
        throw error;
    } finally {
        await api.dispose();
    }

    // --- 4. Save the user credentials for tests to use ---
    process.env.TEST_USER_EMAIL = user.email;
    process.env.TEST_USER_PASSWORD = user.password;

    console.log('✅ Global setup complete.');
}

async function waitForUrl(url: string, timeout = 120000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                console.log(`✅ Service at ${url} is ready.`);
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_error) {
            // Ignore fetch errors and retry
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`🚨 Timed out waiting for service at ${url}.`);
}

export default globalSetup;
