/** Test-only mounting of the production Library, not a parallel application. */
import React from "react";
import {createRoot} from "react-dom/client";
import {KernelProvider} from "../src/kernel/KernelProvider";
import {LibraryBrowser} from "../src/library/LibraryBrowser";
import type {LibraryItem} from "../src/library/scope";
import "../src/cradle.css";
const opened: {item: LibraryItem; how: string}[] = [];
Object.assign(window, {collectionOpened: opened});
createRoot(document.getElementById("root")!).render(<KernelProvider><LibraryBrowser mode="techne" initialScope="local"
  onOpen={(item, how) => { opened.push({item, how}); }}/></KernelProvider>);
