const { loadEnvFiles } = require('./scripts/env-config');

loadEnvFiles('start', __dirname);

const resolveEnv = (key, fallback) => process.env[key] ?? fallback;

module.exports = {
  apps: [
    {
      name: 'suno-api',
      cwd: __dirname,
      script: 'npm',
      args: 'run start',
      env: {
        NODE_ENV: 'production',
        HOST: resolveEnv('HOST', '127.0.0.1'),
        PORT: resolveEnv('PORT', '8015'),
        APP_BASE_PATH: resolveEnv('APP_BASE_PATH', '')
      }
    }
  ]
};
