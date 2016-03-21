"format global";
(function(global) {

  var defined = {};

  // indexOf polyfill for IE8
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var getOwnPropertyDescriptor = true;
  try {
    Object.getOwnPropertyDescriptor({ a: 0 }, 'a');
  }
  catch(e) {
    getOwnPropertyDescriptor = false;
  }

  var defineProperty;
  (function () {
    try {
      if (!!Object.defineProperty({}, 'a', {}))
        defineProperty = Object.defineProperty;
    }
    catch (e) {
      defineProperty = function(obj, prop, opt) {
        try {
          obj[prop] = opt.value || opt.get.call(obj);
        }
        catch(e) {}
      }
    }
  })();

  function register(name, deps, declare) {
    if (arguments.length === 4)
      return registerDynamic.apply(this, arguments);
    doRegister(name, {
      declarative: true,
      deps: deps,
      declare: declare
    });
  }

  function registerDynamic(name, deps, executingRequire, execute) {
    doRegister(name, {
      declarative: false,
      deps: deps,
      executingRequire: executingRequire,
      execute: execute
    });
  }

  function doRegister(name, entry) {
    entry.name = name;

    // we never overwrite an existing define
    if (!(name in defined))
      defined[name] = entry;

    // we have to normalize dependencies
    // (assume dependencies are normalized for now)
    // entry.normalizedDeps = entry.deps.map(normalize);
    entry.normalizedDeps = entry.deps;
  }


  function buildGroups(entry, groups) {
    groups[entry.groupIndex] = groups[entry.groupIndex] || [];

    if (indexOf.call(groups[entry.groupIndex], entry) != -1)
      return;

    groups[entry.groupIndex].push(entry);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];

      // not in the registry means already linked / ES6
      if (!depEntry || depEntry.evaluated)
        continue;

      // now we know the entry is in our unlinked linkage group
      var depGroupIndex = entry.groupIndex + (depEntry.declarative != entry.declarative);

      // the group index of an entry is always the maximum
      if (depEntry.groupIndex === undefined || depEntry.groupIndex < depGroupIndex) {

        // if already in a group, remove from the old group
        if (depEntry.groupIndex !== undefined) {
          groups[depEntry.groupIndex].splice(indexOf.call(groups[depEntry.groupIndex], depEntry), 1);

          // if the old group is empty, then we have a mixed depndency cycle
          if (groups[depEntry.groupIndex].length == 0)
            throw new TypeError("Mixed dependency cycle detected");
        }

        depEntry.groupIndex = depGroupIndex;
      }

      buildGroups(depEntry, groups);
    }
  }

  function link(name) {
    var startEntry = defined[name];

    startEntry.groupIndex = 0;

    var groups = [];

    buildGroups(startEntry, groups);

    var curGroupDeclarative = !!startEntry.declarative == groups.length % 2;
    for (var i = groups.length - 1; i >= 0; i--) {
      var group = groups[i];
      for (var j = 0; j < group.length; j++) {
        var entry = group[j];

        // link each group
        if (curGroupDeclarative)
          linkDeclarativeModule(entry);
        else
          linkDynamicModule(entry);
      }
      curGroupDeclarative = !curGroupDeclarative; 
    }
  }

  // module binding records
  var moduleRecords = {};
  function getOrCreateModuleRecord(name) {
    return moduleRecords[name] || (moduleRecords[name] = {
      name: name,
      dependencies: [],
      exports: {}, // start from an empty module and extend
      importers: []
    })
  }

  function linkDeclarativeModule(entry) {
    // only link if already not already started linking (stops at circular)
    if (entry.module)
      return;

    var module = entry.module = getOrCreateModuleRecord(entry.name);
    var exports = entry.module.exports;

    var declaration = entry.declare.call(global, function(name, value) {
      module.locked = true;

      if (typeof name == 'object') {
        for (var p in name)
          exports[p] = name[p];
      }
      else {
        exports[name] = value;
      }

      for (var i = 0, l = module.importers.length; i < l; i++) {
        var importerModule = module.importers[i];
        if (!importerModule.locked) {
          for (var j = 0; j < importerModule.dependencies.length; ++j) {
            if (importerModule.dependencies[j] === module) {
              importerModule.setters[j](exports);
            }
          }
        }
      }

      module.locked = false;
      return value;
    }, entry.name);

    module.setters = declaration.setters;
    module.execute = declaration.execute;

    // now link all the module dependencies
    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      var depEntry = defined[depName];
      var depModule = moduleRecords[depName];

      // work out how to set depExports based on scenarios...
      var depExports;

      if (depModule) {
        depExports = depModule.exports;
      }
      else if (depEntry && !depEntry.declarative) {
        depExports = depEntry.esModule;
      }
      // in the module registry
      else if (!depEntry) {
        depExports = load(depName);
      }
      // we have an entry -> link
      else {
        linkDeclarativeModule(depEntry);
        depModule = depEntry.module;
        depExports = depModule.exports;
      }

      // only declarative modules have dynamic bindings
      if (depModule && depModule.importers) {
        depModule.importers.push(module);
        module.dependencies.push(depModule);
      }
      else
        module.dependencies.push(null);

      // run the setter for this dependency
      if (module.setters[i])
        module.setters[i](depExports);
    }
  }

  // An analog to loader.get covering execution of all three layers (real declarative, simulated declarative, simulated dynamic)
  function getModule(name) {
    var exports;
    var entry = defined[name];

    if (!entry) {
      exports = load(name);
      if (!exports)
        throw new Error("Unable to load dependency " + name + ".");
    }

    else {
      if (entry.declarative)
        ensureEvaluated(name, []);

      else if (!entry.evaluated)
        linkDynamicModule(entry);

      exports = entry.module.exports;
    }

    if ((!entry || entry.declarative) && exports && exports.__useDefault)
      return exports['default'];

    return exports;
  }

  function linkDynamicModule(entry) {
    if (entry.module)
      return;

    var exports = {};

    var module = entry.module = { exports: exports, id: entry.name };

    // AMD requires execute the tree first
    if (!entry.executingRequire) {
      for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
        var depName = entry.normalizedDeps[i];
        var depEntry = defined[depName];
        if (depEntry)
          linkDynamicModule(depEntry);
      }
    }

    // now execute
    entry.evaluated = true;
    var output = entry.execute.call(global, function(name) {
      for (var i = 0, l = entry.deps.length; i < l; i++) {
        if (entry.deps[i] != name)
          continue;
        return getModule(entry.normalizedDeps[i]);
      }
      throw new TypeError('Module ' + name + ' not declared as a dependency.');
    }, exports, module);

    if (output)
      module.exports = output;

    // create the esModule object, which allows ES6 named imports of dynamics
    exports = module.exports;
 
    if (exports && exports.__esModule) {
      entry.esModule = exports;
    }
    else {
      entry.esModule = {};
      
      // don't trigger getters/setters in environments that support them
      if ((typeof exports == 'object' || typeof exports == 'function') && exports !== global) {
        if (getOwnPropertyDescriptor) {
          var d;
          for (var p in exports)
            if (d = Object.getOwnPropertyDescriptor(exports, p))
              defineProperty(entry.esModule, p, d);
        }
        else {
          var hasOwnProperty = exports && exports.hasOwnProperty;
          for (var p in exports) {
            if (!hasOwnProperty || exports.hasOwnProperty(p))
              entry.esModule[p] = exports[p];
          }
         }
       }
      entry.esModule['default'] = exports;
      defineProperty(entry.esModule, '__useDefault', {
        value: true
      });
    }
  }

  /*
   * Given a module, and the list of modules for this current branch,
   *  ensure that each of the dependencies of this module is evaluated
   *  (unless one is a circular dependency already in the list of seen
   *  modules, in which case we execute it)
   *
   * Then we evaluate the module itself depth-first left to right 
   * execution to match ES6 modules
   */
  function ensureEvaluated(moduleName, seen) {
    var entry = defined[moduleName];

    // if already seen, that means it's an already-evaluated non circular dependency
    if (!entry || entry.evaluated || !entry.declarative)
      return;

    // this only applies to declarative modules which late-execute

    seen.push(moduleName);

    for (var i = 0, l = entry.normalizedDeps.length; i < l; i++) {
      var depName = entry.normalizedDeps[i];
      if (indexOf.call(seen, depName) == -1) {
        if (!defined[depName])
          load(depName);
        else
          ensureEvaluated(depName, seen);
      }
    }

    if (entry.evaluated)
      return;

    entry.evaluated = true;
    entry.module.execute.call(global);
  }

  // magical execution function
  var modules = {};
  function load(name) {
    if (modules[name])
      return modules[name];

    // node core modules
    if (name.substr(0, 6) == '@node/')
      return require(name.substr(6));

    var entry = defined[name];

    // first we check if this module has already been defined in the registry
    if (!entry)
      throw "Module " + name + " not present.";

    // recursively ensure that the module and all its 
    // dependencies are linked (with dependency group handling)
    link(name);

    // now handle dependency execution in correct order
    ensureEvaluated(name, []);

    // remove from the registry
    defined[name] = undefined;

    // exported modules get __esModule defined for interop
    if (entry.declarative)
      defineProperty(entry.module.exports, '__esModule', { value: true });

    // return the defined module object
    return modules[name] = entry.declarative ? entry.module.exports : entry.esModule;
  };

  return function(mains, depNames, declare) {
    return function(formatDetect) {
      formatDetect(function(deps) {
        var System = {
          _nodeRequire: typeof require != 'undefined' && require.resolve && typeof process != 'undefined' && require,
          register: register,
          registerDynamic: registerDynamic,
          get: load, 
          set: function(name, module) {
            modules[name] = module; 
          },
          newModule: function(module) {
            return module;
          }
        };
        System.set('@empty', {});

        // register external dependencies
        for (var i = 0; i < depNames.length; i++) (function(depName, dep) {
          if (dep && dep.__esModule)
            System.register(depName, [], function(_export) {
              return {
                setters: [],
                execute: function() {
                  for (var p in dep)
                    if (p != '__esModule' && !(typeof p == 'object' && p + '' == 'Module'))
                      _export(p, dep[p]);
                }
              };
            });
          else
            System.registerDynamic(depName, [], false, function() {
              return dep;
            });
        })(depNames[i], arguments[i]);

        // register modules in this bundle
        declare(System);

        // load mains
        var firstLoad = load(mains[0]);
        if (mains.length > 1)
          for (var i = 1; i < mains.length; i++)
            load(mains[i]);

        if (firstLoad.__useDefault)
          return firstLoad['default'];
        else
          return firstLoad;
      });
    };
  };

})(typeof self != 'undefined' ? self : global)
/* (['mainModule'], ['external-dep'], function($__System) {
  System.register(...);
})
(function(factory) {
  if (typeof define && define.amd)
    define(['external-dep'], factory);
  // etc UMD / module pattern
})*/

(["1"], [], function($__System) {

(function(__global) {
  var loader = $__System;
  var indexOf = Array.prototype.indexOf || function(item) {
    for (var i = 0, l = this.length; i < l; i++)
      if (this[i] === item)
        return i;
    return -1;
  }

  var commentRegEx = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg;
  var cjsRequirePre = "(?:^|[^$_a-zA-Z\\xA0-\\uFFFF.])";
  var cjsRequirePost = "\\s*\\(\\s*(\"([^\"]+)\"|'([^']+)')\\s*\\)";
  var fnBracketRegEx = /\(([^\)]*)\)/;
  var wsRegEx = /^\s+|\s+$/g;
  
  var requireRegExs = {};

  function getCJSDeps(source, requireIndex) {

    // remove comments
    source = source.replace(commentRegEx, '');

    // determine the require alias
    var params = source.match(fnBracketRegEx);
    var requireAlias = (params[1].split(',')[requireIndex] || 'require').replace(wsRegEx, '');

    // find or generate the regex for this requireAlias
    var requireRegEx = requireRegExs[requireAlias] || (requireRegExs[requireAlias] = new RegExp(cjsRequirePre + requireAlias + cjsRequirePost, 'g'));

    requireRegEx.lastIndex = 0;

    var deps = [];

    var match;
    while (match = requireRegEx.exec(source))
      deps.push(match[2] || match[3]);

    return deps;
  }

  /*
    AMD-compatible require
    To copy RequireJS, set window.require = window.requirejs = loader.amdRequire
  */
  function require(names, callback, errback, referer) {
    // in amd, first arg can be a config object... we just ignore
    if (typeof names == 'object' && !(names instanceof Array))
      return require.apply(null, Array.prototype.splice.call(arguments, 1, arguments.length - 1));

    // amd require
    if (typeof names == 'string' && typeof callback == 'function')
      names = [names];
    if (names instanceof Array) {
      var dynamicRequires = [];
      for (var i = 0; i < names.length; i++)
        dynamicRequires.push(loader['import'](names[i], referer));
      Promise.all(dynamicRequires).then(function(modules) {
        if (callback)
          callback.apply(null, modules);
      }, errback);
    }

    // commonjs require
    else if (typeof names == 'string') {
      var module = loader.get(names);
      return module.__useDefault ? module['default'] : module;
    }

    else
      throw new TypeError('Invalid require');
  }

  function define(name, deps, factory) {
    if (typeof name != 'string') {
      factory = deps;
      deps = name;
      name = null;
    }
    if (!(deps instanceof Array)) {
      factory = deps;
      deps = ['require', 'exports', 'module'].splice(0, factory.length);
    }

    if (typeof factory != 'function')
      factory = (function(factory) {
        return function() { return factory; }
      })(factory);

    // in IE8, a trailing comma becomes a trailing undefined entry
    if (deps[deps.length - 1] === undefined)
      deps.pop();

    // remove system dependencies
    var requireIndex, exportsIndex, moduleIndex;
    
    if ((requireIndex = indexOf.call(deps, 'require')) != -1) {
      
      deps.splice(requireIndex, 1);

      // only trace cjs requires for non-named
      // named defines assume the trace has already been done
      if (!name)
        deps = deps.concat(getCJSDeps(factory.toString(), requireIndex));
    }

    if ((exportsIndex = indexOf.call(deps, 'exports')) != -1)
      deps.splice(exportsIndex, 1);
    
    if ((moduleIndex = indexOf.call(deps, 'module')) != -1)
      deps.splice(moduleIndex, 1);

    var define = {
      name: name,
      deps: deps,
      execute: function(req, exports, module) {

        var depValues = [];
        for (var i = 0; i < deps.length; i++)
          depValues.push(req(deps[i]));

        module.uri = module.id;

        module.config = function() {};

        // add back in system dependencies
        if (moduleIndex != -1)
          depValues.splice(moduleIndex, 0, module);
        
        if (exportsIndex != -1)
          depValues.splice(exportsIndex, 0, exports);
        
        if (requireIndex != -1) 
          depValues.splice(requireIndex, 0, function(names, callback, errback) {
            if (typeof names == 'string' && typeof callback != 'function')
              return req(names);
            return require.call(loader, names, callback, errback, module.id);
          });

        var output = factory.apply(exportsIndex == -1 ? __global : exports, depValues);

        if (typeof output == 'undefined' && module)
          output = module.exports;

        if (typeof output != 'undefined')
          return output;
      }
    };

    // anonymous define
    if (!name) {
      // already defined anonymously -> throw
      if (lastModule.anonDefine)
        throw new TypeError('Multiple defines for anonymous module');
      lastModule.anonDefine = define;
    }
    // named define
    else {
      // if we don't have any other defines,
      // then let this be an anonymous define
      // this is just to support single modules of the form:
      // define('jquery')
      // still loading anonymously
      // because it is done widely enough to be useful
      if (!lastModule.anonDefine && !lastModule.isBundle) {
        lastModule.anonDefine = define;
      }
      // otherwise its a bundle only
      else {
        // if there is an anonDefine already (we thought it could have had a single named define)
        // then we define it now
        // this is to avoid defining named defines when they are actually anonymous
        if (lastModule.anonDefine && lastModule.anonDefine.name)
          loader.registerDynamic(lastModule.anonDefine.name, lastModule.anonDefine.deps, false, lastModule.anonDefine.execute);

        lastModule.anonDefine = null;
      }

      // note this is now a bundle
      lastModule.isBundle = true;

      // define the module through the register registry
      loader.registerDynamic(name, define.deps, false, define.execute);
    }
  }
  define.amd = {};

  // adds define as a global (potentially just temporarily)
  function createDefine(loader) {
    lastModule.anonDefine = null;
    lastModule.isBundle = false;

    // ensure no NodeJS environment detection
    var oldModule = __global.module;
    var oldExports = __global.exports;
    var oldDefine = __global.define;

    __global.module = undefined;
    __global.exports = undefined;
    __global.define = define;

    return function() {
      __global.define = oldDefine;
      __global.module = oldModule;
      __global.exports = oldExports;
    };
  }

  var lastModule = {
    isBundle: false,
    anonDefine: null
  };

  loader.set('@@amd-helpers', loader.newModule({
    createDefine: createDefine,
    require: require,
    define: define,
    lastModule: lastModule
  }));
  loader.amdDefine = define;
  loader.amdRequire = require;
})(typeof self != 'undefined' ? self : global);

"bundle";
(function() {
var _removeDefine = $__System.get("@@amd-helpers").createDefine();
define("2", [], function() {
  return "<div class=\"sexyCarousel\">\n    <div class=\"sexyCarousel-previous icon-caret-left\" ng-if=\"scVm.showPreviousArrow\" ng-click=\"scVm.previousSlide()\"></div>\n    <div class=\"sexyCarousel-next icon-caret-right\" ng-if=\"scVm.showNextArrow\" ng-click=\"scVm.nextSlide()\"></div>\n    <div class=\"sexyCarousel-content\">\n        <div class=\"sexyCarousel-slides\">\n            <div ng-repeat=\"slide in scVm.slides track by slide.id\" class=\"sexyCarousel-slide {{::scVm.itemClasses}}\" ng-style=\"::{'height': scVm.cardHeight}\"\n            ng-swipe-right=\"scVm.previousSlide()\" ng-swipe-left=\"scVm.nextSlide()\">\n                <div ng-include=\"::scVm.itemTemplate\" onload=\"scVm.onItemTemplateLoad()\"></div>\n            </div>\n        </div>\n    </div>\n    <div class=\"sexyCarousel-navigation\" ng-if=\"scVm.showNavigationDots && scVm.navigationalDots.length > 1\">\n        <span ng-repeat=\"dot in scVm.navigationalDots track by $index\" ng-click=\"::scVm.goToSlide(dot.id)\" ng-class=\"{'active': $index === scVm.carouselIndex}\"></span>\n    </div>\n</div>";
});

_removeDefine();
})();
$__System.register("3", [], function() { return { setters: [], execute: function() {} } });

$__System.register("4", ["2", "3"], function(exports_1, context_1) {
  "use strict";
  var __moduleName = context_1 && context_1.id;
  var sexy_carousel_tpl_html_text_1;
  var carouselItemLoaded,
      numberInvewSlides,
      SexyCarousel,
      SexyCarouselController;
  return {
    setters: [function(sexy_carousel_tpl_html_text_1_1) {
      sexy_carousel_tpl_html_text_1 = sexy_carousel_tpl_html_text_1_1;
    }, function(_1) {}],
    execute: function() {
      carouselItemLoaded = false, numberInvewSlides = 0;
      SexyCarousel = (function() {
        function SexyCarousel() {
          this.template = sexy_carousel_tpl_html_text_1.default;
          this.controllerAs = 'scVm';
          this.bindToController = {
            slides: '=',
            itemTemplate: '@',
            callBackSliding: '=?',
            renderedSlides: '=?',
            itemController: '=?'
          };
          this.controller = SexyCarouselController;
        }
        SexyCarousel.instance = function() {
          return new SexyCarousel();
        };
        return SexyCarousel;
      }());
      exports_1("default", SexyCarousel);
      SexyCarouselController = (function() {
        function SexyCarouselController($rootScope, $scope, $attrs, $element, $timeout) {
          'ngInject';
          var _this = this;
          this.$attrs = $attrs;
          this.$element = $element;
          this.$timeout = $timeout;
          this.navigationalDots = [];
          this.showNextArrow = false;
          this.showPreviousArrow = false;
          this.carouselIndex = 0;
          this.slidesChanged = function() {
            _this.resetCarousel();
          };
          this.browserResize = function() {
            var slideElements = _this.$element[0].getElementsByClassName('sexyCarousel-slide');
            _this.containerWidth = _this.$element[0].offsetWidth;
            _this.slideWidth = slideElements.length > 0 ? slideElements[0].offsetWidth : 1;
            _this.slidesInview = Math.floor(_this.containerWidth / _this.slideWidth);
            if (numberInvewSlides === 0) {
              numberInvewSlides = _this.slidesInview;
            }
            if (_this.slidesInview !== numberInvewSlides) {
              _this.resetCarousel();
            }
            numberInvewSlides = _this.slidesInview;
          };
          this.cardHeight = $attrs.cardHeight || 'auto';
          this.slidesCollectionElement = angular.element(this.$element[0].getElementsByClassName('sexyCarousel-slides')[0]);
          this.numShowOnDesktop = $attrs.numShowOnDesktop || 0;
          this.hideArrowsOverride = !!($attrs.hideArrows);
          this.showNavigationDots = !!($attrs.showNavigationDots);
          this.setItemClass();
          if (carouselItemLoaded) {
            carouselItemLoaded = false;
            $timeout(function() {
              _this.onItemTemplateLoad();
            });
          }
          var $rootListeners = {
            documentBrowserSizeChange: $rootScope.$on('document:browser-size-change', this.browserResize),
            slidesChanged: $scope.$watch(function() {
              return this.slides;
            }, this.slidesChanged())
          };
          for (var unbind in $rootListeners) {
            $scope.$on('$destroy', $rootListeners[unbind]);
          }
        }
        SexyCarouselController.prototype.resetCarousel = function() {
          this.carouselIndex = 0;
          this.slidesCollectionElement.css('left', '0');
          this.shouldArrowsBeShown();
          this.setNavigationDots();
          this.exposeRenderedSlides();
        };
        SexyCarouselController.prototype.shouldArrowsBeShown = function() {
          if (!this.$attrs.hideArrows) {
            this.showPreviousArrow = this.carouselIndex > 0;
            this.showNextArrow = ((this.slidesInview * (this.carouselIndex + 1)) < this.slides.length);
          }
        };
        SexyCarouselController.prototype.setItemClass = function() {
          this.itemClasses = "sexyCarousel-slide-" + this.numShowOnDesktop + "-max";
        };
        SexyCarouselController.prototype.setNavigationDots = function() {
          var navDots = [],
              numDots = Math.ceil(this.slides.length / this.slidesInview);
          for (var i = 0; i < numDots; i++) {
            navDots.push({id: i});
          }
          this.navigationalDots = navDots;
        };
        SexyCarouselController.prototype.carouselSlide = function(direction) {
          if (!this.$attrs.loop) {
            this.exposeRenderedSlides();
            var leftAmount = this.carouselIndex * this.slideWidth * this.slidesInview;
            leftAmount = leftAmount * -1;
            this.slidesCollectionElement.css('left', leftAmount + 'px');
          }
        };
        SexyCarouselController.prototype.executeSlidingCallBack = function() {
          var _this = this;
          this.$timeout(function() {
            if (angular.isFunction(_this.callBackSliding)) {
              _this.callBackSliding();
            }
          });
        };
        SexyCarouselController.prototype.exposeRenderedSlides = function() {
          if (!isNaN(this.slidesInview)) {
            this.renderedSlides = {
              'index': this.carouselIndex,
              'numSlidesInview': this.slidesInview
            };
          }
        };
        SexyCarouselController.prototype.onItemTemplateLoad = function() {
          if (!carouselItemLoaded) {
            carouselItemLoaded = true;
            this.browserResize();
            this.shouldArrowsBeShown();
            this.exposeRenderedSlides();
            this.setNavigationDots();
          }
        };
        SexyCarouselController.prototype.nextSlide = function() {
          if ((this.slidesInview * (this.carouselIndex + 1)) < this.slides.length) {
            this.carouselIndex++;
            this.carouselSlide('next');
            this.shouldArrowsBeShown();
            this.executeSlidingCallBack();
          }
        };
        SexyCarouselController.prototype.previousSlide = function() {
          if (this.carouselIndex > 0) {
            this.carouselIndex--;
            this.carouselSlide('previous');
            this.shouldArrowsBeShown();
            this.executeSlidingCallBack();
          }
        };
        SexyCarouselController.prototype.goToSlide = function(slideToGoTo) {
          if (slideToGoTo === this.carouselIndex) {
            return;
          }
          if (slideToGoTo < this.carouselIndex) {
            this.carouselIndex = slideToGoTo;
            this.carouselSlide('previous');
          } else if (slideToGoTo > this.carouselIndex) {
            this.carouselIndex = slideToGoTo;
            this.carouselSlide('next');
          }
          this.shouldArrowsBeShown();
        };
        return SexyCarouselController;
      }());
      exports_1("SexyCarouselController", SexyCarouselController);
    }
  };
});

$__System.register("1", ["4"], function(exports_1, context_1) {
  "use strict";
  var __moduleName = context_1 && context_1.id;
  var sexy_carousel_1;
  return {
    setters: [function(sexy_carousel_1_1) {
      sexy_carousel_1 = sexy_carousel_1_1;
    }],
    execute: function() {
      (function() {
        angular.module('ghs.ux.sexycarousel', []);
        angular.module('ghs.ux.sexycarousel').directive('ghsSexyCarousel', sexy_carousel_1.default.instance);
      })();
    }
  };
});

$__System.register('src/css/carousel.css!github:systemjs/plugin-css@0.1.20', [], false, function() {});
(function(c){if (typeof document == 'undefined') return; var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})
(".sexyCarousel{position:relative}.sexyCarousel-content{overflow:hidden;margin:0 50px}.sexyCarousel-slides{display:-ms-flex;display:-webkit-box;display:-moz-flex;display:-ms-flexbox;display:-webkit-flex;display:flex;margin:0;padding:0;position:relative;left:0;-webkit-transition:left 350ms ease-in-out;-o-transition:left 350ms ease-in-out;transition:left 350ms ease-in-out}.sexyCarousel-slide{-webkit-flex:1 1;-webkit-box-flex-direction:1 1;-ms-flex:1 1;flex:1 1}.sexyCarousel-slide-four-max{padding:0 15px;-webkit-flex-basis:25%;-moz-flex-basis:25%;-ms-flex-basis:25%;flex-basis:25%;max-width:25%}.sexyCarousel-slide-three-max{padding:0 15px;padding:0 15px;-webkit-flex-basis:33%;-moz-flex-basis:33%;-ms-flex-basis:33%;flex-basis:33%;max-width:33%}.sexyCarousel-slide-two-max{padding:0 15px;-webkit-flex-basis:50%;-moz-flex-basis:50%;-ms-flex-basis:50%;flex-basis:50%;max-width:50%}.sexyCarousel-slide-one-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}.sexyCarousel-next,.sexyCarousel-previous{background-color:#fff;color:#cf0a2c;z-index:2;height:78px;top:50%;position:absolute;margin-top:-39px;font-size:26px}.sexyCarousel-next{right:0}.sexyCarousel-next:before{position:absolute;right:0}.sexyCarousel-previous{left:0}.sexyCarousel-previous:before{position:absolute;left:4px}.sexyCarousel-navigation{text-align:center;margin-top:15px}.sexyCarousel-navigation>span{-webkit-transition:color .5s;-o-transition:color .5s;transition:color .5s;display:inline-block;height:10px;width:10px;background:#cacaca;border-radius:50%;border:1px solid #cacaca;margin-right:10px}.sexyCarousel-navigation>span:last-child{margin-right:0}.sexyCarousel-navigation>.active{background:#009ade;border-color:#009ade}@media (max-width:767px){.sexyCarousel-content{margin:0 15px}.sexyCarousel-slide-four-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}.sexyCarousel-slide-three-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}.sexyCarousel-slide-two-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}}@media (min-width:768px) and (max-width:991px){.sexyCarousel-slide-four-max{-webkit-flex-basis:50%;-moz-flex-basis:50%;-ms-flex-basis:50%;flex-basis:50%;max-width:50%}.sexyCarousel-slide-three-max{-webkit-flex-basis:50%;-moz-flex-basis:50%;-ms-flex-basis:50%;flex-basis:50%;max-width:50%}}@media (min-width:992px) and (max-width:1199px){.sexyCarousel-slide-four-max{-webkit-flex-basis:33%;-moz-flex-basis:33%;-ms-flex-basis:33%;flex-basis:33%;max-width:33%}}");
})
(function(factory) {
  factory();
});