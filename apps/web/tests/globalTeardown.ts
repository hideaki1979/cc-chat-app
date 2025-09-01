import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';

async function globalTeardown(config: FullConfig) {
    console.log('👇 Starting global teardown...');
    console.log('🐳 Taking down Docker containers...');
    execSync('docker-compose down', { stdio: 'inherit' });
    console.log('✅ Global teardown complete.');
}

export default globalTeardown;
