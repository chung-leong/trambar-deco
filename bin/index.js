#!/usr/bin/env node

var _ = require('lodash');
var Promise = require('bluebird');
var FS = Promise.promisifyAll(require('fs'));
var Path = require('path');
var CommandLineArgs = require('command-line-args');
var CommandLineUsage = require('command-line-usage');
var Ignore = require('ignore');

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
      name: 'help',
      alias: 'h',
      type: Boolean,
      description: 'Print this usage guide.'
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

var languageCode = (process.env.LANG || 'zz').substr(0, 2).toLowerCase();

// default to cwd if no folder is given
var folderPaths = options['*'];
if (_.isEmpty(folderPaths)) {
    folderPaths = [ '.' ];
}

// scan directory for files
Promise.map(folderPaths, (folderPath) => {
    return findFiles(folderPath).then((folder) => {
        // look up component description
        return attachComponentsToFiles(folder).return(folder);
    });
}).then((folders) => {
    // get a list of all files
    var files = [];
    _.each(folders, (folder) => {
        collectFiles(folder, files);
    });
    files = _.sortBy(files, 'path');

    // see what files are mapped to each component
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

    _.each(components, (component) => {
        console.log(component.text.en);
        console.log('----------------------------------------');
        var files = componentFileLists.get(component);
        _.each(files, (file) => {
            console.log(file.path);
        });
        console.log('');
    });
});

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
                return new File(childPath);
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

/**
 * Attach component descriptions to files in folder
 *
 * @param  {Folder} folder
 *
 * @return {Promise}
 */
function attachComponentsToFiles(folder) {
    return Promise.each(folder.children, (child) => {
        if (child instanceof Folder) {
            return attachComponentsToFiles(child);
        } else if (child instanceof File) {
            return attachComponentsToFile(child);
        }
    });
}

/**
 * Attach component descriptions to a file
 *
 * @param  {File} file
 *
 * @return {Promise}
 */
function attachComponentsToFile(file) {
    var folderPath = Path.dirname(file.path);
    return loadTrambarFolders(folderPath).map((trambarFolder) => {
        return findMatchingComponents(trambarFolder, file);
    }).then((componentLists) => {
        file.components = _.flatten(componentLists);
    });
}

/**
 * Load descriptions in a .trambar folder
 *
 * @param  {String} parentPath
 *
 * @return {Promise<TrambarFolder|null>}
 */
function loadTrambarFolder(parentPath) {
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
                    component = new Component(name);
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

var trambarFolderCache = {};

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
    return getFolderPaths(targetFolderPath).map((path) => {
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
 * @param  {File} file
 *
 * @return {Array<Component>}
 */
function findMatchingComponents(folder, file) {
    // relative to folder holding .trambar
    var relPath = Path.relative(folder.path, file.path);
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

/**
 * Load .gitignore
 *
 * @param  {String} folderPath
 *
 * @return {Promise<Object>}
 */
function loadGitIgnore(folderPath) {
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

var gitignoreCache = {};

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
    return getFolderPaths(folderPath).map((path) => {
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
 * @return {Promise<Array<String>>}
 */
function getFolderPaths(folderPath) {
    var path = Path.resolve(folderPath);
    var paths = [];
    do {
        paths.push(path);
        var parentPath = Path.dirname(path);
        if (path !== parentPath) {
            path = parentPath;
        } else {
            path = null;
        }
    } while (path);

    // find working folder root
    return Promise.reduce(paths, (newList, path, index) => {
        if (newList !== paths) {
            return newList;
        }
        // see if folder contains .git
        return FS.lstatAsync(`${path}/.git`).then(() => {
            // don't need the ones after index
            return _.slice(paths, 0, index + 1);
        }).catch((err) => {
            return paths;
        });
    }, paths);
}

/**
 * Scan a folder, taking into account rules in .gitignore files
 *
 * @param  {String} folderPath
 *
 * @return {Promise<Array<String>>}
 */
function scanFolder(folderPath) {
    var path = Path.resolve(folderPath);
    var promise = folderCache[path];
    if (promise) {
        return promise;
    }
    // load .gitignore files
    promise = loadGitIgnoreSets(path).then((ignoreSets) => {
        // scan folder
        return FS.readdirAsync(path).catch((err) => {
            return [];
        }).map((childName) => {
            return Path.join(folderPath, childName);
        }).filter((childPath) => {
            // check if file ought to be ignored
            var ignore = false;
            _.each(ignoreSets, (set) => {
                // relative to folder containing the particular .gitignore
                var relPath = Path.relative(set.path, childPath);
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
            return !ignore;
        });
    });
    folderCache[path] = promise;
    return promise;
}

var folderCache = {};

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
 * Clear cache contents
 *
 * @param  {String} folderPath
 */
function clearCache(folderPath) {
    clearFolderCache(folderPath);
    clearGitignoreCache(folderPath);
    clearTrambarFolderCache(folderPath);
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

function TrambarFolder(path, components) {
    this.path = path;
    this.components = components;
}

function Component(name) {
    this.name = name;
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

function File(path) {
    this.path = path;
    this.component = null;
}
