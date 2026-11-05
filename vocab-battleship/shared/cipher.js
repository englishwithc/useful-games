/* Vocab Battleships — shared fleet cipher.
 *
 * Loaded by both the referee board and the student cipher page.
 * Do not fork this file: if the two copies disagree, every code breaks.
 *
 * A fleet code is, before the display dashes:
 *   [board size char][payload in base 36][2 checksum chars]
 * Then every character is Caesar-shifted inside the 36-symbol alphabet,
 * then the characters are transposed by a key-derived permutation.
 *
 * The payload packs one 9-bit record per ship, in descending size order:
 *   8 bits = anchor square (first cell of the ship, row-major)
 *   1 bit  = 0 vertical, 1 horizontal
 */
(function (global) {
  "use strict";

  var ALPHA = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  var BASE = 36n;
  var MIN_WORDS = 8;
  var MAX_WORDS = 15;
  var NAMES = { 5: "Carrier", 4: "Battleship", 3: "Cruiser", 2: "Destroyer" };

  function shipLengths(n) {
    if (n <= 10) return [5, 4, 3, 3, 2];
    if (n <= 12) return [5, 4, 3, 3, 2, 2];
    return [5, 4, 3, 3, 2, 2, 2];
  }

  function fleetCellCount(n) {
    return shipLengths(n).reduce(function (a, b) { return a + b; }, 0);
  }

  function isValidBoardSize(n) {
    return Number.isInteger(n) && n >= MIN_WORDS && n <= MAX_WORDS;
  }

  /* ---------- game codes ---------- */

  function randomGameCode(n) {
    var tail = "";
    for (var i = 0; i < 3; i++) {
      tail += ALPHA[Math.floor(Math.random() * 36)];
    }
    return "V" + ALPHA[n] + tail;
  }

  function parseGameCode(raw) {
    var code = String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (code.length < 2 || code[0] !== "V") {
      return { ok: false, error: "A game code starts with V, for example VA7KQ." };
    }
    var n = ALPHA.indexOf(code[1]);
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
      s = ALPHA[Number(v % BASE)] + s;
      v = v / BASE;
    }
    return s;
  }

  function fromB36(s) {
    var v = 0n;
    for (var i = 0; i < s.length; i++) {
      var d = ALPHA.indexOf(s[i]);
      if (d < 0) throw new Error("Unknown character in code.");
      v = v * BASE + BigInt(d);
    }
    return v;
  }

  function checksum(body) {
    var a = 0, b = 0;
    for (var i = 0; i < body.length; i++) {
      var v = ALPHA.indexOf(body[i]);
      a = (a + v) % 36;
      b = (b + v * (i + 1)) % 36;
    }
    return ALPHA[a] + ALPHA[b];
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

  /* Deterministic shuffle of positions, identical on both sites. */
  function permFor(len, key) {
    var seed = (key * 2654435761) % 2147483647 + 12345;
    var rnd = mulberry32(seed);
    var p = [];
    for (var i = 0; i < len; i++) p.push(i);
    for (var j = len - 1; j > 0; j--) {
      var k = Math.floor(rnd() * (j + 1));
      var tmp = p[j];
      p[j] = p[k];
      p[k] = tmp;
    }
    return p;
  }

  function normalizeKey(raw) {
    var k = Math.trunc(Number(raw));
    if (!Number.isFinite(k) || k < 1 || k > 500) {
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
    if (set.size !== cells.length) throw new Error("Two ships share a square.");
    if (cells.length !== fleetCellCount(n)) {
      throw new Error("This fleet has " + cells.length + " squares; a " + n +
        "x" + n + " board needs " + fleetCellCount(n) + ".");
    }

    var runs = [];
    cells.forEach(function (c) {
      var row = Math.floor(c / n), col = c % n, len, x;
      if (col === 0 || !set.has(c - 1)) {
        len = 0; x = c;
        while (Math.floor(x / n) === row && set.has(x)) { len++; x++; }
        if (len > 1) runs.push(runFrom(c, 1, len));
      }
      if (row === 0 || !set.has(c - n)) {
        len = 0; x = c;
        while (x < n * n && set.has(x)) { len++; x += n; }
        if (len > 1) runs.push(runFrom(c, n, len));
      }
    });

    var wanted = shipLengths(n).slice().sort(function (a, b) { return b - a; });
    var used = new Set();
    var ships = [];
    wanted.forEach(function (len) {
      var run = runs.find(function (r) {
        return r.length === len && r.every(function (i) { return !used.has(i); });
      });
      if (!run) throw new Error("That fleet shape does not match this board's ship sizes.");
      run.forEach(function (i) { used.add(i); });
      ships.push({ len: len, cells: run, hits: 0, name: "" });
    });

    var totals = {}, seen = {};
    ships.forEach(function (s) { totals[s.len] = (totals[s.len] || 0) + 1; });
    ships.forEach(function (s) {
      seen[s.len] = (seen[s.len] || 0) + 1;
      s.name = NAMES[s.len] || s.len + "-deck ship";
      if (totals[s.len] > 1) s.name += " " + seen[s.len];
    });
    return ships;
  }

  /* ---------- encode / decode ---------- */

  function group(s) {
    return s.replace(/(.{4})(?=.)/g, "$1-");
  }

  function ungroup(s) {
    return String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  }

  function encodeFleet(cells, n, key) {
    var k = normalizeKey(key);
    var ships = buildFleet(cells, n).slice().sort(function (a, b) {
      return (b.len - a.len) || (a.cells[0] - b.cells[0]);
    });

    var value = 0n;
    ships.forEach(function (s) {
      var anchor = s.cells[0];
      var horizontal = (s.cells.length > 1 && s.cells[1] === anchor + 1) ? 1n : 0n;
      value = value * 512n + BigInt(anchor) * 2n + horizontal;
    });

    var body = ALPHA[n] + toB36(value);
    var raw = body + checksum(body);
    var shift = k % 36;
    var shifted = [];
    for (var i = 0; i < raw.length; i++) {
      shifted.push(ALPHA[(ALPHA.indexOf(raw[i]) + shift) % 36]);
    }
    var perm = permFor(shifted.length, k);
    var out = "";
    for (var j = 0; j < perm.length; j++) out += shifted[perm[j]];

    return { code: group(out), key: k, n: n, cells: cells.slice().sort(function (a, b) { return a - b; }) };
  }

  function decodeFleet(rawCode, rawKey) {
    var k = normalizeKey(rawKey);
    var clean = ungroup(rawCode);
    if (clean.length < 4) throw new Error("That code is too short.");
    if (!/^[0-9A-Z]+$/.test(clean)) throw new Error("That code has characters it should not have.");

    var perm = permFor(clean.length, k);
    var digits = new Array(clean.length);
    for (var i = 0; i < clean.length; i++) digits[perm[i]] = ALPHA.indexOf(clean[i]);

    var shift = k % 36;
    var raw = "";
    for (var j = 0; j < digits.length; j++) raw += ALPHA[(digits[j] - shift + 36) % 36];

    var body = raw.slice(0, -2), cs = raw.slice(-2);
    if (checksum(body) !== cs) {
      throw new Error("That code did not decode. Check the key and every character of the code.");
    }

    var n = ALPHA.indexOf(body[0]);
    if (!isValidBoardSize(n)) throw new Error("That code is for a different board size.");

    var value = fromB36(body.slice(1));
    var wanted = shipLengths(n).slice().sort(function (a, b) { return b - a; });
    var chunks = [];
    var v = value;
    for (var c = 0; c < wanted.length; c++) {
      chunks.unshift(v % 512n);
      v = v / 512n;
    }
    if (v !== 0n) throw new Error("That code does not fit this game's fleet.");

    var cells = [];
    for (var s = 0; s < wanted.length; s++) {
      var anchor = Number(chunks[s] >> 1n);
      var horizontal = (chunks[s] & 1n) === 1n;
      var len = wanted[s];
      if (anchor >= n * n) throw new Error("A ship in that code is off the board.");
      var row = Math.floor(anchor / n), col = anchor % n;
      if (horizontal ? col + len > n : row + len > n) throw new Error("A ship in that code runs off the board.");
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

  /* ---------- random legal fleet (no touching, not even diagonally) ---------- */

  function touches(idx, occ, n) {
    var r = Math.floor(idx / n), c = idx % n;
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        if (occ.has(rr * n + cc)) return true;
      }
    }
    return false;
  }

  function randomFleet(n) {
    var lengths = shipLengths(n);
    for (var attempt = 0; attempt < 500; attempt++) {
      var occ = new Set();
      var cells = [];
      var ok = true;
      for (var i = 0; i < lengths.length; i++) {
        var len = lengths[i];
        var placed = false;
        for (var t = 0; t < 400 && !placed; t++) {
          var horiz = Math.random() < 0.5;
          var r = Math.floor(Math.random() * n);
          var c = Math.floor(Math.random() * n);
          if (horiz ? c + len > n : r + len > n) continue;
          var cand = [];
          for (var d = 0; d < len; d++) cand.push(horiz ? r * n + c + d : (r + d) * n + c);
          if (cand.some(function (x) { return touches(x, occ, n); })) continue;
          cand.forEach(function (x) { occ.add(x); cells.push(x); });
          placed = true;
        }
        if (!placed) { ok = false; break; }
      }
      if (ok) return cells.sort(function (a, b) { return a - b; });
    }
    throw new Error("Could not find a free spot for a fleet. Clear the board and try again.");
  }

  global.VBCipher = {
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
    group: group,
    ungroup: ungroup
  };
})(typeof window !== "undefined" ? window : globalThis);
