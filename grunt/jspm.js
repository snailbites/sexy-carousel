
module.exports = {
    options: {
        sfx: true,
        minify: false,
        mangle: false,
        sourceMaps: false
    },

    // Should be triggered if a model or service has changed
    coreBundle: {
        files: {
            'dist/sexy-carousel.js': 'src/ts/sexy-carousel.ts' // Core Library
        }
    }
};