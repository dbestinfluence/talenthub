import assert from "node:assert/strict";
import { contentIdentityMatches, getContentIdentity } from "../lib/content-url";

const tracked = getContentIdentity(
  " https://www.instagram.com/reel/ABC123/?igsh=x&utm_source=test ",
  "Instagram",
);
const canonical = getContentIdentity("https://instagram.com/reel/ABC123/");
assert.equal(tracked.normalizedUrl, canonical.normalizedUrl);
assert.equal(tracked.contentId, "ABC123");
assert.equal(contentIdentityMatches(tracked, canonical), true);
assert.equal(
  contentIdentityMatches(tracked, getContentIdentity("https://instagram.com/reel/XYZ/")),
  false,
);
assert.throws(
  () => getContentIdentity("https://instagram.com/creator/", "Instagram"),
  /post\/reel/,
);
assert.throws(
  () => getContentIdentity("https://tiktok.com/@user/video/123", "Instagram"),
  /Expected instagram/,
);
assert.equal(getContentIdentity("https://youtube.com/watch?v=YT123&utm_source=x").contentId, "YT123");
assert.equal(getContentIdentity("https://x.com/user/status/987?utm_source=x").contentId, "987");

console.log("content URL validation tests: PASS");
