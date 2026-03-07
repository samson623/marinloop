import fs from 'node:fs';
import path from 'node:path';

const REQUIRED_VARS = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];

function loadLocalEnvIfNeeded() {
    const missingBeforeLoad = REQUIRED_VARS.filter((name) => !process.env[name]);
    if (missingBeforeLoad.length === 0) {
        return;
    }

    const envPath = path.resolve(process.cwd(), '.env');
    if (!fs.existsSync(envPath)) {
        return;
    }

    const envContents = fs.readFileSync(envPath, 'utf8');
    for (const line of envContents.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) {
            continue;
        }

        const equalsIndex = trimmed.indexOf('=');
        if (equalsIndex === -1) {
            continue;
        }

        const key = trimmed.slice(0, equalsIndex).trim();
        if (!key || process.env[key]) {
            continue;
        }

        let value = trimmed.slice(equalsIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        process.env[key] = value;
    }
}

function requireEnv(name, helpText) {
    const value = process.env[name];
    if (!value) {
        throw new Error(
            `Missing required environment variable: ${name}. ${helpText}`
        );
    }

    return value;
}

async function testPushDiagnostics() {
    loadLocalEnvIfNeeded();

    const supabaseUrl = requireEnv(
        'SUPABASE_URL',
        'Set it in your shell or .env file (example: https://your-project-ref.supabase.co).'
    );
    const anonKey = requireEnv(
        'SUPABASE_ANON_KEY',
        'Set it in your shell or .env file with your Supabase anon key.'
    );

    const functionUrl =
        process.env.SUPABASE_PUSH_FUNCTION_URL ??
        `${supabaseUrl.replace(/\/$/, '')}/functions/v1/send-push`;

    const response = await fetch(functionUrl, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${anonKey}`,
            'Content-Type': 'application/json'
        }
    });

    const text = await response.text();
    console.log('Function URL:', functionUrl);
    console.log('Status:', response.status);
    console.log('Body:', text);
}

testPushDiagnostics().catch((error) => {
    console.error('[push-diagnostics] Failed:', error.message);
    process.exitCode = 1;
});
