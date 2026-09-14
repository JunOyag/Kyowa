module.exports = {
    // autres configurations
    resolve: {
      fallback: {
        "crypto": require.resolve("crypto-browserify")
      }
    }
  };