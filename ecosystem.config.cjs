module.exports = {
  apps: [
    {
      name: 'tpay-backend',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      }
    }
  ]
};

