export default {
  import: ['@babel/register', 'test/setup.js'],
  spec: 'test/**/*.test.js',
  timeout: 10000,
  exit: true,
  reporter: 'spec',
  ui: 'bdd'
};
