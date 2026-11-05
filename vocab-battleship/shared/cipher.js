/* Vocab Battleships - shared fleet cipher, version 2.1.
   Loaded by the referee board and by the student cipher page.
   Code format, before the display dashes:
     [board size char][payload in base 36][2 checksum chars]
   Then each character is Caesar-shifted inside 0-9A-Z by key mod 36,
   then the characters are permuted by a shuffle seeded from the key.
   Payload packs one 9-bit record per ship, largest ship first:
     8 bits anchor square (row-major index of the ship's first cell)
     1 bit  orientation (0 vertical, 1 horizontal)
*/
(function (global) {
  "use strict";

  var ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var BASE = 36n;
  var MIN_WORDS = 8;
  var MAX_WORDS = 15;
  var VERSION = "2.1";
  var SHIP_NAMES = { 5: "Carrier", 4: "Battleship", 3: "Cruiser", 2: "Destroyer" };

  function shipLengths(n) {
    if (n <= 10) return [5, 4, 3, 3, 2];
    if (n <= 12) return [5, 4, 3, 3, 2, 2];
    return [5, 4, 3, 3, 2, 2, 2];
  }

  function fleetCellCount(n) {
    var a = shipLengths(n);
    var t = 0;
    for (var i = 0; i < a.length; i++) t += a[i];
    return t;
  }

  function isValidBoardSize(n) {
    return typeof n === "number" && isFinite(n) && Math.floor(n) === n && n >= MIN_WORDS && n <= MAX_WORDS;
  }

  /* ---------- game codes ---------- */

  function randomGameCode(n) {
    var tail = "";
    for (var i = 0; i < 3; i++) tail += ALPHA[Math.floor(Math.random() * 36)];
    return "V" + ALPHA[n] + tail;
  }

  function parseGameCode(raw) {
    var code = String(raw == null ? "" : raw).toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (code.length < 2 || code.charAt(0) !== "V") {
      return { ok: false, error: "A game code starts with V, for example VA7KQ." };
    }
    var n = ALPHA.indexOf(code.charAt(1));
    if (!isValidBoardSize(n)) {
      return { ok: false, error: "That code does not describe a board of 8 to 15 words." };
    }
    return { ok: true, n: n, code: code };
  }

  /* ---------- number helpers ---------- */

  function toB36(v) {
    if (v === 0n) return "0";
    var s = "";
    while (v > 0n) {
      s = ALPHA.charAt(Number(v % BASE)) + s;
      v = v / BASE;
    }
    return s;
  }

  function fromB36(s) {
    var v = 0n;
    for (var i = 0; i < s.length; i++) {
      var d = ALPHA.indexOf(s.charAt(i));
      if (d < 0) throw new Error("The code contains an unknown character.");
      v = v * BASE + BigInt(d);
    }
    return v;
  }

  function checksum(body) {
    var a = 0;
    var b = 0;
    for (var i = 0; i < body.length; i++) {
      var v = ALPHA.indexOf(body.charAt(i));
      a = (a + v) % 36;
      b = (b + v * (i + 1)) % 36;
    }
    return ALPHA.charAt(a) + ALPHA.charAt(b);
  }

  function mulberry32(seed) {
    var a = seed | 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Deterministic shuffle. Identical output on both sites for the same key. */
  function permFor(len, key) {
    var seed = (Math.trunc(key) * 7919 + 104729) % 2147483647;
    var rnd = mulberry32(seed);
    var p = [];
    var i;
    for (i = 0; i < len; i++) p.push(i);
    for (i = len - 1; i > 0; i--) {
      var k = Math.floor(rnd() * (i + 1));
      var t = p[i];
      p[i] = p[k];
      p[k] = t;
    }
    return p;
  }

  function normalizeKey(raw) {
    var k = Math.trunc(Number(raw));
    if (!isFinite(k) || k < 1 || k > 500) {
      throw new Error("The key must be a whole number from 1 to 500.");
    }
    return k;
  }

  /* ---------- geometry ---------- */

  function runFrom(start, step, len) {
    var out = [];
    for (var i = 0; i < len; i++) out.push(start + i * step);
    return out;
  }

  function buildFleet(cells, n) {
    if (!isValidBoardSize(n)) throw new Error("Board size must be 8 to 15.");

    var set = new Set(cells);
    if (set.size !== cells.length) {
      throw new Error("Two ships share a square. If this came from a slip, the slip was made by an older buggy version: generate a fresh one.");
    }
    if (cells.length !== fleetCellCount(n)) {
      throw new Error("This fleet has " + cells.length + " squares, but a " + n + " by " + n +
        " board needs " + fleetCellCount(n) + ".");
    }

    /* Every maximal straight run of two or more ships' cells. */
    var runs = [];
    cells.forEach(function (c) {
      var row = Math.floor(c / n);
      var col = c % n;
      var len;
      var x;
      if (col === 0 || !set.has(c - 1)) {
        len = 0;
        x = c;
        while (Math.floor(x / n) === row && set.has(x)) { len++; x++; }
        if (len > 1) runs.push(runFrom(c, 1, len));
      }
      if (row === 0 || !set.has(c - n)) {
        len = 0;
        x = c;
        while (x < n * n && set.has(x)) { len++; x += n; }
        if (len > 1) runs.push(runFrom(c, n, len));
      }
    });

    var wanted = shipLengths(n).slice().sort(function (a, b) { return b - a; });
    var used = new Set();
    var ships = [];

    for (var i = 0; i < wanted.length; i++) {
      var len = wanted[i];
      var pick = null;
      for (var r = 0; r < runs.length; r++) {
        var cand = runs[r];
        if (cand.length !== len) continue;
        var clash = false;
        for (var q = 0; q < cand.length; q++) {
          if (used.has(cand[q])) { clash = true; break; }
        }
        if (clash) continue;
        pick = cand;
        break;
      }
      if (!pick) throw new Error("Those squares do not form the ship shapes for this board.");
      for (var u = 0; u < pick.length; u++) used.add(pick[u]);
      ships.push({ len: len, cells: pick.slice(), hits: 0, name: "" });
    }

    /* Nothing may be left over and nothing may be used twice. */
    if (used.size !== cells.length) {
      throw new Error("Some squares in that fleet are not part of any ship.");
    }

    var totals = {};
    var seen = {};
    ships.forEach(function (s) { totals[s.len] = (totals[s.len] || 0) + 1; });
    ships.forEach(function (s) {
      seen[s.len] = (seen[s.len] || 0) + 1;
      s.name = SHIP_NAMES[s.len] || (s.len + "-deck ship");
      if (totals[s.len] > 1) s.name = s.name + " " + seen[s.len];
    });
    return ships;
  }

  /* ---------- encode / decode ---------- */

  function group(s) {
    return s.replace(/(.{4})(?=.)/g, "$1-");
  }

  function ungroup(s) {
    return String(s == null ? "" : s).toUpperCase().replace(/[^0-9A-Z]/g, "");
  }

  function encodeFleet(cells, n, key) {
    var k = normalizeKey(key);
    var ships = buildFleet(cells, n).slice().sort(function (a, b) {
      if (b.len !== a.len) return b.len - a.len;
      return a.cells[0] - b.cells[0];
    });

    var value = 0n;
    ships.forEach(function (s) {
      var anchor = s.cells[0];
      var horizontal = (s.cells.length > 1 && s.cells[1] === anchor + 1) ? 1n : 0n;
      value = value * 512n + BigInt(anchor) * 2n + horizontal;
    });

    var body = ALPHA.charAt(n) + toB36(value);
    var raw = body + checksum(body);
    var shift = k % 36;
    var shifted = "";
    var i;
    for (i = 0; i < raw.length; i++) {
      shifted += ALPHA.charAt((ALPHA.indexOf(raw.charAt(i)) + shift) % 36);
    }
    var perm = permFor(shifted.length, k);
    var out = "";
    for (i = 0; i < perm.length; i++) out += shifted.charAt(perm[i]);

    return {
      code: group(out),
      key: k,
      n: n,
      cells: cells.slice().sort(function (a, b) { return a - b; })
    };
  }

  function decodeFleet(rawCode, rawKey) {
    var k = normalizeKey(rawKey);
    var clean = ungroup(rawCode);
    if (clean.length < 5) throw new Error("That code is too short to be a fleet code.");
    if (clean.length > 40) throw new Error("That code is too long to be a fleet code.");

    var perm = permFor(clean.length, k);
    var digits = new Array(clean.length);
    var i;
    for (i = 0; i < clean.length; i++) digits[perm[i]] = ALPHA.indexOf(clean.charAt(i));

    var shift = k % 36;
    var raw = "";
    for (i = 0; i < digits.length; i++) raw += ALPHA.charAt((digits[i] - shift + 36) % 36);

    var body = raw.slice(0, -2);
    var cs = raw.slice(-2);
    if (checksum(body) !== cs) {
      throw new Error("Wrong key, or a mistyped character. Check the key first, then every letter of the code.");
    }

    var n = ALPHA.indexOf(body.charAt(0));
    if (!isValidBoardSize(n)) throw new Error("That code belongs to a different board size.");

    var value = fromB36(body.slice(1));
    var wanted = shipLengths(n).slice().sort(function (a, b) { return b - a; });
    var chunks = [];
    var v = value;
    for (var c = 0; c < wanted.length; c++) {
      chunks.unshift(v % 512n);
      v = v / 512n;
    }
    if (v !== 0n) throw new Error("That code does not fit this game's fleet size.");

    var cells = [];
    for (var s = 0; s < wanted.length; s++) {
      var anchor = Number(chunks[s] >> 1n);
      var horizontal = (chunks[s] & 1n) === 1n;
      var len = wanted[s];
      if (anchor >= n * n) throw new Error("A ship in that code is off the board.");
      var row = Math.floor(anchor / n);
      var col = anchor % n;
      if (horizontal && col + len > n) throw new Error("A ship in that code runs off the edge.");
      if (!horizontal && row + len > n) throw new Error("A ship in that code runs off the edge.");
      for (var d = 0; d < len; d++) cells.push(horizontal ? anchor + d : anchor + d * n);
    }

    var ships = buildFleet(cells, n);
    return {
      cells: cells.slice().sort(function (a, b) { return a - b; }),
      n: n,
      key: k,
      ships: ships
    };
  }

  /* ---------- random legal fleet ---------- */

  function touches(idx, occ, n) {
    var r = Math.floor(idx / n);
    var c = idx % n;
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var rr = r + dr;
        var cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        if (occ.has(rr * n + cc)) return true;
      }
    }
    return false;
  }

  function randomFleet(n) {
    var lengths = shipLengths(n).slice().sort(function (a, b) { return b - a; });
    for (var attempt = 0; attempt < 400; attempt++) {
      var occ = new Set();
      var cells = [];
      var ok = true;
      for (var i = 0; i < lengths.length && ok; i++) {
        var len = lengths[i];
        var placed = false;
        for (var t = 0; t < 500 && !placed; t++) {
          var horiz = Math.random() < 0.5;
          var r = Math.floor(Math.random() * n);
          var c = Math.floor(Math.random() * n);
          if (horiz ? c + len > n : r + len > n) continue;
          var cand = [];
          for (var d = 0; d < len; d++) cand.push(horiz ? r * n + c + d : (r + d) * n + c);
          var bad = false;
          for (var q = 0; q < cand.length; q++) {
            if (touches(cand[q], occ, n)) { bad = true; break; }
          }
          if (bad) continue;
          for (var w = 0; w < cand.length; w++) { occ.add(cand[w]); cells.push(cand[w]); }
          placed = true;
        }
        if (!placed) ok = false;
      }
      if (ok) return cells.sort(function (a, b) { return a - b; });
    }
    throw new Error("Could not find room for a fleet. Press Clear and try again.");
  }

  /* ---------- built-in health check ---------- */

  function selfTest() {
    var results = [];

    var trips = 80;
    var bad = 0;
    var firstBad = "";
    for (var i = 0; i < trips; i++) {
      var n = MIN_WORDS + Math.floor(Math.random() * (MAX_WORDS - MIN_WORDS + 1));
      var k = 1 + Math.floor(Math.random() * 500);
      try {
        var cells = randomFleet(n).slice().sort(function (a, b) { return a - b; });
        var enc = encodeFleet(cells, n, k);
        var dec = decodeFleet(enc.code, k);
        if (dec.n !== n || dec.cells.join(",") !== cells.join(",")) {
          bad++;
          if (!firstBad) firstBad = "n=" + n + " key=" + k + " code=" + enc.code;
        }
      } catch (e) {
        bad++;
        if (!firstBad) firstBad = "n=" + n + " key=" + k + " -> " + e.message;
      }
    }
    results.push({
      name: "Round trip",
      pass: bad === 0,
      detail: bad === 0 ? trips + " random fleets decoded exactly" : bad + " failures. " + firstBad
    });

    /* The regression case: two ships of the same length, in different rows. */
    var fixture = [0, 1, 2, 3, 4, 27, 37, 47, 57, 40, 41, 42, 60, 70, 80, 98, 99];
    var fixtureSorted = fixture.slice().sort(function (a, b) { return a - b; }).join(",");
    var fixtureBad = 0;
    var fixtureTries = 0;
    for (var fk = 1; fk <= 500; fk += 7) {
      fixtureTries++;
      try {
        var fe = encodeFleet(fixture, 10, fk);
        var fd = decodeFleet(fe.code, fk);
        if (fd.cells.join(",") !== fixtureSorted) fixtureBad++;
      } catch (e) {
        fixtureBad++;
      }
    }
    results.push({
      name: "Two ships of equal length",
      pass: fixtureBad === 0,
      detail: fixtureBad === 0
        ? fixtureTries + " keys, fleet rebuilt exactly"
        : fixtureBad + " of " + fixtureTries + " failed"
    });

    var rejected = 0;
    var wrongTries = 40;
    for (var j = 0; j < wrongTries; j++) {
      var n2 = MIN_WORDS + Math.floor(Math.random() * 8);
      var k2 = 1 + Math.floor(Math.random() * 500);
      var k3 = k2 === 500 ? 1 : k2 + 1;
      var enc2 = encodeFleet(randomFleet(n2), n2, k2);
      try { decodeFleet(enc2.code, k3); } catch (e) { rejected++; }
    }
    results.push({
      name: "Wrong key rejected",
      pass: rejected === wrongTries,
      detail: rejected + " of " + wrongTries + " rejected"
    });

    var caught = 0;
    var typoTries = 40;
    for (var t2 = 0; t2 < typoTries; t2++) {
      var n4 = MIN_WORDS + Math.floor(Math.random() * 8);
      var k4 = 1 + Math.floor(Math.random() * 500);
      var enc3 = encodeFleet(randomFleet(n4), n4, k4);
      var chars = enc3.code.split("");
      var at = Math.floor(Math.random() * chars.length);
      var cur = ALPHA.indexOf(chars[at]);
      chars[at] = ALPHA.charAt((cur + 1 + Math.floor(Math.random() * 34)) % 36);
      try { decodeFleet(chars.join(""), k4); } catch (e) { caught++; }
    }
    results.push({
      name: "Typo caught",
      pass: caught === typoTries,
      detail: caught + " of " + typoTries + " refused"
    });

    var allPass = results.every(function (r) { return r.pass; });
    return { pass: allPass, version: VERSION, results: results };
  }

  global.VBCipher = {
    version: VERSION,
    ALPHA: ALPHA,
    MIN_WORDS: MIN_WORDS,
    MAX_WORDS: MAX_WORDS,
    shipLengths: shipLengths,
    fleetCellCount: fleetCellCount,
    isValidBoardSize: isValidBoardSize,
    randomGameCode: randomGameCode,
    parseGameCode: parseGameCode,
    buildFleet: buildFleet,
    encodeFleet: encodeFleet,
    decodeFleet: decodeFleet,
    randomFleet: randomFleet,
    selfTest: selfTest,
    group: group,
    ungroup: ungroup
  };
})(typeof window !== "undefined" ? window : globalThis);
