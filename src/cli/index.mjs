#!/usr/bin/env node

import Path from 'path';
import Open from 'open';
import Express from 'express';
import { parseCommandLine } from './command-line.mjs';
import { startNotificationService } from './notification.mjs';
import { startFileWatch } from './watch.mjs';
import { Folder } from './folder.mjs';

const options = parseCommandLine();
const port = parseInt(options.port) || 8118;
const languageCode = (process.env.LANG || 'en').substr(0, 2).toLowerCase();

if (!Folder.findGitRoot()) {
  console.log('Not inside a Git working folder');
  process.exit(-1);
}
if (options.json) {
  outputJSON();
  process.exit(0);
}

// start up HTTP service
const app = Express();
const server = app.listen(port);
const wwwFolder = Folder.findWWW();
app.set('json spaces', 2);
app.get('/data', async (req, res, next) => {
  try {
    const folder = await Folder.describeCurrent(languageCode);
    const data = folder.exportDescriptions();
    res.json(data);
  } catch (err) {
    next(err);
  }
});
app.get('/images/*', async (req, res, next) => {
  try {
    const relPath = req.params[0];
    const absPath = Path.join(Folder.gitRoot, relPath);
    const folderName = Path.basename(Path.dirname(relPath));
    if (folderName !== '.trambar') {
      res.sendStatus(404);
    } else if (!/\.(jpg|jpeg|png|gif|svg)$/i.test(absPath)) {
      res.sendStatus(404);
    } else {
      res.sendFile(absPath);
    }
  } catch (err) {
    next(err);
  }
});
app.use(Express.static(wwwFolder));

// set up websocket server
startNotificationService(server, !options['no-shutdown']);

// open browser window
//Open(`http://localhost:${port}/`);

if (!options['no-watch']) {
  // start monitoring files
  startFileWatch();
}

async function outputJSON() {
  const folder = await Folder.describeCurrent(languageCode);
  const data = folder.exportData();
  console.log(JSON.stringify(data, undefined, 2));
}
