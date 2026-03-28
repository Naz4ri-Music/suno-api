const fs = require('node:fs');
const path = require('node:path');

const parseEnvFile = (filePath) => {
  if (!fs.existsSync(filePath))
    return {};

  const env = {};
  const content = fs.readFileSync(filePath, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#'))
      continue;

    const normalizedLine = line.replace(/^export\s+/, '');
    const separatorIndex = normalizedLine.indexOf('=');

    if (separatorIndex === -1)
      continue;

    const key = normalizedLine.slice(0, separatorIndex).trim();
    let value = normalizedLine.slice(separatorIndex + 1).trim();

    if (!key)
      continue;

    const hasMatchingQuotes =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith('\'') && value.endsWith('\''));

    if (hasMatchingQuotes)
      value = value.slice(1, -1);

    if (!value.startsWith('\''))
      value = value.replace(/\s+#.*$/, '');

    env[key] = value;
  }

  return env;
};

const getEnvironmentName = (mode) => {
  if (mode === 'dev')
    return 'development';

  if (mode === 'test')
    return 'test';

  return 'production';
};

const loadEnvFiles = (mode, cwd = process.cwd()) => {
  const environmentName = getEnvironmentName(mode);
  const envFileNames = [
    '.env',
    `.env.${environmentName}`,
    '.env.local',
    `.env.${environmentName}.local`
  ];

  const mergedEnv = {};

  for (const fileName of envFileNames) {
    const filePath = path.join(cwd, fileName);
    Object.assign(mergedEnv, parseEnvFile(filePath));
  }

  for (const [key, value] of Object.entries(mergedEnv)) {
    if (process.env[key] === undefined)
      process.env[key] = value;
  }

  return mergedEnv;
};

module.exports = {
  loadEnvFiles
};
