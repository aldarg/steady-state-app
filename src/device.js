// Opening the device's storage (decision 12). Reading window.localStorage can
// itself throw — Safari's private mode, site data blocked — so the getter is
// called inside try; a storage that cannot even be reached is handed to the
// store as one whose read throws, and the store settles in memory, where it
// never writes. v1-10 decision 6: and asking the browser to keep that
// storage, once it holds something to protect. v1-11 decision 1: and whether
// the page may suggest Add to Home Screen.

import { openStore } from "./store.js";

const UNREACHABLE = Object.freeze({
  getItem: () => {
    throw new Error("the device's storage could not be reached");
  },
});

const reach = (getStorage) => {
  try {
    return getStorage();
  } catch {
    return UNREACHABLE;
  }
};

export const openDeviceStore = (getStorage) => openStore(reach(getStorage));

// `storage` is navigator.storage, or undefined where there is none. The
// browser decides, and the app shows no answer of its own: a rejection is
// swallowed, and where the API is missing, nothing happens.
export const askToPersist = async (storage) => {
  if (
    typeof storage?.persisted !== "function" ||
    typeof storage.persist !== "function"
  ) {
    return;
  }
  try {
    if ((await storage.persisted()) === false) {
      await storage.persist();
    }
  } catch {
    // Chrome and Safari decide silently; nothing here depends on the answer.
  }
};

// A saved intake: in memory mode, where a write has failed, nothing is.
const holdsSavedIntake = (store) =>
  store.mode === "saved" && store.doc.doses.length > 0;

// Asks once per page load, the first time the store holds a saved intake: at
// once for a log opened with intakes, or on the first controller
// notification after which it holds, such as the first intake saved by the
// form, an import or a restore.
export const persistOnceSaved = ({ store, controller, storage }) => {
  if (holdsSavedIntake(store)) {
    askToPersist(storage);
    return;
  }
  const unsubscribe = controller.subscribe(() => {
    if (holdsSavedIntake(store)) {
      unsubscribe();
      askToPersist(storage);
    }
  });
};

// v1-11 decision 1: iOS or iPadOS, from the user agent: iPhone, iPod or iPad
// as a word, or Macintosh with more than one touch point, since iPadOS's
// desktop-class Safari reports a Mac and Macs report none.
const IOS_DEVICE = /\b(?:iPhone|iPod|iPad)\b/u;
const MAC = /\bMacintosh\b/u;

const onIos = ({ userAgent, maxTouchPoints }) =>
  IOS_DEVICE.test(userAgent) || (MAC.test(userAgent) && maxTouchPoints > 1);

// True on iOS or iPadOS when the page is not the home-screen app, whose
// navigator.standalone is true. A navigator without a user agent gives false.
export const installable = (navigator) =>
  typeof navigator?.userAgent === "string" &&
  onIos(navigator) &&
  navigator.standalone !== true;
