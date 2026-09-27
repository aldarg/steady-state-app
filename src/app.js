// Start-up (decision 12). index.html calls start({ window, document }); nothing
// runs at import, so the module loads in Node. This is the only module that
// reads the clock, and with src/device.js the only one that touches the device.
// Chart.js is the global its classic script in index.html defines (v1-05
// decision 10), and Hammer the one hammer.min.js defines (v1-06 decision 1).
// v1-10 decisions 5 and 6: once the page is drawn, the service worker is
// registered, and the browser is asked to keep the storage once it holds a
// saved intake. v1-11 decision 6: the controller is told whether the page
// may suggest Add to Home Screen. v1-12 decision 4: and is offered the intro,
// which it opens on an empty log.

import { createController } from "./controller.js";
import { installable, openDeviceStore, persistOnceSaved } from "./device.js";
import { newDoseId } from "./store.js";
import { mountUi } from "./ui.js";

// The app works the same without a worker, so a registration that throws
// or rejects is ignored, and the console stays empty (B5). Reading
// navigator.serviceWorker can itself throw where site data is blocked, so it
// is read inside try too.
const registerWorker = (navigator) => {
  try {
    navigator.serviceWorker
      ?.register("./sw.js", { scope: "./" })
      .catch(() => undefined);
  } catch {
    // As above: no worker, and the page as it is.
  }
};

export const start = ({ window, document }) => {
  const store = openDeviceStore(() => window.localStorage);
  const now = () => Date.now();
  const controller = createController({
    store,
    now,
    timeZone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
    newId: newDoseId,
    installable: installable(window.navigator),
    offerIntro: true,
  });
  mountUi({
    controller,
    document,
    window,
    now,
    Chart: window.Chart,
    Hammer: window.Hammer,
  });
  registerWorker(window.navigator);
  persistOnceSaved({ store, controller, storage: window.navigator.storage });
};
