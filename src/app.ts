///<reference path="../typings/tsd.d.ts"/>
import SexyCarousel from './ts/sexy-carousel';


(function () {
    angular.module('ghs.ux.sexycarousel', []);
    angular.module('ghs.ux.sexycarousel').directive(SexyCarousel.instance);
})();
