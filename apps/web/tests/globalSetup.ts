import { chromium, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Module環境で__dirnameを再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

async function globalSetup(config: FullConfig) {
    console.log('🚀 Starting global setup...');

    // --- 1. Start Docker Compose ---
    console.log('🐳 Bringing up Docker containers...');
    execSync('docker-compose up -d --build', { stdio: 'inherit' });

    // --- 2. Wait for services to be healthy ---
    const frontendUrl = 'http://localhost:3003';
    const backendUrl = 'http://localhost:8080';

    console.log(`⏳ Waiting for frontend service at ${frontendUrl}...`);
    await waitForUrl(frontendUrl);

    console.log(`⏳ Waiting for backend service at ${backendUrl}/health...`);
    await waitForUrl(`${backendUrl}/health`);

    // --- 3. Create a test user for this run ---
    const user = {
        email: `test-${Date.now()}@example.com`,
        password: 'Password123',
        name: 'E2E Test User',
    };

    console.log(`👤 Registering test user: ${user.email}`);

    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
        const response = await page.request.post(`${backendUrl}/auth/register`, {
            data: {
                email: user.email,
                password: user.password,
                name: user.name,
            },
        });
        if (!response.ok()) {
            throw new Error(`Failed to register user: ${await response.text()}`);
        }
        console.log('✅ Test user registered successfully.');
    } catch (error) {
        console.error('❌ Error registering user:', error);
        // Cleanup and exit if user registration fails
        execSync('docker-compose down', { stdio: 'inherit' });
        throw error;
    } finally {
        await browser.close();
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
        } catch (error) {
            // Ignore fetch errors and retry
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    throw new Error(`🚨 Timed out waiting for service at ${url}.`);
}

export default globalSetup;
