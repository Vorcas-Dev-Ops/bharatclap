import http from 'http';
import { setupLifecycle } from '../booking-service/src/utils/lifecycle';

const testServerListenerLeak = () => {
  console.log('--- TESTING SERVER CLOSE LISTENER LEAK ---');
  const server = http.createServer();

  const initialCloseListeners = server.listenerCount('close');
  console.log(`Initial server close listeners: ${initialCloseListeners}`);

  // Simulating 20 repeated lifecycle initialization & port retry attempts
  for (let i = 0; i < 20; i++) {
    setupLifecycle({
      serviceName: 'TEST-SERVICE',
      port: 9999,
      server,
    });
  }

  const finalCloseListeners = server.listenerCount('close');
  console.log(`Final server close listeners after 20 setup calls: ${finalCloseListeners}`);

  if (finalCloseListeners === initialCloseListeners) {
    console.log('✅ SUCCESS: Zero listener leak detected! Close listeners stayed constant.');
  } else {
    console.error(`❌ FAILURE: Listener count increased from ${initialCloseListeners} to ${finalCloseListeners}`);
    process.exit(1);
  }
};

testServerListenerLeak();
