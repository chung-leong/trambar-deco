import Chokidar from 'chokidar';
import Path from 'path';
import { GitIgnore } from './git-ignore.mjs';
import { Descriptor } from './descriptor.mjs';
import { Folder } from './folder.mjs';

let watcher;

/**
 * Start monitor folders for changes
 */
async function startFileWatch() {
  // Do a scan to populate the .gitignore cache
  await Folder.find(Folder.gitRoot);
  // using .gitignore files to determine what files to ignore
  watcher = Chokidar.watch(Folder.gitRoot, {
    ignored: (filePath) => {
      const name = Path.basename(filePath);
      if (name.charAt(0) === '.') {
        if (name !== '.trambar') {
          return true;
        }
      }
      const folderPath = Path.dirname(filePath);
      const gitignore = GitIgnore.get(folderPath);
      return gitignore.match(filePath);
    },
    ignoreInitial: true,
  });
  watcher.on('add', handleFileChange.bind(null, 'add'));
  watcher.on('change', handleFileChange.bind(null, 'change'));
  watcher.on('unlink', handleFileChange.bind(null, 'unlink'));
}

/**
 * Restart file monitoring
 */
async function restartFileWatch() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  startFileWatch();
}

/**
 * Handle file system change events
 *
 * @param  {String} event
 * @param  {String} path
 */
async function handleFileChange(event, path) {
  let changed = false;
  if (event !== 'change') {
    const folderPath = Path.dirname(path);
    if (Folder.clearCache(folderPath)) {
      changed = true;
    }
  }
  if (GitIgnore.clearCache(path)) {
    // reload .gitignore and restart watch
    await restartFileWatch();
    changed = true;
  }
  if (Descriptor.clearCache(path)) {
    changed = true;
  }
  if (changed) {
    sendChangeNotification();
  }
}

export {
  startFileWatch,
};
