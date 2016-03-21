"bundle";
(function() {
var _removeDefine = System.get("@@amd-helpers").createDefine();
define("src/html/sexy-carousel.tpl.html!github:systemjs/plugin-text@0.0.7", [], function() {
  return "<div class=\"sexyCarousel\">\n    <div class=\"sexyCarousel-previous icon-caret-left\" ng-if=\"scVm.showPreviousArrow\" ng-click=\"scVm.previousSlide()\"></div>\n    <div class=\"sexyCarousel-next icon-caret-right\" ng-if=\"scVm.showNextArrow\" ng-click=\"scVm.nextSlide()\"></div>\n    <div class=\"sexyCarousel-content\">\n        <div class=\"sexyCarousel-slides\">\n            <div ng-repeat=\"slide in scVm.slides track by slide.id\" class=\"sexyCarousel-slide {{::scVm.itemClasses}}\" ng-style=\"::{'height': scVm.cardHeight}\"\n            ng-swipe-right=\"scVm.previousSlide()\" ng-swipe-left=\"scVm.nextSlide()\">\n                <div ng-include=\"::scVm.itemTemplate\" onload=\"scVm.onItemTemplateLoad()\"></div>\n            </div>\n        </div>\n    </div>\n    <div class=\"sexyCarousel-navigation\" ng-if=\"scVm.showNavigationDots && scVm.navigationalDots.length > 1\">\n        <span ng-repeat=\"dot in scVm.navigationalDots track by $index\" ng-click=\"::scVm.goToSlide(dot.id)\" ng-class=\"{'active': $index === scVm.carouselIndex}\"></span>\n    </div>\n</div>";
});

_removeDefine();
})();
System.register("src/css/carousel.css!github:systemjs/plugin-css@0.1.20", [], function() { return { setters: [], execute: function() {} } });

System.register("src/ts/sexy-carousel.ts", ["src/html/sexy-carousel.tpl.html!github:systemjs/plugin-text@0.0.7", "src/css/carousel.css!github:systemjs/plugin-css@0.1.20"], function(exports_1, context_1) {
  "use strict";
  var __moduleName = context_1 && context_1.id;
  var sexy_carousel_tpl_html_text_1;
  var ghs;
  return {
    setters: [function(sexy_carousel_tpl_html_text_1_1) {
      sexy_carousel_tpl_html_text_1 = sexy_carousel_tpl_html_text_1_1;
    }, function(_1) {}],
    execute: function() {
      (function(ghs) {
        var ux;
        (function(ux) {
          var sexycarousel;
          (function(sexycarousel) {
            var carouselItemLoaded = false,
                numberInvewSlides = 0;
            var SexyCarousel = (function() {
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
            sexycarousel.SexyCarousel = SexyCarousel;
            var SexyCarouselController = (function() {
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
            sexycarousel.SexyCarouselController = SexyCarouselController;
          })(sexycarousel = ux.sexycarousel || (ux.sexycarousel = {}));
        })(ux = ghs.ux || (ghs.ux = {}));
      })(ghs || (ghs = {}));
    }
  };
});

System.register('src/css/carousel.css!github:systemjs/plugin-css@0.1.20', [], false, function() {});
(function(c){if (typeof document == 'undefined') return; var d=document,a='appendChild',i='styleSheet',s=d.createElement('style');s.type='text/css';d.getElementsByTagName('head')[0][a](s);s[i]?s[i].cssText=c:s[a](d.createTextNode(c));})
(".sexyCarousel{position:relative}.sexyCarousel-content{overflow:hidden;margin:0 50px}.sexyCarousel-slides{display:-ms-flex;display:-webkit-box;display:-moz-flex;display:-ms-flexbox;display:-webkit-flex;display:flex;margin:0;padding:0;position:relative;left:0;-webkit-transition:left 350ms ease-in-out;-o-transition:left 350ms ease-in-out;transition:left 350ms ease-in-out}.sexyCarousel-slide{-webkit-flex:1 1;-webkit-box-flex-direction:1 1;-ms-flex:1 1;flex:1 1}.sexyCarousel-slide-four-max{padding:0 15px;-webkit-flex-basis:25%;-moz-flex-basis:25%;-ms-flex-basis:25%;flex-basis:25%;max-width:25%}.sexyCarousel-slide-three-max{padding:0 15px;padding:0 15px;-webkit-flex-basis:33%;-moz-flex-basis:33%;-ms-flex-basis:33%;flex-basis:33%;max-width:33%}.sexyCarousel-slide-two-max{padding:0 15px;-webkit-flex-basis:50%;-moz-flex-basis:50%;-ms-flex-basis:50%;flex-basis:50%;max-width:50%}.sexyCarousel-slide-one-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}.sexyCarousel-next,.sexyCarousel-previous{background-color:#fff;color:#cf0a2c;z-index:2;height:78px;top:50%;position:absolute;margin-top:-39px;font-size:26px}.sexyCarousel-next{right:0}.sexyCarousel-next:before{position:absolute;right:0}.sexyCarousel-previous{left:0}.sexyCarousel-previous:before{position:absolute;left:4px}.sexyCarousel-navigation{text-align:center;margin-top:15px}.sexyCarousel-navigation>span{-webkit-transition:color .5s;-o-transition:color .5s;transition:color .5s;display:inline-block;height:10px;width:10px;background:#cacaca;border-radius:50%;border:1px solid #cacaca;margin-right:10px}.sexyCarousel-navigation>span:last-child{margin-right:0}.sexyCarousel-navigation>.active{background:#009ade;border-color:#009ade}@media (max-width:767px){.sexyCarousel-content{margin:0 15px}.sexyCarousel-slide-four-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}.sexyCarousel-slide-three-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}.sexyCarousel-slide-two-max{-webkit-flex-basis:100%;-moz-flex-basis:100%;-ms-flex-basis:100%;flex-basis:100%;max-width:100%}}@media (min-width:768px) and (max-width:991px){.sexyCarousel-slide-four-max{-webkit-flex-basis:50%;-moz-flex-basis:50%;-ms-flex-basis:50%;flex-basis:50%;max-width:50%}.sexyCarousel-slide-three-max{-webkit-flex-basis:50%;-moz-flex-basis:50%;-ms-flex-basis:50%;flex-basis:50%;max-width:50%}}@media (min-width:992px) and (max-width:1199px){.sexyCarousel-slide-four-max{-webkit-flex-basis:33%;-moz-flex-basis:33%;-ms-flex-basis:33%;flex-basis:33%;max-width:33%}}");