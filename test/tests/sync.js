"use strict";

const {expect} = require("chai");
const path = require("path");
const requireInject = require("require-inject");

const dbMock = require("../mocks/db");
const fsMock = require("../mocks/fs");
const shotMock = require("../mocks/shot");

const baseDir = "/home/user";
const dbDir = path.join(baseDir, ".vidg.sqlite");
const fileA = {id: 1, path: "a.mp4"};
const fileB = {id: 2, path: "b.mp4"};
const fileC = {id: 3, path: "c.mp4"};

async function getMock(knownFiles, foundFiles) {
  const {MetaDataSync} = requireInject("../../lib/sync", {
    fs: fsMock({[baseDir]: foundFiles}),
    "../../lib/shot": shotMock
  });
  
  let db = dbMock({[dbDir]: knownFiles}).open(dbDir);
  let sync = new MetaDataSync(db);
  await sync.sync({inputDir: baseDir});
  return db;
}

function expectFiles(knownFiles, foundFiles) {
  knownFiles = knownFiles.map(({id, path}) => ({id, path}));
  foundFiles = foundFiles.map((file) => {
    let filepath = path.join(baseDir, file.path);
    return Object.assign({}, file, {path: filepath});
  });
  expect(knownFiles).deep.equal(foundFiles);
}

describe("File syncing", () => {
  it("Nothing to sync", async () => {
    await getMock([], []);
  });
  
  it("Add new files", async () => {
    let foundFiles = [fileA, fileB];
    let db = await getMock([], foundFiles);
    
    let knownFiles = await db.getAllFiles();
    expectFiles(knownFiles, foundFiles);
  });
  
  it("Remove missing files", async () => {
    let foundFiles = [fileA];
    let db = await getMock([fileA, fileB], foundFiles);
    
    let knownFiles = await db.getAllFiles();
    expectFiles(knownFiles, foundFiles);
  });
  
  // TODO: NYI
  it("Update unchanged files", () => {});
  it("Update moved files", () => {});
});
