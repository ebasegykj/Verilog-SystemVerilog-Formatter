#!/usr/bin/env node
const { formatVerilog } = require('./out/formatter');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error('Usage: node cli.js <input.v|input.sv> [indentSize] [output]');
  console.error('  indentSize default 4');
  console.error('  output omitted => print to stdout');
  process.exit(1);
}

const input = args[0];
const indent = args[1] ? parseInt(args[1], 10) : 4;
const output = args[2];

const text = fs.readFileSync(path.resolve(input), 'utf8');
const result = formatVerilog(text, {
  indentSize: indent,
  alignPorts: false,
  alignAssign: false,
});

if (output) {
  fs.writeFileSync(path.resolve(output), result);
  console.log(`Formatted ${input} -> ${output} (${text.length} -> ${result.length} bytes)`);
} else {
  process.stdout.write(result);
}