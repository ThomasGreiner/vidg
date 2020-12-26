"use strict";

const {expect} = require("chai");
const path = require("path");
const requireInject = require("require-inject");

const dbMock = require("../mocks/db");
const fsMock = require("../mocks/fs");
const shotMock = require("../mocks/shot");

const baseDir = "/home/user";
const dbDir = path.join(baseDir, ".vidg.sqlite");
const fileA = {id: 1, path: "a.mp4", stats: {}};
const fileB = {id: 2, path: "b.mp4", stats: {}};
const fileC = {id: 3, path: "c.mp4", stats: {}};

async function getMock(knownFiles, foundFiles, opts = {}) {
  const {MetaDataSync} = requireInject("../../lib/sync", {
    fs: fsMock({[baseDir]: foundFiles}),
    "../../lib/sync/shot": shotMock
  });
  
  let db = dbMock({[dbDir]: knownFiles}).open(dbDir);
  let sync = new MetaDataSync(db);
  
  opts = Object.assign({inputDir: baseDir}, opts);
  await sync.sync(opts);
  return db;
}

function expectFiles(knownFiles, foundFiles) {
  knownFiles = knownFiles.map(({id, path}) => ({id, path}));
  foundFiles = foundFiles.map((file) => {
    let filepath = path.join(baseDir, file.path);
    return {id: file.id, path: filepath};
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
    
    let previews = knownFiles.map(({preview}) => preview);
    let expectedPreviews = knownFiles
        .map(({path}) => shotMock.getPreview(path));
    expect(previews).deep.equal(expectedPreviews);
  });
  
  it("Remove missing files", async () => {
    let foundFiles = [fileA];
    let db = await getMock([fileA, fileB], foundFiles);
    
    let knownFiles = await db.getAllFiles();
    expectFiles(knownFiles, foundFiles);
  });
  
  it("Update incomplete files", async () => {
    let existingPreview = "data:foo";
    let foundFiles = [fileA, fileB];
    let db = await getMock([
      Object.assign({preview: existingPreview}, fileA),
      fileB
    ], foundFiles, {update: true});
    
    let knownFiles = await db.getAllFiles();
    expectFiles(knownFiles, foundFiles);
    
    let previews = knownFiles.map(({preview}) => preview);
    let expectedPreviews = previews.slice();
    expectedPreviews[0] = existingPreview;
    expect(previews).deep.equal(expectedPreviews);
  });
  
  it("Force update all files", async () => {
    let existingPreview = "data:foo";
    let foundFiles = [fileA, fileB];
    let db = await getMock([
      Object.assign({preview: existingPreview}, fileA),
      fileB
    ], foundFiles, {forceUpdate: true});
    
    let knownFiles = await db.getAllFiles();
    expectFiles(knownFiles, foundFiles);
    
    let previews = knownFiles.map(({preview}) => preview);
    let expectedPreviews = knownFiles
        .map(({path}) => shotMock.getPreview(path));
    expect(previews).deep.equal(expectedPreviews);
  });
  
  it("Update moved files", async () => {
    let foundFiles = [
      Object.assign({}, fileA, {path: "aa.mp4"})
    ];
    let db = await getMock([fileA], foundFiles);
    
    let knownFiles = await db.getAllFiles();
    expectFiles(knownFiles, foundFiles);
  });
});
