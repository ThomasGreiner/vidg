const childProcess = require("child_process");
const trash = require("trash");
const {promisify} = require("util");

export async function emptyTrash(filepaths) {
  await trash(filepaths);
}

export const execFile = promisify(childProcess.execFile);
