const TabServer = require('./modules/TabServer');

const PORT = process.env.PORT || 8110;
const app = new TabServer(PORT);

app.start();

process.on('SIGINT', () => {
  console.log('\nThanks for playing! Goodbye for now...');
  app.stop();
  process.exit(0);
});