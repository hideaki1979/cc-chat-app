import type { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function globalTeardown(_config: FullConfig) {
    console.log('👇 Starting global teardown...');
    const compose = process.env.USE_COMPOSE_V1 === '1' ? 'docker-compose' : 'docker compose';
    execSync(`${compose} down`, { stdio: 'inherit' });
    console.log('✅ Global teardown complete.');
}

export default globalTeardown;
