///<reference path="../../typings/tsd.d.ts"/>

import template from '../html/sexy-carousel.tpl.html!text';
import '../css/carousel.css!';

namespace ghs.ux.sexycarousel {
    //Required attributes are the following
    // slides = the array that contains all the slides
    // item-template = the template to be used by items
    // num-show-on-desktop = number of cards to be shown on the desktop - current classes covered are 1-4 need to add more if you want to have more than that
    // card-height = the card height - defaults to auto - can pass in auto, % or px as string 
    // show-navigation-dots = defaults to false, if true, the nav dots will be shown below the carousel
    // hide-arrows = defaults to false, if true, navigation arrows won't be shown
    // rendered-slides = exposes what index the carousel is currently at, and how many slides are in view 
    
    // In the future feature
    // loop = defaults to false, if true, the carousel won't have a start or end point and will continuously loop
    
    //Local vars
    let carouselItemLoaded: boolean = false, //Variable to denote that the item ng-include has completed
        numberInvewSlides: number = 0; //number of slides in view - if this and this.slidesInview don't match, reset the carousel.

    export class SexyCarousel implements ng.IDirective {
        
        static instance(): ng.IDirective {
            return new SexyCarousel();
        }

        template: string = template;
        controllerAs: string = 'scVm';
        bindToController: any = {
            slides: '=',
            itemTemplate: '@',
            callBackSliding: '=?',
            renderedSlides: '=?',
            itemController: '=?'
        };
        controller = SexyCarouselController;
    }

    export class SexyCarouselController {
        public slides: any;
        public containerWidth: number;
        public navigationalDots: any = [];
        public callBackSliding: any;
        public showNavigationDots: boolean; //This is a attribute property to disable the navigation dots
        public showNextArrow: boolean = false;
        public showPreviousArrow: boolean = false;
        public hideArrowsOverride: boolean;
        public itemClasses: string;
        public carouselIndex: number = 0;
        public cardHeight: string; //Attribute property - sets to auto if not passed in

        private slidesInview: number;
        private slideWidth: number;
        private numShowOnDesktop: number;
        private slidesCollectionElement: any;
        private renderedSlides: any;

        constructor($rootScope, $scope, private $attrs, private $element, private $timeout) {
            'ngInject';
            this.cardHeight = $attrs.cardHeight || 'auto';
            this.slidesCollectionElement = angular.element(this.$element[0].getElementsByClassName('sexyCarousel-slides')[0]);
            this.numShowOnDesktop = $attrs.numShowOnDesktop || 0;
            this.hideArrowsOverride = !!($attrs.hideArrows);
            this.showNavigationDots = !!($attrs.showNavigationDots);

            this.setItemClass(); //Set the classes that will be applied to the item level parent.
            
            //The onItemTemplateLoad method handles the rest of the initialization of the carousel since much of the functionality exists upon the card being loaded
            
            //Do a check if the carouselItemLoaded variable is true - this means the carousel has been loaded once before
            //If it's been loaded in the past, will have to rerun the ontemplateload function to handle proper set up of arrows and nav dots
            if(carouselItemLoaded) {
                carouselItemLoaded = false;
                //Force a digest cycle - Needed because I need the template to be loaded first to check for slide widths
                $timeout(() => {
                    this.onItemTemplateLoad();
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

        private resetCarousel(): void {
            this.carouselIndex = 0;
            this.slidesCollectionElement.css('left', '0');

            this.shouldArrowsBeShown(); //Set arrows visibility
            
            this.setNavigationDots();

            this.exposeRenderedSlides();
        }

        private slidesChanged = () => {
            this.resetCarousel();
        }
        
        //Calculates slide width, slides in view and contanier width.
        private browserResize = () => {
            let slideElements = this.$element[0].getElementsByClassName('sexyCarousel-slide');

            this.containerWidth = this.$element[0].offsetWidth;
            this.slideWidth = slideElements.length > 0 ? slideElements[0].offsetWidth : 1;

            this.slidesInview = Math.floor(this.containerWidth / this.slideWidth);

            if (numberInvewSlides === 0) {
                numberInvewSlides = this.slidesInview;
            }

            if (this.slidesInview !== numberInvewSlides) {
                this.resetCarousel();
            }

            numberInvewSlides = this.slidesInview;
        }

        private shouldArrowsBeShown(): void {
            if (!this.$attrs.hideArrows) {
                this.showPreviousArrow = this.carouselIndex > 0;
                this.showNextArrow = ((this.slidesInview * (this.carouselIndex + 1)) < this.slides.length);
            }
        }

        //Sets the css class for each item to handle proper width resizing of slides
        private setItemClass() {
            this.itemClasses = `sexyCarousel-slide-${this.numShowOnDesktop}-max`;
        }

        //Sets the number of navigation dots that are available
        private setNavigationDots(): void {
            let navDots = [],
                numDots = Math.ceil(this.slides.length / this.slidesInview);

            for (var i = 0; i < numDots; i++) {
                navDots.push({
                    id: i
                });
            }

            this.navigationalDots = navDots;
        }
        
        //Executes the carousel slide "sliding" - does not access carouselIndex directly as 
        private carouselSlide(direction: string): void {
            if (!this.$attrs.loop) { //Non looping - aka don't use order
                this.exposeRenderedSlides();

                let leftAmount: number = this.carouselIndex * this.slideWidth * this.slidesInview;
                leftAmount = leftAmount * -1;
                
                //Set the left on the slide container to "paginate" the carousel
                this.slidesCollectionElement.css('left', leftAmount + 'px');
            }
        }
        
        //Executes call back function on slide next/previous
        private executeSlidingCallBack() {
            //Force a digest cycle - This is to make sure the renderedSlides object is updated properly on whatever directive is listening
            this.$timeout(()=> {
                if (angular.isFunction(this.callBackSliding)) {
                    this.callBackSliding();
                }
            });
        }

        private exposeRenderedSlides() {
            if (!isNaN(this.slidesInview)) {
                this.renderedSlides = {
                    'index': this.carouselIndex,
                    'numSlidesInview': this.slidesInview
                };
            }
        }

        //Method that fires on load of the actual templates - will handle setting up the rest of the carousel
        public onItemTemplateLoad() {
            if (!carouselItemLoaded) {
                carouselItemLoaded = true;
                this.browserResize(); //This will handle setting up the widths and the navigational dots
                this.shouldArrowsBeShown(); //Set arrows visibility
                this.exposeRenderedSlides();
                this.setNavigationDots();
            }
        }

        //Event handler for moving to the next slide
        public nextSlide(): void {
            if ((this.slidesInview * (this.carouselIndex + 1)) < this.slides.length) {
                this.carouselIndex++;
                this.carouselSlide('next');
                this.shouldArrowsBeShown();
                
                //Execute call back 
                this.executeSlidingCallBack();
            }
        }

        //Event handler for moving to the previous slide
        public previousSlide(): void {
            if (this.carouselIndex > 0) {
                this.carouselIndex--;
                this.carouselSlide('previous');
                this.shouldArrowsBeShown();

                //Execute call back 
                this.executeSlidingCallBack();
            }
        }

        //Direct jump to slide - for the slide indicator dots
        public goToSlide(slideToGoTo: number): void {
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
        }
    }
} 