const { join } = require("path")

/**
 * On Render, keep the downloaded Chrome inside the project so it is still there
 * at runtime (the default home cache is not kept after the build).
 * Render sets RENDER=true during both build and runtime; locally the default cache is used.
 */
module.exports = process.env.RENDER
    ? { cacheDirectory: join(__dirname, ".cache", "puppeteer") }
    : {}
