module.exports = {
  apps: [
    {
      name: 'termux-telemetry',
      script: './server.js',
      instances: 1,
      exec_mode: 'fork',
      node_args: '--max-old-space-size=32 --max-semi-space-size=2',
      max_memory_restart: '45M',
      env: {
        NODE_ENV: 'production',
        PORT: 3055
      }
    }
  ]
};
