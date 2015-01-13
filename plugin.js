/*jslint
  node: true
  indent: 2
*/

"use strict";

var async = require('async'),
  path = require('path'),
  fs = require('fs');

require('colors');

function PlugIn(dir) {
  this.dir = dir;
}

PlugIn.prototype.dir = '';

PlugIn.prototype.getCommands = function getCommands(callback) {
  var self = this;

  function noIndexJs(file) {
    if (
      file === 'index.js' ||
        file[0] === '.'
    ) {
      return false;
    }

    return true;
  }

  fs.readdir(this.dir, function (err, files) {

    async.filter(files.filter(noIndexJs), function (name, callback) {
      if (/\.js$/.test(name)) {
        return callback(true);
      }

      fs.stat(self.dir + '/' + name, function (err, stats) {
        callback(stats.isDirectory());
      });
    }, callback.bind(self));
  });
};

PlugIn.prototype.execCommand = function execCommand(command, callback) {
  var commandTest,
    otherParts = command.indexOf('/');

  if (otherParts === -1) {
    otherParts = false;
  } else {
    otherParts = command.slice(otherParts + 1);
    command = command.slice(0, -otherParts.length - 1);
  }

  command = this.dir + '/' + command;

  commandTest = new RegExp('^' + command + '(\\.js|/)');

  Object.keys(require.cache)
    .forEach(function (item) {
      if (commandTest.test(item)) {
        delete require.cache[item];
      }
    });

  command = require(command);

  if (command instanceof PlugIn) {
    if (otherParts) {
      return command.execCommand(otherParts, callback);
    }

    return command.exec(callback);
  }

  command(callback);
};

PlugIn.prototype.exec = function exec(callback) {
  var self = this,
    commands,
    onData,
    bind;

  onData = function (command) {
    command = command.toString()
      .trim();

    // Release keyboad binding and allow macro to bind freely
    process.stdin.removeListener('data', onData);

    if (commands.indexOf(command) === -1) {
      if (/^[0-9]+$/.test(command)) {
        return onData(commands[parseInt(command, 10) - 1]);
      }

      console.log(command.red + ' is not a recognized command.');
      return bind();
    }

    if (command === "exit") {
      return callback();
    }

    // invoke command and provide a means off returning keyboard binding
    self.execCommand(command, bind);
  };

  bind = function () {
    console.log("Available commands are:\n" + commands.list);

    process.stdout.write('> ');
    process.stdin.on('data', onData);
  };


  this.getCommands(function (result) {
    commands = result;

    commands.push('exit');

    commands.list = commands.map(function addDash(file, i) {
      return (' ' + (i + 1) + '  ').slice(0, 4).blue + file;
    }).join('\n');

    bind();
  });
};

module.exports = function (module) {
  module.exports = new PlugIn(path.dirname(module.filename));

  return module.exports;
};
