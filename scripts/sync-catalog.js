const { runSync } = require("../lib/sync");

runSync()
  .then((result) => {
    if (!result.catalog) {
      console.error("[printify] Sync finished without a catalog.");
      process.exitCode = 1;
    }
  })
  .catch((err) => {
    console.error(`[printify] Sync crashed: ${err.message}`);
    process.exitCode = 1;
  });
