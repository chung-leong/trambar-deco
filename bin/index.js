#!/usr/bin/env node

var _ = require('lodash');
var Promise = require('bluebird');
var FS = Promise.promisifyAll(require('fs'));
var Path = require('path');
var CommandLineArgs = require('command-line-args');
var CommandLineUsage = require('command-line-usage');
var Ignore = require('ignore');
var Chokidar = require('chokidar');
var Express = require('express');

var optionDefinitions = [
    {
        name: '*',
        type: String,
        multiple: true,
        defaultOption: true,
    },
    {
        name: 'watch',
        type: Boolean
    },
    {
        name: 'json',
        type: Boolean,
        description: 'Output component information in JSON format',
    },
    {
        name: 'help',
        alias: 'h',
        type: Boolean,
        description: 'Print this usage guide'
    }
];
var scriptDescription = [
    {
        header: 'Trambar Deco',
        content: 'Generates preview of component descriptions.'
    },
    {
        header: 'Options',
        optionList: _.filter(optionDefinitions, (def) => {
            return !def.defaultOption;
        })
    }
];

var options = CommandLineArgs(optionDefinitions);
if (options.help) {
    var usage = CommandLineUsage(scriptDescription);
    console.log(usage);
    process.exit(0);
}

var port = parseInt(options.port) || 8118;
var languageCode = (process.env.LANG || 'zz').substr(0, 2).toLowerCase();

// default to cwd if no folder is given
var selectedFolderPaths = options['*'];
if (_.isEmpty(selectedFolderPaths)) {
    selectedFolderPaths = [ '.' ];
}
// use absolute paths
selectedFolderPaths = _.map(selectedFolderPaths, (path) => {
    return Path.resolve(path);
});

// look for git root folder
var selectedRootPath;
_.each(selectedFolderPaths, (path) => {
    var rootPath = findGitFolder(path);
    if (!rootPath) {
        console.log(`Not in a git repository: ${path}`);
        process.exit(-1);
    }
    if (selectedRootPath && selectedRootPath !== rootPath) {
        console.log(`In a different git respository: ${path}`);
        process.exit(-1);
    }
    selectedRootPath = rootPath;
});

if (options.json) {
    return findFilesInSelectedfolders().then((folders) => {
        var data = exportData(folders);
        console.log(JSON.stringify(data, undefined, 2));
    });
} else {
    var app = Express();
    app.set('json spaces', 2);

    app.get('/data', function(req, res) {
        return findFilesInSelectedfolders().then((folders) => {
            var data = exportData(folders);
            res.json(data);
        });
    });
    var server = app.listen(port);

    findFilesInSelectedfolders().then((folders) => {
        startFileWatch();
    });
}

var watcher;

/**
 * Start monitor folders for changes
 */
function startFileWatch() {
    watcher = Chokidar.watch(selectedFolderPaths, {
        ignored: shouldIgnoreSync,
        ignoreInitial: true,
    });
    watcher.on('add', (path) => {
        console.log(`File ${path} has been added`);
    });
    watcher.on('change', (path) => {
        console.log(`File ${path} has been changed`);
    });
    watcher.on('unlink', (path) => {
        console.log(`File ${path} has been removed`);
    });
}

/**
 * Restart file monitoring
 */
function restartFileWatch() {
    if (watcher) {
        watcher.close();
        watcher = null;
    }
    startFileWatch();
}

/**
 * Look for files and their descriptoin in selected folders
 *
 * @return {Promise<Array<Folder>>}
 */
function findFilesInSelectedfolders() {
    return Promise.map(selectedFolderPaths, (folderPath) => {
        return findFiles(folderPath);
    });
}

/**
 * Export all data collected about the selected folders
 *
 * @param  {Array<Folder>} folders
 *
 * @return {Object}
 */
function exportData(folders) {
    return {
        folders: exportFolders(folders),
        components: exportComponents(folders),
    };
}

/**
 * Export folder objects
 *
 * @param  {Array<Folder>} folders
 *
 * @return {Array<Object>}
 */
function exportFolders(folders) {
    return _.map(folders, (folder) => {
        return exportFolder(folder);
    })
}

/**
 * Export folder object
 *
 * @param  {Folder} folder
 *
 * @return {Object}
 */
function exportFolder(folder) {
    return {
        path: exportPath(folder.path),
        children: _.map(folder.children, (child) => {
            if (child instanceof Folder) {
                return exportFolder(child);
            } else {
                return exportFile(child);
            }
        }),
    };
}

/**
 * Export file object
 *
 * @param  {File} file
 * @param  {Function} exportPath
 *
 * @return {Object}
 */
function exportFile(file) {
    return {
        path: exportPath(file.path),
        components: _.map(file.components, 'id'),
    };
}

/**
 * Export component descriptions
 *
 * @param  {Array<Folder>} folders
 *
 * @return {Array<Object>}
 */
function exportComponents(folders) {
    // get a list of all files
    var files = [];
    _.each(folders, (folder) => {
        collectFiles(folder, files);
    });
    files = _.sortBy(files, 'path');

    // create a map connecting files to components
    var components = [];
    var componentFileLists = new WeakMap;
    _.each(files, (file) => {
        _.each(file.components, (component) => {
            var fileList = componentFileLists.get(component);
            if (!fileList) {
                fileList = [];
                componentFileLists.set(component, fileList);
                components.push(component);
            }
            fileList.push(file);
        });
    });

    return _.map(components, (component) => {
        var fileList = componentFileLists.get(component);
        var object = {};
        object.id = component.id;
        object.text = component.text;
        if (component.imageFile) {
            object.image = exportPath(component.imageFile);
        }
        if (component.icon) {
            object.icon = component.icon;
        }
        object.files = _.map(fileList, (file) => {
            return exportPath(file.path);
        });
        return object;
    });
}

/**
 * Return path relative to git root
 *
 * @param  {String} path
 *
 * @return {String}
 */
function exportPath(path) {
    return Path.relative(selectedRootPath, path);
}

/**
 * Scan for files in a folder
 *
 * @param  {String} folderPath
 *
 * @return {Promise<Folder>}
 */
function findFiles(folderPath) {
    // load .trambar contents for this folder
    return loadTrambarFolders(folderPath).then((trambarFolders) => {
        return scanFolder(folderPath).mapSeries((childPath) => {
            return FS.lstatAsync(childPath).then((stats) => {
                if (stats.isDirectory()) {
                    var name = Path.basename(childPath);
                    if (name !== '.git') {
                        return findFiles(childPath);
                    } else {
                        return null;
                    }
                } else {
                    return Promise.map(trambarFolders, (trambarFolder) => {
                        return findMatchingComponents(trambarFolder, childPath);
                    }).then((componentLists) => {
                        var components = _.flatten(componentLists);
                        return new File(childPath, components);
                    });
                }
            });
        }).then((children) => {
            children = _.filter(children);
            return new Folder(folderPath, children);
        });
    });
}

/**
 * Add files to an array
 *
 * @param  {Folder} folder
 * @param  {Array}  list
 */
function collectFiles(folder, list) {
    _.each(folder.children, (child) => {
        if (child instanceof Folder) {
            collectFiles(child, list);
        } else {
            list.push(child);
        }
    });
}

var trambarFolderCache;

/**
 * Load descriptions in a .trambar folder
 *
 * @param  {String} parentPath
 *
 * @return {Promise<TrambarFolder|null>}
 */
function loadTrambarFolder(parentPath) {
    if (!trambarFolderCache) {
        trambarFolderCache = {};
    }
    var promise = trambarFolderCache[parentPath];
    if (promise) {
        return promise;
    }
    promise = scanFolder(`${parentPath}/.trambar`).then((filePaths) => {
        // group the contents based on the names of the files
        var components = [];
        _.each(filePaths, (filePath) => {
            var fileName = Path.basename(filePath);
            var name;
            var textFile, iconFile, imageFile, matchFile;
            var match;
            if (match = /(.*?)(\.([a-z]{2}))?\.md$/.exec(fileName)) {
                name = match[1];
                textFile = _.set({}, match[3] || languageCode, filePath);
            } else if (match = /(.*)\.(jpeg|jpg|png|gif)$/.exec(fileName)) {
                name = match[1];
                imageFile = filePath;
            } else if (match = /(.*)\.fa$/.exec(fileName)) {
                name = match[1];
                iconFile = filePath;
            } else if (match = /(.*)\.match$/.exec(fileName)) {
                name = match[1];
                matchFile = filePath;
                component = { name, matchFile };
            }
            if (name) {
                var component = _.find(components, { name });
                if (!component) {
                    var id = Path.relative(selectedRootPath, `${parentPath}/${name}`);
                    component = new Component(name, id);
                    components.push(component);
                }
                if (textFile) {
                    _.assign(component.textFile, textFile);
                } else if(imageFile) {
                    component.imageFile = imageFile;
                } else if (iconFile) {
                    component.iconFile = iconFile;
                } else if (matchFile) {
                    component.matchFile = matchFile;
                }
            }
        });
        return components;
    }).mapSeries((component) => {
        // load text files
        var promises = {
            matchRules: Promise.resolve(component.matchFile).then((path) => {
                if (!path) {
                    return null;
                }
                // load file with fn patterns
                return FS.readFileAsync(path, 'utf8').then((text) => {
                    var patterns = _.split(text, /[\r\n]+/);
                    // use engine for handling .gitignore files to match
                    var matchRules = Ignore().add(patterns);
                    matchRules.match = matchRules.ignores;
                    return matchRules;
                });
            }),
            icon: Promise.resolve(component.iconFile).then((path) => {
                if (!path) {
                    return null;
                }
                // load file with font-awesome class name
                return FS.readFileAsync(path, 'utf8').then((text) => {
                    var lines = _.split(text, /[\r\n]+/);
                    var props = {};
                    _.each(lines, (line) => {
                        if (!/^\s*#/.test(line)) {
                            var match = /^\s*([a-z\-]+)\s*\:\s*(\S*)/.exec(line);
                            if (match) {
                                props[match[1]] = match[2].replace(/\;$/, '');
                            }
                        }
                    });
                    return _.pick(props, 'class', 'color', 'background-color');
                });
            }),
            text: Promise.resolve(component.textFile).then((paths) => {
                // load each language version
                return Promise.props(_.mapValues(paths, (path, lang) => {
                    return FS.readFileAsync(path, 'utf8');
                }));
            }),
        };
        // wait for promises to resolve then set properties
        return Promise.props(promises).then((props) => {
            _.assign(component, props);
            return component;
        });
    }).then((components) => {
        if (!_.isEmpty(components)) {
            return new TrambarFolder(parentPath, components);
        } else {
            return null;
        }
    });
    trambarFolderCache[parentPath] = promise;
    return promise;
}

/**
 * Clear cached .trambar folders
 *
 * @param  {String} folderPath
 */
function clearTrambarFolderCache(folderPath) {
    if (!folderPath) {
        trambarFolderCache = {};
    } else {
        trambarFolderCache = omitfolder(trambarFolderCache, folderPath);
    }
}

/**
 * Load descriptions in .trambar folders
 *
 * @param  {String} targetFolderPath
 *
 * @return {Promise<Array<TrambarFolder>>}
 */
function loadTrambarFolders(targetFolderPath) {
    var paths = getFolderPaths(targetFolderPath);
    return Promise.map(paths, (path) => {
        return loadTrambarFolder(path);
    }).then((folders) => {
        return _.filter(folders);
    });
}

/**
 * Find component definition in a .trambar folder matching
 * a file
 *
 * @param  {TrambarFolder} folder
 * @param  {String} path
 *
 * @return {Array<Component>}
 */
function findMatchingComponents(folder, path) {
    // relative to folder holding .trambar
    var relPath = Path.relative(folder.path, path);
    var relPathNoExt = relPath.replace(/\.\w*$/, '');
    var components = _.filter(folder.components, (component) => {
        if (component.matchRules) {
            // match based on patterns in .match
            if (component.matchRules.match(relPath)) {
                return true;
            }
        } else {
            // match by name (without extension)
            if (component.name === relPathNoExt) {
                return true;
            }
        }
    });
    return components;
}

var gitignoreCache;

/**
 * Load .gitignore
 *
 * @param  {String} folderPath
 *
 * @return {Promise<Object>}
 */
function loadGitIgnore(folderPath) {
    if (!gitignoreCache) {
        gitignoreCache = {};
    }
    var promise = gitignoreCache[folderPath];
    if (promise) {
        return promise;
    }
    var gitignorePath = `${folderPath}/.gitignore`;
    promise = FS.lstatAsync(gitignorePath).then((stats) => {
        return FS.readFileAsync(gitignorePath, 'utf8').then((text) => {
            var patterns = _.split(text, /[\r\n]+/);
            var scanner = Ignore().add(patterns);
            scanner.unignores = function(path) {
                var ignore = undefined;
                _.each(this._rules, (rule) => {
                    if (rule.regex.test(path)) {
                        ignore = !rule.negative;
                    }
                });
                return ignore === false;
            };
            return {
                path: folderPath,
                scanner: scanner,
            };
        });
    }).catch((err) => {
        return null;
    });
    gitignoreCache[folderPath] = promise;
    return promise;
}

/**
 * Clear cached .ignore files
 *
 * @param  {String} folderPath
 */
function clearGitignoreCache(folderPath) {
   if (!folderPath) {
       gitignoreCache = {};
   } else {
       gitignoreCache = omitfolder(gitignoreCache, folderPath);
   }
}

/**
 * Load .gitignore at path and those in parent folders
 *
 * @param  {String} folderPath
 *
 * @return {Promise<Array<Object>>}
 */
function loadGitIgnoreSets(folderPath) {
    // get paths to parent folders (up to root of git working folder)
    var paths = getFolderPaths(folderPath);
    return Promise.map(paths, (path) => {
        return loadGitIgnore(path);
    }).then((sets) => {
        return _.reverse(_.filter(sets));
    });
}

/**
 * Return absolute path to folder and paths of its parent folders, up
 * to root of git working folder
 *
 * @param  {String} folderPath
 *
 * @return {Array<String>}
 */
function getFolderPaths(folderPath) {
    var path = folderPath;
    var paths = [];
    do {
        paths.push(path);
        var parentPath = Path.dirname(path);
        if (path !== parentPath && path !== selectedRootPath) {
            path = parentPath;
        } else {
            path = null;
        }
    } while (path);
    return paths;
}

/**
 * Return git folder that the given folder is contained in
 *
 * @param  {String} folderPath
 *
 * @return {String|null}
 */
function findGitFolder(folderPath) {
    var path = folderPath;
    do {
        if (FS.existsSync(`${path}/.git`)) {
            return path;
        }
        var parentPath = Path.dirname(path);
        if (path !== parentPath) {
            path = parentPath;
        } else {
            path = null;
        }
    } while (path)
    return null;
}

var folderCache;

/**
 * Scan a folder, taking into account rules in .gitignore files
 *
 * @param  {String} folderPath
 *
 * @return {Promise<Array<String>>}
 */
function scanFolder(folderPath) {
    if (!folderCache) {
        folderCache = {};
    }
    var promise = folderCache[folderPath];
    if (promise) {
        return promise;
    }
    // load .gitignore files
    promise = loadGitIgnoreSets(folderPath).then((ignoreSets) => {
        // scan folder
        return FS.readdirAsync(folderPath).catch((err) => {
            return [];
        }).map((childName) => {
            return Path.join(folderPath, childName);
        }).filter((childPath) => {
            return !shouldIgnore(childPath, ignoreSets);
        });
    });
    folderCache[folderPath] = promise;
    return promise;
}

var folderCache;

/**
 * Clear folder cache
 *
 * @param  {String} folderPath
 */
function clearFolderCache(folderPath) {
    if (!folderPath) {
        folderCache = {};
    } else {
        folderCache = omitFolder(folderCache, folderPath);
    }
}

/**
 * Return true if file should be ignored according to .gitignore
 *
 * @param  {String} path
 * @param  {Array<Object>} ignoreSets
 *
 * @return {Boolean}
 */
function shouldIgnore(path, ignoreSets) {
    var ignore = false;
    _.each(ignoreSets, (set) => {
        // relative to folder containing the particular .gitignore
        var relPath = Path.relative(set.path, path);
        if (set.scanner.ignores(relPath)) {
            ignore = true;
        } else if (ignore) {
            // see if a deeper-level .gitignore is overriding rules
            // imposed further up
            if (set.scanner.unignores(relPath)) {
                ignore = false;
            }
        }
    });
    return ignore;
}

/**
 * Return a object without keys that match the path
 *
 * @param  {Object} cache
 * @param  {String} folderPath
 *
 * @return {Object}
 */
function omitFolder(cache, folderPath) {
    return _.omitBy(cache, (value, path) => {
        if (path.indexOf(folderPath) === 0) {
            if (path.charAt(folderPath.length) === '/') {
                return true;
            }
        }
    });
}

/**
 * Check if a file should be ignored synchronously, using data
 * from gitignoreCache
 *
 * @param  {String} filePath
 *
 * @return {Boolean}
 */
function shouldIgnoreSync(filePath) {
    var folderPath = Path.dirname(filePath);
    var paths = getFolderPaths(folderPath);
    var ignoreSets = _.map(paths, (path) => {
        var promise = gitignoreCache[path];
        if (promise) {
            return promise.value();
        }
    });
    ignoreSets = _.reverse(_.filter(ignoreSets));
    return shouldIgnore(filePath, ignoreSets);
}

function TrambarFolder(path, components) {
    this.path = path;
    this.components = components;
}

function Component(name, id) {
    this.name = name;
    this.id = id;
    this.textFile = {};
    this.text = {};
    this.imageFile = null;
    this.iconFile = null;
    this.icon = null;
    this.matchFile = null;
    this.matchRules = null;
}

function Folder(path, children) {
    this.path = path;
    this.children = children;
}

function File(path, components) {
    this.path = path;
    this.components = components;
}
