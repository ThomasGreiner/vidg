import "./window.js";
import {MetaDataSync} from "./sync/index.js";

// TODO: remove
// nw.Window.get().showDevTools();

import * as database from "./storage/db.js";
import * as server from "./server/index.js";
import * as ui from "./ui/index.js";

const [, inputDir] = nw.App.argv;

try {
  const db = await database.open(inputDir);
  const metaSync = new MetaDataSync(db);
  await metaSync.sync(inputDir);
  await server.listen(8080);
  await ui.load(db);
} catch(ex) {
  console.error(`Bootstrap error: ${ex.stack}`);
}
