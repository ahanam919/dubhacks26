export * from "./types";

import * as stubs from "./stubs";
import { extractMenu as realExtractMenu } from "./extract-menu";
import { matchConcepts as realMatchConcepts, matchConcept as realMatchConcept } from "./match-concept";
import { writeHook as realWriteHook } from "./write-hook";
import { verifyHook as realVerifyHook } from "./verify";
import { makeHook as realMakeHook } from "./make-hook";
import { comparePrice as realComparePrice } from "./compare-price";
import type * as T from "./types";

const REAL = process.env.AI_REAL === "1";

// Real under AI_REAL=1, stubs otherwise.
export const extractMenu: typeof stubs.extractMenu = REAL ? realExtractMenu : stubs.extractMenu;
export const matchConcepts: typeof stubs.matchConcepts = REAL ? realMatchConcepts : stubs.matchConcepts;
export const matchConcept: typeof stubs.matchConcept = REAL ? realMatchConcept : stubs.matchConcept;
export const writeHook: typeof stubs.writeHook = REAL ? realWriteHook : stubs.writeHook;
export const verifyHook: typeof stubs.verifyHook = REAL ? realVerifyHook : stubs.verifyHook;
export const makeHook: typeof stubs.makeHook = REAL ? realMakeHook : stubs.makeHook;

// Pure code, always real. Demo shops rarely list sizes, so allow an unknown local size.
export const comparePrice = async (i: T.ComparePriceInput): Promise<T.ComparePriceResult | null> =>
  realComparePrice(i, { allowUnknownLocalSize: true });

// Still stubs for now.
export const embedText = stubs.embedText;
export const parseQuery = stubs.parseQuery;
export const scoreAspects = stubs.scoreAspects;
export const writeGeofenceMessage = stubs.writeGeofenceMessage;
export const selectPhotos = stubs.selectPhotos;