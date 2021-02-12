# Open Containers Manager
> CLI app to use podman & buildah through VirtualBox VM "seamlessly"

[![NPM Package](https://img.shields.io/npm/v/@open-containers-manager/cli)](https://www.npmjs.com/package/@open-containers-manager/cli)
[![Travis CI](https://img.shields.io/travis/open-containers-manager/cli)](https://travis-ci.org/open-containers-manager/cli)
![Codacy grade](https://img.shields.io/codacy/grade/8631948afb394a5c803eabd93a96df26)
[![License](https://img.shields.io/github/license/open-containers-manager/cli)](https://github.com/open-containers-manager/cli/blob/master/LICENSE)

## Features
  - Download and install OCM VirtualBox VM
  - Expose Podman & Buildah commands seamlessly
  - Automatic forwarding of the exposed port in the virtual machine from containers to host
  - Automatic mount of the current directory in the virtual machine for build commands
  - Persistent storage in separate VMDK (`~/.ocm/ocm-persistent.vmdk`)

## Limitations
  - Podman `build` & Buildah `build-using-dockerfile`, `bud`, `add`, `copy`, `unshare` commands should be used with a relative path under current directory (current directory is mounted in the virtual machine)
  - Mounting a host volume in containers is not supported
  - Remove OCM virtual machine from VirtualBox **removes persistent storage**, detaches it before

## Requirements
  - Linux, MacOS X or Windows with nodejs v10.
  - VirtualBox

## Install
```bash
npm -g i @open-containers-manager/cli
```

or from source

```bash
npm i
npm run build
npm -g i file:$PWD
```

> Exposes four global commands : `ocm`, `podman`, `buildah` and `ocm-daemon`.

## Usage
### OCM
```text
Usage:
  ocm [command]

Available commands:
  install     Download & install OCM VM
  status      Display the status of the OCM VM
  start       Start the OCM VM
  stop        Stop the OCM VM
  console     Open an interactive console
```

### Podman
```text
Use "podman --help" for more informations about command.
```

### Buildah
```text
Use "buildah --help" for more informations about command.
```

### OCM Daemon
Starts automatically in background with each of the above commands if it is not already active.

```bash
ocm-daemon
```

> Can be started manually before ocm `start` command for debugging purposes

## License
MIT © Tony Duburque
