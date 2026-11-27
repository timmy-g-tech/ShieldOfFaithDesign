const BANNED = [/thin blue line/i, /blue lives matter/i];

function bannedMatch(text) {
  const value = String(text || "");
  for (const pattern of BANNED) {
    if (pattern.test(value)) return pattern;
  }
  return null;
}

function containsBanned(text) {
  return Boolean(bannedMatch(text));
}

function assertNoBanned(text, label) {
  const pattern = bannedMatch(text);
  if (pattern) {
    throw new Error(`${label} contains a phrase this site does not use (${pattern}).`);
  }
}

module.exports = { BANNED, containsBanned, assertNoBanned };
