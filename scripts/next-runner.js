#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');
const { loadEnvFiles } = require('./env-config');

const mode = process.argv[2] || 'dev';
loadEnvFiles(mode, path.resolve(__dirname, '..'));

const nextBin = require.resolve('next/dist/bin/next');
const host =
  process.env.HOST ||
  process.env.HOSTNAME ||
  (mode === 'dev' ? '127.0.0.1' : '0.0.0.0');
const port = process.env.PORT || '3000';

const args = [nextBin, mode];

if (mode === 'dev' || mode === 'start') {
  args.push('-p', port, '-H', host);
}

const child = spawn(process.execPath, args, {
  stdio: 'inherit',
  env: process.env
});

child.on('exit', code => {
  process.exit(code ?? 0);
});

child.on('error', error => {
  console.error(error);
  process.exit(1);
});
