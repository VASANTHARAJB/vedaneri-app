module.exports = {
  apps: [
    {
      name: 'vedaneri-api',
      cwd: 'apps/api',
      script: 'dist/index.js',
      env: { NODE_ENV: 'production', PORT: 4100 },
    },
    {
      name: 'vedaneri-web',
      cwd: 'apps/web',
      script: 'npm',
      args: 'run start -- -p 3100',
      env: { NODE_ENV: 'production' },
    },
  ],
};