#!/usr/bin/env node
'use strict';

const { init } = require('../lib/scaffolder');

const args = process.argv.slice(2);
const command = args[0];

if (command === 'init') {
  init(process.cwd()).catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });
} else {
  console.log('Usage: npx create-claude-workflow init');
  console.log('');
  console.log('Commands:');
  console.log('  init    Scaffold the Claude workflow into your project');
  process.exit(command ? 1 : 0);
}
