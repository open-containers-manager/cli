import EventEmitter from 'events';
import pAll from 'p-all';
import pIf from 'p-if';
import pTap from 'p-tap';
import { PassThrough } from 'stream';
import { Exec, Forward } from '../SSH';

export default class Monitoring extends EventEmitter {
  constructor(connection) {
    super();
    this.connection = connection;
    this.client = connection.client;
    this.internal = new EventEmitter();

    this.forwards = [];
    this.running = false;
  }

  start() {
    this.running = true;
    return this.init()
      .then(() => this.listen())
      .catch(pTap.catch(() => this.stop()));
  }

  listen() {
    const controller = new PassThrough();
    const ssh = new Exec(this.client, null, null, { events: controller });
    this.internal.on('stop', () => controller.emit('stop'));

    ssh.exec('podman events --format json --filter type=container');
    ssh.on('stdout', (output) => {
      const events = output.toString().split('\n').filter((e) => e !== '');
      const containers = events.map((evt) => {
        try {
          return JSON.parse(evt);
        } catch (err) {
          return null;
        }
      }).filter((evt) => evt !== null);

      const start = containers
        .filter((container) => container.Status === 'start')
        .map((container) => container.ID);
      const stop = containers
        .filter((container) => container.Status === 'stop')
        .map((container) => container.ID);

      pIf(stop.length > 0, () => this.unforward(stop))()
        .then(pIf(start.length > 0, () => this.forward(start)))
        .catch((err) => { this.emit('error', err); });
    });

    ssh.on('end', () => { this.emit('end'); });
    ssh.on('error', (err) => { this.emit('error', err); });
  }

  stop() {
    return pIf(
      this.running === true,
      () => {
        this.running = false;
        this.internal.emit('stop');
        return this.unforward(this.forwards.map((container) => container.id));
      },
    )();
  }

  init() {
    return new Promise((resolve, reject) => {
      const ssh = new Exec(this.client);

      ssh.exec('podman ps -q', null, null, { returnOutput: true });
      ssh.on('end', (output) => {
        resolve(
          output
            .toString()
            .split('\n')
            .filter((id) => id !== ''),
        );
      });
      ssh.on('error', (err) => { reject(err); });
    })
      .then((container) => this.forward(container));
  }

  inspect(containers) {
    return new Promise((resolve, reject) => {
      const ssh = new Exec(this.client);
      const containersList = containers.join(' ');

      ssh.exec(`podman inspect ${containersList}`, null, null, { returnOutput: true });
      ssh.on('end', (output) => {
        let data = null;
        try {
          data = JSON.parse(output);
        } catch (err) {
          data = [];
        }

        resolve(data);
      });
      ssh.on('error', (err) => { reject(err); });
    });
  }

  forward(containers) {
    return this.inspect(containers)
      .then((containersInfo) => pAll(
        containersInfo.map((container) => () => {
          const id = container.Id;
          const ports = Object.keys(container.NetworkSettings.Ports)
            .map((port) => container.NetworkSettings.Ports[port])
            .flat()
            .map((forward) => forward.HostPort);

          return pAll(
            ports.map((port) => () => {
              const forward = new Forward(this.connection, port);

              forward.on('close', () => {
                this.emit('unforward', port);
                this.forwards = this.forwards.filter((f) => f.id !== id);
              });

              return forward.start()
                .then(() => { this.forwards.push({ id, port, stop: forward.stop.bind(forward) }); })
                .then(() => { this.emit('forward', port); })
                .catch((err) => { this.emit('error', err); });
            }),
          );
        }),
      ));
  }

  unforward(containers) {
    return pAll(
      containers.map((id) => () => this.forwards
        .filter((f) => f.id === id)
        .map((forward) => forward.stop())),
    );
  }
}
