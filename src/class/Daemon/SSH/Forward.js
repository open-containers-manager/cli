import Events from 'events';
import net from 'net';
import pify from 'pify';
import pIf from 'p-if';
import enableDestroy from 'server-destroy';

export default class Forward extends Events {
  constructor(connection, port) {
    super();
    this.connection = connection;
    this.port = port;

    this.server = new net.Server((client) => {
      this.connection.forwardOut('0.0.0.0', port, '127.0.0.1', port)
        .then((stream) => {
          client.pipe(stream);
          stream.pipe(client);

          client.on('error', () => { stream.end(); });
          client.on('close', () => { stream.end(); });
        })
        .catch((err) => { this.emit('error', err); });
    });

    enableDestroy(this.server);
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, () => { resolve(); });

      this.server.on('close', () => { this.emit('close'); });
      this.server.on('error', (err) => { reject(err); });
    });
  }

  stop() {
    return pIf(
      this.server.listening === true,
      pify(this.server.destroy.bind(this.server)),
    )();
  }
}
