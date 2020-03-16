import SockJS from 'sockjs';

const sockets = [];

function startNotificationService(server, autoShutdown) {
  // add websocket handling
  const sockJS = SockJS.createServer({
    sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.1.2/sockjs.min.js',
    log: () => {},
  });
  sockJS.on('connection', (socket) => {
    sockets.push(socket);
    socket.on('close', () => {
      sockets.splice(sockets.indexOf(socket), 1);
      if (autoShutdown) {
        if (sockets.length === 0) {
          beginAutomaticShutdown();
        }
      }
    });
    stopAutomaticShutdown();
  });
  sockJS.installHandlers(server, { prefix:'/socket' });
}

function sendChangeNotification() {
  for (let socket of sockets) {
    socket.write('change');
  }
}

let shutdownTimeout;

function stopAutomaticShutdown() {
  clearTimeout(shutdownTimeout);
}

function beginAutomaticShutdown() {
  shutdownTimeout = setTimeout(() => {
    process.exit(0);
  }, 2000);
}

export {
  startNotificationService,
  sendChangeNotification,
};
