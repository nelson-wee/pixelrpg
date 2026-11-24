// Battle maps (arenas): ground, heights, props, start tiles and decoration. Data only: no DOM, no Node APIs.
// A map: { name, n (grid size), terrain(i, j), height(i, j), props { "i,j": kind }, party [tiles], foes [tiles],
//          top (px above the grid for walls), walls (back walls: drawn by docs/lib/gothic.js), lights }.
// i runs to the lower right on screen, j to the lower left. Height is in steps of 12 px. Water and props block a tile.

// ---------- the river crossing: open country (the first demo map, sprites/art/battle-map.png) ----------
const hill = (i, j) => {
  if (j >= 5 && j <= 6 && i > 1) return 0; // river bed
  if (i <= 2 && j <= 3) return 4;
  if (i <= 3 && j <= 4) return 3;
  if (i >= 8 && j >= 8) return 2;
  if (i >= 7 && j <= 2) return 2;
  return 1;
};
function riverTerrain(i, j) {
  if (j >= 5 && j <= 6 && i > 1) return i === 5 ? "wood" : "water";
  if (i <= 3 && j <= 4) return hill(i, j) === 4 ? "cobble" : "moss";
  if ((j === 4 && i > 3) || (i === 5 && j > 6)) return "dirt";
  if (i >= 8 && j >= 8) return "snow";
  if (i >= 7 && j <= 2) return "sand";
  return "grass";
}
const river = {
  name: "River crossing", desc: "Open country: a hill with old stones, a river with one bridge and a ford.",
  n: 11, top: 60,
  terrain: riverTerrain,
  height: (i, j) => (riverTerrain(i, j) === "wood" ? 1 : hill(i, j)),
  props: { "1,10": "oak", "9,6": "oak", "10,1": "pine", "1,4": "banner", "8,9": "pine", "10,9": "pine", "6,10": "rock", "4,10": "bush", "3,3": "crystal", "9,0": "crate", "0,0": "chest", "6,2": "bush" },
  party: [[4, 7], [2, 7], [6, 7], [1, 8], [3, 9], [5, 8]],
  foes: [[5, 3], [7, 3], [8, 2], [1, 2], [2, 1], [5, 1]],
};

// ---------- cloister and chapel: a gothic monastery ----------
// Back: the chapel. A raised chancel (marble) with the altar against the apse wall and its rose window, steps down to
// a nave with pews and a carpet aisle, an arcade of columns on its south side. Left: a gallery along the wall, high
// above the aisle, reached by a grand stair at the front. Front: the cloister, a walk round a sunken garth with a well.
function cloisterCell(i, j) {
  if (i <= 2 && j <= 3) return ["marble", 3];                          // chancel
  if (i === 3 && j <= 3) return ["stairsA", 2];                        // steps down from the chancel
  if (i >= 4 && j <= 3) return [j === 1 ? "carpetN" : j === 2 ? "carpetS" : "flagstone", 1]; // nave, a carpet aisle
  if (i <= 1 && j >= 4 && j <= 8) return ["planks", 4];                // the gallery
  if (i <= 1 && j === 9) return ["stairsB", 3];                        // the grand stair, two flights
  if (i <= 1 && j === 10) return ["stairsB", 2];
  if (i >= 4 && i <= 9 && j >= 6 && j <= 9) return ["grass", 0];       // the garth, one step down
  return ["flagstone", 1];                                              // aisles, arcade, cloister walk
}
const cloister = {
  name: "Cloister and chapel", desc: "A gothic monastery: a raised chancel and altar, a nave with pews, a high gallery, a cloister round a sunken garth.",
  n: 11, top: 108,
  terrain: (i, j) => cloisterCell(i, j)[0],
  height: (i, j) => cloisterCell(i, j)[1],
  props: {
    // chancel
    "0,1": "altar", "0,0": "candelabrum", "0,2": "candelabrum", "2,3": "lectern",
    // nave: pews either side of the carpet; the arcade between nave and cloister walk
    "5,0": "pew", "7,0": "pew", "9,0": "pew", "5,3": "pew", "7,3": "pew", "9,3": "pew",
    "4,4": "column", "6,4": "column", "8,4": "column", "10,4": "column",
    // the gallery and the aisle under it
    "0,5": "statue", "2,6": "tomb",
    // cloister: arcade columns on the walk, the well and a yew in the garth
    "3,7": "column", "3,9": "column", "10,7": "column", "10,9": "column", "6,7": "well", "8,9": "yew",
  },
  party: [[6, 10], [4, 10], [8, 10], [2, 9], [5, 10], [7, 10]],
  foes: [[4, 1], [4, 2], [6, 0], [1, 6], [1, 1], [2, 2]],
  // back walls: the apse wall (left, along i = 0) carries the rose window over the altar; the nave wall (right, along
  // j = 0) has tall lancets, with a clerestory band above both
  walls: { height: 156, rose: { wall: "left", at: 1 } },
  // shafts of window light across the floor: [wall, position along it], falling into the room
  lights: [["right", 3], ["right", 5], ["right", 7], ["right", 9], ["left", 1]],
};

export const MAPS = { river, cloister };
export const MAP_IDS = Object.keys(MAPS);
