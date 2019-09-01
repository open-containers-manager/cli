#!/usr/bin/env node

import OCM from './class/Cli/OCM';
import Setup from './class/Cli/Setup';

const { error } = console;

const input = process.argv.slice(2);

if (input.length > 0) {
  switch (input[0]) {
    case 'install':
      Setup.install()
        .catch((err) => error(err.message));
      break;
    case 'status':
      OCM.status();
      break;
    case 'shell':
      OCM.shell();
      break;
    case 'start':
      OCM.start()
        .then(OCM.waitGuestAdditionnals)
        .then(OCM.startDaemon)
        .catch((err) => error(err.message));
      break;
    case 'stop':
      OCM.acpipower()
        .catch((err) => error(err.message));
      break;
    default:
      break;
  }
}
