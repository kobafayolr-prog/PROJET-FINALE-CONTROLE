module.exports = {
  apps: [
    {
      name: 'timetrack',
      script: 'npx',
      args: 'wrangler pages dev dist --d1=timetrack-production --local --ip 0.0.0.0 --port 3000 --compatibility-flags=nodejs_compat',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
