import { env } from './config/env';
import { createApp } from './app';

const app = createApp();
app.listen(env.port, () => {
  console.log(`API berjalan di http://localhost:${env.port}`);
});
