///<reference path="../../typings/tsd.d.ts"/>

import template from '../html/sexy-carousel.tpl.html!text';
import '../css/carousel.css!';


// Required attributes are the following
// slides = the array that contains all the slides
// item-template = the template to be used by items
/* num-show-on-desktop = number of cards to be shown on the desktop - 
    current classes covered are 1-4 need to add more if you want to have more than that */
// card-height = the card height - defaults to auto - can pass in auto, % or px as string
// show-navigation-dots = defaults to false, if true, the nav dots will be shown below the carousel
// hide-arrows = defaults to false, if true, navigation arrows won't be shown
// rendered-slides = exposes what index the carousel is currently at, and how many slides are in view
// item-controller = a reference to the controller object that is bound for use with the individual item template
// autoSlideTimeMs = set the amount of time wanted for the carousel to auto rotate through its slides collection
// optVisual = Optional set of visual attributes - encompasses all optional VISUAL scope bindings

// In the future feature
// loop = defaults to false, if true, the carousel won't have a start or end point and will continuously loop

export default class SexyCarousel implements ng.IDirective {
    public template: string = template;
    public controllerAs: string = 'scVm';
    public bindToController: any = {
        callBackSliding: '=?',
        itemController: '=?',
        itemTemplate: '@',
        optVisual: '=?',
        renderedSlides: '=?',
        slides: '='
    };
    public controller = SexyCarouselController;
    public static instance(): ng.IDirective {
        return new SexyCarousel();
    }
}

export class SexyCarouselController {
    public static $inject = [
        '$rootScope',
        '$scope',
        '$element',
        '$timeout',
        '$interval'
    ];

    public slides: any;
    public navigationalDots: any = [];
    public showNavigationDots: boolean; // This is a attribute property to disable the navigation dots
    public showNextArrow: boolean = false;
    public showPreviousArrow: boolean = false;
    public itemClasses: string;
    public carouselIndex: number = 0;
    public cardHeight: string; // Attribute property - sets to auto if not passed in
    public numberInvewSlides: number = 0; // number of slides in view - if this and this.slidesInview don't match, reset the carousel.
    public callBackSliding: any;
    public renderedSlides: any;

    private optVisual: any;
    private containerWidth: number;
    private hideArrows: boolean;
    private carouselItemLoaded: boolean = false; // Variable to denote that the item ng-include has completed
    private slidesInview: number;
    private slideWidth: number;
    private slidesCollectionElement: any;
    private autoSliderTimerObject: any;
    private autoSliderTimerPaused: boolean = false; // If the auto slider is currently paused

    constructor(public $rootScope,
        public $scope,
        private $element,
        private $timeout,
        private $interval) {

        this.cardHeight = this.optVisual.cardHeight || 'auto';
        this.slidesCollectionElement = angular.element(this.$element[0].getElementsByClassName('sexyCarousel-slides')[0]);
        this.showNavigationDots = !!(this.optVisual.showNavigationDots) || !!(this.optVisual.showNavDotsOnDesktop) || !!(this.optVisual.showNavDotsOnTablet) || !!(this.optVisual.showNavDotsOnMobile);
        this.hideArrows = !!(this.optVisual.hideArrows);

        this.setItemClass(); // Set the classes that will be applied to the item level parent.

        // Do a check if the carouselItemLoaded variable is true - this means the carousel has been loaded once before
        // If it's been loaded in the past, will have to rerun the ontemplateload function to handle proper set up of arrows and nav dots
        if (this.carouselItemLoaded) {
            this.carouselItemLoaded = false;
            // Force a digest cycle - Needed because I need the template to be loaded first to check for slide widths
            this.$timeout(() => {
                // The onItemTemplateLoad method handles the rest of the initialization
                // of the carousel since much of the functionality exists upon the card being loaded
                this.onItemTemplateLoad();
            });
        }

        let $rootListeners = {
            documentBrowserSizeChange: $rootScope.$on('document:browser-size-change', this.browserResize),
            slidesChanged: $scope.$watch(() => {
                return this.slides;
            }, this.slidesChanged())
        };

        for (let unbind in $rootListeners) {
            $scope.$on('$destroy', $rootListeners[unbind]);
        }
    }

    // Method that fires on load of the actual templates - will handle setting up the rest of the carousel
    public onItemTemplateLoad(): void {
        if (!this.carouselItemLoaded) {
            this.carouselItemLoaded = true;
            this.browserResize(); // This will handle setting up the widths and the navigational dots
            this.shouldArrowsBeShown(); // Set arrows visibility
            this.exposeRenderedSlides();
            this.setNavigationDots();
            this.setNavigationDotsClass();

            if (this.optVisual.autoSlideTimeMs) {
                this.autoSlideTimerStart();

                this.slidesCollectionElement.on('mouseenter', () => {
                    this.autoSlideTimerPause();
                });

                this.slidesCollectionElement.on('mouseleave', () => {
                    this.autoSlideTimerStart();
                });
            }
        }
    }

    // Event handler for moving to the next slide
    public nextSlide(): void {
        if ((this.slidesInview * (this.carouselIndex + 1)) < this.slides.length) {
            this.carouselIndex++;
            this.carouselSlide('next');
            this.shouldArrowsBeShown();

            // Execute call back
            this.executeSlidingCallBack();
        }
    }

    // Event handler for moving to the previous slide
    public previousSlide(): void {
        if (this.carouselIndex > 0) {
            this.carouselIndex--;
            this.carouselSlide('previous');
            this.shouldArrowsBeShown();

            // Execute call back
            this.executeSlidingCallBack();
        }
    }

    // Direct jump to slide - for the slide indicator dots
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

    private resetCarousel(): void {
        let slideTransitionTime = this.optVisual.slideTransitionAnimationMs ? `${this.optVisual.slideTransitionAnimationMs}ms` : '350ms';
        this.carouselIndex = 0;
        this.slidesCollectionElement.css('left', '0');
        this.slidesCollectionElement.css('transition-duration', slideTransitionTime);

        this.shouldArrowsBeShown(); // Set arrows visibility

        this.setNavigationDots();

        this.exposeRenderedSlides();

        this.executeSlidingCallBack();
    }

    private slidesChanged = (): void => {
        this.resetCarousel();
    }

    // Calculates slide width, slides in view and contanier width.
    private browserResize = (): void => {
        let slideElements = this.$element[0].getElementsByClassName('sexyCarousel-slide');

        this.containerWidth = this.$element[0].offsetWidth;
        this.slideWidth = slideElements.length > 0 ? slideElements[0].offsetWidth : 1;

        this.slidesInview = Math.floor(this.containerWidth / this.slideWidth);

        if (this.numberInvewSlides === 0) {
            this.numberInvewSlides = this.slidesInview;
        }

        if (this.slidesInview !== this.numberInvewSlides) {
            this.resetCarousel();
        }

        this.numberInvewSlides = this.slidesInview;
    }

    private shouldArrowsBeShown(): void {
        if (!this.hideArrows) {
            this.showPreviousArrow = this.carouselIndex > 0;
            this.showNextArrow = ((this.slidesInview * (this.carouselIndex + 1)) < this.slides.length);
        }
    }

    // Sets the css class for each item to handle proper width resizing of slides
    private setItemClass(): void {
        let numOfSlidesOnDesktop;

        switch (this.optVisual.numShowOnDesktop) {
            case 1:
                numOfSlidesOnDesktop = 'one';
                break;
            case 2:
                numOfSlidesOnDesktop = 'two';
                break;
            case 3:
                numOfSlidesOnDesktop = 'three';
                break;
            case 4: // Keeping this here - in case our default ever changes. 
                numOfSlidesOnDesktop = 'four';
                break;
            default:
                numOfSlidesOnDesktop = 'four';
                break;
        }
        this.itemClasses = `sexyCarousel-slide-${numOfSlidesOnDesktop}-max`;
    }

    // Sets classes to show nav dots or only hide the navigation dots on certain viewports
    private setNavigationDotsClass(): void {
        // Force a digest cycle - This is to make sure the dots are actually rendered on the template.
        this.$timeout(() => {
            let navClassesToApply = [];

            if (!!this.optVisual.showNavigationDots) {
                navClassesToApply.push('sexyCarousel-navigation-showAll');
            } else {
                if (this.optVisual.showNavDotsOnDesktop) {
                    navClassesToApply.push('sexyCarousel-navigation-showDesktop');
                }

                if (this.optVisual.showNavDotsOnTablet) {
                    navClassesToApply.push('sexyCarousel-navigation-showTablet');
                }

                if (this.optVisual.showNavDotsOnMobile) {
                    navClassesToApply.push('sexyCarousel-navigation-showMobile');
                }
            }

            if (navClassesToApply.length > 0) {
                let navDots = angular.element(this.$element[0].getElementsByClassName('sexyCarousel-navigation')[0]);
                navDots.addClass(navClassesToApply.join(' '));
            }
        });
    }

    // Sets the number of navigation dots that are available
    private setNavigationDots(): void {
        let navDots = [],
            numDots = Math.ceil(this.slides.length / this.slidesInview);

        for (let i = 0; i < numDots; i++) {
            navDots.push({
                id: i
            });
        }

        this.navigationalDots = navDots;
    }

    // Executes the carousel slide "sliding" - does not access carouselIndex directly as
    private carouselSlide(direction: string): void {
        this.exposeRenderedSlides();

        let leftAmount: number = this.carouselIndex * this.slideWidth * this.slidesInview;
        leftAmount = leftAmount * -1;

        // Set the left on the slide container to "paginate" the carousel
        this.slidesCollectionElement.css('left', leftAmount + 'px');
    }

    // Executes call back function on slide next/previous
    private executeSlidingCallBack(): void {
        // Force a digest cycle - This is to make sure the renderedSlides object is updated properly on whatever directive is listening
        this.$timeout(() => {
            if (angular.isFunction(this.callBackSliding)) {
                this.callBackSliding();
            }
        });
    }

    private exposeRenderedSlides(): void {
        if (!isNaN(this.slidesInview)) {
            this.renderedSlides = {
                'index': this.carouselIndex,
                'numSlidesInview': this.slidesInview
            };
        }
    }

    private autoSlideTimerStart(): void {
        if (this.autoSliderTimerPaused) {
            this.$interval.cancel(this.autoSliderTimerObject);
            this.autoSliderTimerObject = null;
        }

        this.autoSliderTimerPaused = false;

        if (!this.autoSliderTimerObject) {
            this.autoSliderTimerObject = this.$interval(() => {
                this.nextSlide();
            }, this.optVisual.autoSlideTimeMs);
        }
    }

    private autoSlideTimerPause() {
        if (this.autoSliderTimerObject && !this.autoSliderTimerPaused) {
            this.$interval.cancel(this.autoSliderTimerObject);
            this.autoSliderTimerObject = null;
            this.autoSliderTimerPaused = true;
        }
    }
}
