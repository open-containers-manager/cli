import EventEmitter from 'events';
import { IPC } from 'node-ipc';
import pRetry from 'p-retry';
import { PassThrough } from 'stream';
import { Connection, Exec } from './SSH';
import { Monitoring } from './Container';
import config from '../../config';

export default class Daemon {
  constructor() {
    this.ssh = new Connection(config.ocm.ssh);

    const ipc = new IPC();
    ipc.config.appspace = 'ocm.';
    ipc.config.id = 'daemon';
    // ipc.config.silent = true;
    ipc.serve(() => this.serve());
    this.ipc = ipc;

    this.forwardedPorts = [];
  }

  start() {
    this.ipc.server.start();
  }

  stop() {
    this.ipc.server.stop();
  }

  serve() {
    const { ipc, ssh } = this;
    const noSSH = this.noSSH.bind(this);
    const remote = this.remote.bind(this);
    const monitoring = new Monitoring(ssh);
    const stop = () => {
      ssh.disconnect();
      monitoring.stop();
      this.stop();
    };
    const { log, error } = console;

    ipc.server.on('connect', noSSH);
    ipc.server.on('stop', () => stop());

    pRetry(
      () => ssh.connect(),
      { forever: true, maxTimeout: 1000, maxRetryTime: config.ocm.daemon.timeout },
    )
      .then(() => {
        ipc.server.off('connect', noSSH);

        ssh.on('end', () => { ssh.removeAllListeners('end'); stop(); });
        ssh.on('error', (err) => { error(err); stop(); });

        monitoring.on('forward', (port) => { log('forward', port); });
        monitoring.on('unforward', (port) => { log('unforward', port); });
        monitoring.on('end', () => { stop(); });
        monitoring.on('error', (err) => { error(err); stop(); });

        pRetry(
          () => monitoring.start(),
          { forever: true, maxTimeout: 1000, maxRetryTime: config.ocm.daemon.timeout },
        );
      })
      .then(() => {
        ipc.server.broadcast('ready');

        ipc.server.on('connect', (socket) => { ipc.server.emit(socket, 'ready'); });
        ipc.server.on('exec', remote);
      })
      .catch((err) => {
        error(err);
        stop();
      });
  }

  remote(data, socket) {
    const { ipc, ssh } = this;
    const error = this.error.bind(this);
    const stdin = new PassThrough();
    const events = new EventEmitter();
    const sshExec = new Exec(ssh.client);
    const exec = data || {};

    sshExec.exec(exec.cmd, exec.options, exec.window, { stdin, events });

    ipc.server.emit(socket, 'stdin-request');

    ipc.server.on('stdin', (input, client) => {
      if (socket === client) {
        stdin.write(Buffer.from(input.data));
      }
    });

    ipc.server.on('stdout-resize', (info, client) => {
      if (socket === client) {
        events.emit('resize', info);
      }
    });

    sshExec.on('stdout', (output) => { ipc.server.emit(socket, 'stdout', output); });
    sshExec.on('stderr', (output) => { ipc.server.emit(socket, 'stderr', output); });
    sshExec.on('end', () => { ipc.server.emit(socket, 'end'); });
    sshExec.on('error', (err) => { error(socket, err); });
  }

  noSSH(socket) {
    this.ipc.server.emit(socket, 'no-ssh');
  }

  error(socket, err) {
    this.ipc.server.emit(socket, 'error', err);
  }
}
