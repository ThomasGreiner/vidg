"use strict";

const fs = require("fs");
const path = require("path");
const Mocha = require("mocha");
const {promisify} = require("util");

const readDir = promisify(fs.readdir);
const testsDir = path.join(__dirname, "tests");

async function run() {
  let mochaRunner = new Mocha({});
  
  let files = await readDir(testsDir);
  for (let file of files)
  {
    mochaRunner.addFile(path.join(testsDir, file));
  }
  
  process.env.VIDG_MODE = "test";
  mochaRunner.run((failures) =>
  {
    delete process.env.VIDG_MODE;
    
    if (failures)
      throw failures;
  });
}

run();
