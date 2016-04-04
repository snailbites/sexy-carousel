
module.exports = {
    options: {
        sfx: true,
        minify: true,
        mangle: false,
        sourceMaps: false
    },

    // Should be triggered if a model or service has changed
    coreBundle: {
        files: {
            'dist/sexy-carousel.js': 'src/app.ts' // Core Library
        }
    }
};