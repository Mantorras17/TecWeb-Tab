const TabServer = require('./TabServer');

const PORT = process.env.PORT || 8110;
const server = new TabServer(PORT);

server.start();

process.on('SIGINT', () => {
  console.log('\nThanks for playing! Goodbye for now...');
  server.stop();
  process.exit(0);
});