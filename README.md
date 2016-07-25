# sexy-carousel
Pure angular/flexbox based carousel - no dependency on anything except angular and angular-touch

# Usage

<h4>Required attributes</h4>

<ol>
    <li>slides - the array that actually contains the content you want carouseled</li>
    <li>item-template - the path for the individual slide template</li>
<ol>

<h4>Optional attributes</h4>

<ol>
    <li>call-back-sliding - expects a function - this is executed when the visible slides shown to the user change (paginating, or when the browser width changes causing the num of slides to change.</li>
    <li>item-controller - the controller object that you want tied with the item template. Use this to expose controller level logic you want applied per item. Can access using scVm.itemController</li>
    <li>optVisual - this is a object that contains all the optional visual changes that can be made to the carousel.
        <ol>
            <li>numShowOnDesktop - How many slides should be down within a desktop viewport. Expects a numberic number 1 through 4, defaults to 4</li>
            <li>cardHeight - Force individual slides to be a certain fixed height. Expects a string - can use px or % or em. Defaults to auto</li>
            <li>showNavigationDots - Show the navigation dots across all view ports if there should be any. Defaults to false.</li>
            <li>showNavDotsOnDesktop - Show the navigation dots on the desktop view port - can be combined w showNavDotsOnTablet & showNavDotsOnMobile. Defaults to false</li>
            <li>showNavDotsOnTablet - Show the navigation dots on the tablet view port - can be combined w showNavDotsOnDesktop & showNavDotsOnMobile. Defaults to false</li>
            <li>showNavDotsOnMobile - Show the navigation dots on the mobile view port - can be combined w showNavDotsOnTablet & showNavDotsOnDesktop. Defaults to false</li>
            <li>hideArrows - Show the navigation arrows. Defaults to false.</li>
            <li>renderedSlides - Expect an object - Exposes the current slides in the viewport.</li>
            <li>autoSlideTimeMs - Customize the amount of time used by the css transition when paginating through the carousel. Time is in Milliseconds</li>
            <li>hideArrowsOnDesktop - Hide the arrows on the desktop view port - can be combined w hideArrowsOnTablet & hideArrowsOnMobile. Defaults to false</li>
            <li>hideArrowsOnTablet - Hide the arrows on the tablet view port - can be combined w hideArrowsOnDesktop & hideArrowsOnMobile. Defaults to false</li>
            <li>hideArrowsOnMobile - Hide the arrows on the mobile view port - can be combined w hideArrowsOnTablet & hideArrowsOnDesktop. Defaults to false</li>
	        <li>fallBackIsVisible - Option to show a static fallback card for promotional content</li>
            <li>fallBackCopy - Optional copy to show inside static fallback card. Link tag will be an h3</li>
	        <li>fallBackLink - Optional link inside fallback card to take users to more results. Pass in the URL only, no HTML</li>

        </ol>
    </li>
</ol>

#Future features

<ol>
    <li>Looping</li>
</ol>

