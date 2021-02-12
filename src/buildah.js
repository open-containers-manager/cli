#!/usr/bin/env node

import { v4 as uuid } from 'uuid';
import Cli from './class/Cli';
import VirtualBox from './class/Cli/VirtualBox';

const { error } = console;
const input = process.argv.slice(2);
const args = Cli.escape(input).join(' ');

if (input.length >= 1 && (
  input[0] === 'bud'
  || input[0] === 'build-using-dockerfile'
  || input[0] === 'add'
  || input[0] === 'copy'
  || input[0] === 'unshare'
)) {
  const id = uuid();

  VirtualBox.share('ocm', {
    name: id,
    hostpath: process.cwd(),
    readonly: true,
    transient: true,
  })
    .then(() => Cli.exec(`mkdir -p /tmp/ocm-volatile/${id}`))
    .then(() => Cli.exec(`sudo mount -t vboxsf -o gid=vboxsf ${id} /tmp/ocm-volatile/${id}`))
    .then(() => Cli.exec(`cd /tmp/ocm-volatile/${id} && buildah ${args}`))
    .then(() => Cli.exec(`sudo umount /tmp/ocm-volatile/${id}`))
    .then(() => Cli.exec(`rmdir /tmp/ocm-volatile/${id}`))
    .then(() => VirtualBox.unshare('ocm', {
      name: id,
      transient: true,
    }))
    .catch((err) => { error(err.message); });
} else {
  Cli.exec(`buildah ${args}`)
    .catch((err) => error(err.message));
}
