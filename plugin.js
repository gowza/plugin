/*jslint
  node: true
  indent: 2
*/

"use strict";

var fs = require('fs'),
  is = require('is'),
  path = require('path');

// Since this module is loaded as a symlink, it can be 
// best to use the parent's require path
module.paths = module.parent.paths;

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

  function stripJs(file) {
    return file.replace(/\.js$/, '');
  }

  fs.readdir(this.dir, function (err, files) {
    var commands = files.filter(noIndexJs)
      .map(stripJs);

    callback.call(self, commands);
  });
};

PlugIn.prototype.execCommand = function execCommand(command, callback) {
  var commandTest;

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
