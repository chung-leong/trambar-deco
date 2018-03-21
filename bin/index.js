#!/usr/bin/env node

var _ = require('lodash');
var Promise = require('bluebird');
var FS = Promise.promisifyAll(require('fs'));
var Path = require('path');
var CommandLineArgs = require('command-line-args');
var CommandLineUsage = require('command-line-usage');
var Open = require('open');
var Ignore = require('ignore');
var Chokidar = require('chokidar');
var Express = require('express');
var SockJS = require('sockjs');
var MarkGor = require('mark-gor');

var optionDefinitions = [
    {
        name: '*',
        type: String,
        multiple: true,
        defaultOption: true,
    },
    {
        name: 'no-watch',
        type: Boolean,
        description: 'Do not monitor folders for changes',
    },
    {
        name: 'no-shutdown',
        type: Boolean,
        description: 'Do not exit script when browser window closes'
    },
    {
        name: 'json',
        alias: 'j',
        type: Boolean,
        description: 'Output component information in JSON format',
    },
    {
        name: 'port',
        alias: 'p',
        type: Number,
        description: 'Port number to use (default = 8118)',
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

try {
    var options = CommandLineArgs(optionDefinitions);
    if (options.help) {
        var usage = CommandLineUsage(scriptDescription);
        console.log(usage);
        process.exit(0);
    }
} catch(err) {
    console.log(err.message);
    process.exit(-1);
}

var port = parseInt(options.port) || 8118;
var languageCode = (process.env.LANG || 'en').substr(0, 2).toLowerCase();

var currentFolderPath = Path.resolve('.');
var gitRootPath = findGitFolder(currentFolderPath);
if (!gitRootPath) {
    console.log('Not inside a Git working folder');
    process.exit(-1);
}

if (options.json) {
    return describeCurrentFolder().then((folder) => {
        var data = exportData(folder);
        console.log(JSON.stringify(data, undefined, 2));
    });
} else {
    var app = Express();
    var server = app.listen(port);
    app.set('json spaces', 2);
    app.get('/data', function(req, res) {
        return describeCurrentFolder().then((folder) => {
            var data = exportData(folder);
            res.json(data);
        });
    });
    app.get('/images/*', function(req, res) {
        var relPath = req.params[0];
        var absPath = Path.join(gitRootPath, relPath);
        var folderName = Path.basename(Path.dirname(relPath));
        if (folderName !== '.trambar') {
            res.sendStatus(404);
        } else if (!/\.(jpg|jpeg|png|gif|svg)$/i.test(absPath)) {
            res.sendStatus(404);
        } else if (!FS.existsSync(absPath)) {
            res.sendStatus(404);
        } else {
            res.sendFile(absPath);
        }
    });
    app.use(Express.static(Path.join(__dirname, 'www')));

    // add websocket handling
    var sockJS = SockJS.createServer({
        sockjs_url: 'http://cdn.jsdelivr.net/sockjs/1.1.2/sockjs.min.js',
        log: () => {},
    });
    var sockets = [];
    sockJS.on('connection', (socket) => {
        sockets.push(socket);
        socket.on('close', () => {
            _.pull(sockets, socket);
            if (!options['no-shutdown']) {
                if (sockets.length === 0) {
                    beginAutomaticShutdown();
                }
            }
        });
        stopAutomaticShutdown();
    });
    sockJS.installHandlers(server, { prefix:'/socket' });

    Open(`http://localhost:${port}/`);

    function sendChangeNotification() {
        _.each(sockets, (socket) => {
            socket.write('change');
        });
    }

    var shutdownTimeout;

    function stopAutomaticShutdown() {
        clearTimeout(shutdownTimeout);
    }

    function beginAutomaticShutdown() {
        shutdownTimeout = setTimeout(() => {
            process.exit(0);
        }, 2000);
    }

    // do a scan to populate the .gitignore cache, then
    // start watching the source folders for changes
    if (!options['no-watch']) {
        scanWorkingFolder().then((folder) => {
            startFileWatch();
        });
    }

    var watcher;

    /**
     * Start monitor folders for changes
     */
    function startFileWatch() {
        // using .gitignore files to determine what files to ignore
        watcher = Chokidar.watch(gitRootPath, {
            ignored: shouldIgnoreSync,
            ignoreInitial: true,
        });
        watcher.on('add', (path) => {
            var changes = [
                invalidateFolderlisting(path),
                invalidateDescriptor(path),
                invalidateGitIgnore(path),
            ];
            if (_.some(changes)) {
                sendChangeNotification();
            }
        });
        watcher.on('change', (path) => {
            var changes = [
                invalidateDescriptor(path),
                invalidateGitIgnore(path),
            ];
            if (_.some(changes)) {
                sendChangeNotification();
            }
        });
        watcher.on('unlink', (path) => {
            var changes = [
                invalidateFolderlisting(path),
                invalidateDescriptor(path),
                invalidateGitIgnore(path),
            ];
            if (_.some(changes)) {
                sendChangeNotification();
            }
        });
    }

    /**
     * Invalidate folder cache
     *
     * @param  {String} path
     *
     * @return {Boolean}
     */
    function invalidateFolderlisting(path) {
        var folderPath = Path.dirname(path);
        return clearFolderCache(folderPath);
    }

    /**
     * Invalidate .trambar cache
     *
     * @param  {String} path
     *
     * @return {Boolean}
     */
    function invalidateDescriptor(path) {
        return clearDescriptorCache(path);
    }

    /**
     * Invlalidate .gitignore
     *
     * @param  {String} path
     *
     * @return {Boolean}
     */
    function invalidateGitIgnore(path) {
        if (clearGitignoreCache(path)) {
            // reload .gitignore and restart watch
            scanWorkingFolder().then(() => {
                restartFileWatch();
            });
            return true;
        }
        return false;
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
}

/**
 * Look for files and their descriptoin in selected folders
 *
 * @return {Promise<Folder>}
 */
function describeCurrentFolder() {
    return findFiles(currentFolderPath).then((folder) => {
        return loadDescriptors(gitRootPath).then((descriptors) => {
            applyDescriptors(folder, descriptors);
            return folder;
        });
    });
}

/**
 * Look for files in current folder
 *
 * @return {Promise<Folder>}
 */
function scanWorkingFolder() {
    return findFiles(gitRootPath);
}

/**
 * Export all data collected about the current folder
 *
 * @param  Folder} folder
 *
 * @return {Object}
 */
function exportData(folder) {
    return {
        components: exportComponents(folder),
        folder: exportFolder(folder, true),
        root: gitRootPath,
    };
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
                return exportFile(child, true);
            }
        }),
    };
}

/**
 * Export file object
 *
 * @param  {File} file
 * @param  {Boolean} includeComponents
 *
 * @return {Object}
 */
function exportFile(file, includeComponents) {
    var object = {
        path: exportPath(file.path),
        text: file.text,
    };
    if (includeComponents && !_.isEmpty(file.components)) {
        object.components = _.map(file.components, 'id');
    }
    return object;
}

/**
 * Export component descriptions
 *
 * @param  {Folder} folder
 *
 * @return {Array<Object>}
 */
function exportComponents(folder) {
    // get a list of all files
    var files = [];
    collectFiles(folder, files);
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
        var object = _.clone(component);
        object.files = _.map(fileList, (file) => {
            return exportFile(file, false);
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
    return Path.relative(gitRootPath, path);
}

/**
 * Scan for files in a folder
 *
 * @param  {String} folderPath
 *
 * @return {Promise<Folder>}
 */
function findFiles(folderPath) {
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
                return isTextFile(childPath).then((text) => {
                    return new File(childPath, text);
                });
            }
        });
    }).then((children) => {
        children = _.filter(children);
        return new Folder(folderPath, children);
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

var trambarDescriptorCache;

function loadDescriptor(path, folderPath) {
    if (!trambarDescriptorCache) {
        trambarDescriptorCache = {};
    }
    var promise = trambarDescriptorCache[path];
    if (promise) {
        return promise;
    }
    promise = parseDescriptorFile(path, languageCode).then((info) => {
        var rules = info.rules;
        var name = _.replace(Path.basename(path), /\.\w+$/, '');
        if (!rules) {
            // implict rule: match <filename>.*
            rules = [ `${name}.*` ];
        }
        var id = `${folderPath}/${name}`;
        var iconURL = info.icon;
        if (iconURL) {
            if (!/^\w+?:/.test(iconURL)) {
                var trambarFolderPath = Path.dirname(path);
                var iconPath = `${trambarFolderPath}/${iconURL}`;
                var imageRelativePath = Path.relative(gitRootPath, iconPath);
                iconURL = `images/${imageRelativePath}`;
            }
        }
        var component = new Component(id, info.descriptions, iconURL);
        var descriptor = new Descriptor(name, folderPath, rules, component);
        return descriptor;
    });
    trambarDescriptorCache[path] = promise;
    return promise;
}

function loadDescriptors(folderPath) {
    return scanFolder(`${folderPath}/.trambar`).filter((filePath) => {
        return /\.md$/.test(filePath);
    }).mapSeries((filePath) => {
        return loadDescriptor(filePath, folderPath);
    }).then((descriptors) => {
        return scanFolder(folderPath).filter((childPath) => {
            return FS.lstatAsync(childPath).then((stats) => {
                if (stats.isDirectory()) {
                    // .trambar folder cannot be nested
                    var name = Path.basename(childPath);
                    if (name !== '.trambar') {
                        return true;
                    }
                }
            });
        }).each((childFolderPath) => {
            return loadDescriptors(childFolderPath).each((descriptor) => {
                descriptors.push(descriptor);
            });
        }).then(() => {
            return descriptors;
        });
    });
}

/**
 * Add component descriptions to files in folder
 *
 * @param  {Folder|File} object
 * @param  {Array<Descriptor>}
 */
function applyDescriptors(object, descriptors) {
    if (object instanceof File) {
        var file = object;
        var isTrambar = /\/.trambar\//;
        var matching = _.filter(descriptors, (descriptor) => {
            if (descriptor.matching) {
                if (isInFolder(file.path, descriptor.folderPath)) {
                    if (!isTrambar.test(file.path)) {
                        var relativePath = Path.relative(descriptor.folderPath, file.path);
                        if (descriptor.matching(relativePath)) {
                            return true;
                        } else {
                            return false;
                        }
                    }
                }
            }
            if (descriptor.matchingRelative) {
                if (!isTrambar.test(file.path)) {
                    var relativePath = Path.relative(descriptor.folderPath, file.path);
                    if (descriptor.matchingRelative(relativePath)) {
                        return true;
                    } else {
                        return false;
                    }
                }
            }
            if (descriptor.matchingTrambar) {
                if (isTrambar.test(file.path)) {
                    var relativePath = Path.relative(descriptor.folderPath, file.path);
                    if (descriptor.matchingTrambar(relativePath)) {
                        return true;
                    }
                }
            }
        });
        file.components = _.map(matching, 'component');
    } else if (object instanceof Folder) {
        var folder = object;
        _.each(folder.children, (child) => {
            applyDescriptors(child, descriptors);
        });
    }
}

function isInFolder(filePath, folderPath) {
    var len = folderPath.length;
    if (filePath.substr(0, len) === folderPath) {
        if (filePath.charAt(len) === '/') {
            return true;
        }
    }
    return false;
}

/**
 * Clear cached .trambar folders
 *
 * @param  {String} filePath
 *
 * @return {Boolean}
 */
function clearDescriptorCache(filePath) {
    if (!filePath) {
        trambarDescriptorCache = {};
        return true;
    } else {
        if (trambarDescriptorCache[filePath]) {
            trambarDescriptorCache = _.omit(trambarDescriptorCache, filePath);
            return true;
        }
    }
    return false;
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
       gitignoreCache = omitFolder(gitignoreCache, folderPath);
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
        if (path !== parentPath && path !== gitRootPath) {
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
 *
 * @return {Boolean}
 */
function clearFolderCache(folderPath) {
    if (!folderPath) {
        folderCache = {};
        return true;
    } else {
        var before = _.size(folderCache);
        folderCache = omitFolder(folderCache, folderPath);
        return _.size(folderCache) < before;
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
            if (path.length === folderPath.length) {
                return true;
            } else if (path.charAt(folderPath.length) === '/') {
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
    var name = Path.basename(filePath);
    if (name.charAt(0) === '.') {
        if (name !== '.trambar') {
            return true;
        }
    }
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

/**
 * Check if a file contains text
 *
 * @param  {String} path
 *
 * @return {Promise<Boolean>}
 */
function isTextFile(path) {
    return FS.openAsync(path, 'r').then((fd) => {
        var buffer = new Buffer(1024);
        return FS.readAsync(fd, buffer, 0, buffer.length, 0).then((len) => {
            var bytes = new Uint8Array(buffer);
            for (var i = 0; i < len; i++) {
                if (bytes[i] === 0) {
                    return false;
                }
            }
            return true;
        }).finally(() => {
            return FS.closeAsync(fd);
        });
    }).catch((err) => {
        console.log(err.message);
        return false;
    });
}

/**
 * Parse a Trambar-specific Markdown file
 *
 * @param  {String} path
 * @param  {String} defaultLanguageCode
 *
 * @return {Promise<Object>}
 */
function parseDescriptorFile(path, defaultLanguageCode) {
    return FS.readFileAsync(path, 'utf-8').then((text) => {
        var parser = new MarkGor.Parser;
        var tokens = parser.parse(text);

        var languageTokens = {};
        var defaultLanguageTokens = [];
        var currentLanguageTokens = defaultLanguageTokens;
        var fileMatchDefinitions = [];
        var icon = null;
        _.each(tokens, (token) => {
            if (token.type === 'heading') {
                var cap = _.trim(token.captured);
                var m = /^#\s*([a-z]{2})\b/.exec(cap);
                if (m) {
                    var code = m[1];
                    languageTokens[code] = currentLanguageTokens = [];
                    return;
                }
            } else if (token.type === 'code') {
                if (token.lang === 'fnmatch' || token.lang === 'match') {
                    fileMatchDefinitions.push(token.text);
                    return;
                }
            } else if (token.type === 'def') {
                if (token.name === 'icon') {
                    icon = token.href;
                    return;
                }
            }
            currentLanguageTokens.push(token);
        });
        if (!languageTokens[defaultLanguageCode]) {
            languageTokens[defaultLanguageCode] = defaultLanguageTokens;
        }
        var descriptions = _.mapValues(languageTokens, (tokens) => {
            var fragments = _.map(tokens, 'captured');
            var text = fragments.join('');
            return _.trim(text);
        });
        var rules = null;
        if (!_.isEmpty(fileMatchDefinitions)) {
            rules = _.flatten(_.map(fileMatchDefinitions, (patterns) => {
                return _.filter(_.split(patterns, /[\r\n]+/));
            }));
        }
        return { descriptions, rules, icon };
    });
}

/**
 * Parse rules for matching filename against patterns
 *
 * @param  {Array<String>} rules
 *
 * @return {Function|null}
 */
function parseFnmatchRules(rules) {
    // use engine for handling .gitignore files to match
    if (_.isEmpty(rules)) {
        return null;
    }
    var ignoreEngine = Ignore().add(rules);
    return (path) => {
        return ignoreEngine.ignores(path);
    };
}

function Descriptor(name, folderPath, rules, component) {
    this.name = name;
    this.folderPath = folderPath;
    this.component = component;
    this.rules = rules;

    var hierarchicalRules = [];
    var relativeRules = [];
    var trambarRules = [];
    var isRelative = /^\s*\.\.\//;
    var isTrambar = /\/.trambar\//;
    _.each(rules, (rule) => {
        if (!rule) {
            return;
        }
        if (isTrambar.test(rule)) {
            trambarRules.push(rule);
        } else if (isRelative.test(rule)) {
            // a rule that requires a relative path
            relativeRules.push(rule);
        } else {
            // a normal rule
            hierarchicalRules.push(rule);
        }
    });
    this.matching = parseFnmatchRules(hierarchicalRules);
    this.matchingRelative = parseFnmatchRules(relativeRules);
    this.matchingTrambar = parseFnmatchRules(trambarRules);
}

function Component(id, text, url) {
    this.id = id;
    this.text = text;
    if (/^fa:\/\//.test(url)) {
        // special Font-Awesome URL fa://
        var parts = _.split(url.substr(5), '/');
        this.icon = {
            class: parts[0],
            backgroundColor: parts[1] || null,
            color: parts[2] || null,
        };
    } else if (url) {
        this.image = { url };
    }
}

function Folder(path, children) {
    this.path = path;
    this.children = children;
}

function File(path, text) {
    this.path = path;
    this.text = text;
    this.components = null;
}
