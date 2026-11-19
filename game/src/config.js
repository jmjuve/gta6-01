// LOWTIDE — config.js
// One clear job: every tunable number, district, vehicle, mission and
// dialogue line for Port Solmar. No logic lives here, only data.

// World size: the island is a square, half-size WORLD_HALF. Roads form a
// grid; the two canals cut through it. y=0 is street level.
export const WORLD = {
  half: 210,
  streetY: 0,
  // Tide: water level in world units. Low tide leaves canals full but
  // streets dry; high tide drowns the low streets.
  tideLow: -1.1,
  tideHigh: 1.05,
  tidePeriodSec: 240,
  floodStreetsAt: 0.35,
  stallWaterAt: 0.75,
};

export const DISTRICTS = [
  { name: 'Marina', cx: -140, cz: -120, r: 62, color: 0x2e8f86, blurb: 'Boats, warehouses, salt air.' },
  { name: 'Boulevard', cx: 0, cz: -40, r: 78, color: 0xff2d78, blurb: 'Neon, shops, crowds, the long bright avenue.' },
  { name: 'Stilt Quarter', cx: 130, cz: 60, r: 66, color: 0x19c2d8, blurb: 'Houses on posts over narrow canals.' },
  { name: 'Causeway', cx: -40, cz: 150, r: 70, color: 0xff9a1f, blurb: 'The long bridge — the best chase road in town.' },
  { name: 'Old Foundry', cx: -150, cz: 110, r: 58, color: 0xb06a2a, blurb: 'Industrial bones. The crew meets here.' },
  { name: 'Meridian Vault', cx: 60, cz: -150, r: 40, color: 0xd8b13a, blurb: 'The score. The whole city wants it.' },
];

// The two canals: a north-south canal at x = 40 and an east-west canal at
// z = 30. Boats live here; at high tide the flood joins them to the streets.
export const CANALS = [
  { axis: 'x', at: 40, halfWidth: 9 },
  { axis: 'z', at: 30, halfWidth: 9 },
];

// Roads: axis-aligned avenues. Traffic follows these lines.
export const ROADS_X = [-160, -100, -40, 20, 80, 140];
export const ROADS_Z = [-160, -100, -40, 20, 80, 140];
export const ROAD_HALF_WIDTH = 7;

export const VEHICLES = {
  sedan:   { name: 'Solmar Sedan',   kind: 'car',  topSpeed: 34, accel: 16, grip: 1.0, price: 0,    color: 0x3a7bd5, seats: 1 },
  coupe:   { name: 'Vesper Coupe',   kind: 'car',  topSpeed: 46, accel: 22, grip: 1.1, price: 1200, color: 0xff2d78, seats: 1 },
  pickup:  { name: 'Foundry Pickup', kind: 'car',  topSpeed: 38, accel: 18, grip: 1.3, price: 900,  color: 0xff9a1f, seats: 1 },
  taxi:    { name: 'Harbor Taxi',    kind: 'car',  topSpeed: 32, accel: 15, grip: 1.0, price: 700,  color: 0xf2c200, seats: 1 },
  patrol:  { name: 'PSPD Cruiser',   kind: 'car',  topSpeed: 42, accel: 24, grip: 1.2, price: 0,    color: 0x1c2733, seats: 1 },
  skiff:   { name: 'Canal Skiff',    kind: 'boat', topSpeed: 26, accel: 14, grip: 1.0, price: 800,  color: 0x19c2d8, seats: 1 },
  speedboat:{ name: 'Tide Runner',   kind: 'boat', topSpeed: 44, accel: 24, grip: 1.0, price: 2200, color: 0xff5a1f, seats: 1 },
  policeBoat: { name: 'PSPD Patrol Boat', kind: 'boat', topSpeed: 40, accel: 22, grip: 1.0, price: 0, color: 0xe8eef2, seats: 1 },
};

export const UPGRADES = [
  { id: 'engine', name: 'Tuned Engine', price: 600, blurb: '+20% top speed' },
  { id: 'armor', name: 'Plated Armor', price: 500, blurb: '+50 max health' },
  { id: 'tires', name: 'Wet-Grip Tires', price: 450, blurb: 'No stall in shallow flood' },
];

export const MISSIONS = [
  {
    id: 'm1', act: 1, title: 'First Fare', payout: 250,
    brief: 'Marlowe Voss: "Drive my client across town. Tide’s coming in — don’t be late."',
    steps: [
      { text: 'Pick up the client at the Marina', at: [-140, -120], radius: 10 },
      { text: 'Drop the client on the Boulevard', at: [0, -40], radius: 12 },
    ],
    done: 'Rae: "One fare down. The city already owes me."',
  },
  {
    id: 'm2', act: 1, title: 'Borrowed Wheels', payout: 400,
    brief: 'Marlowe Voss: "You need wheels of your own. Borrow some. Lose the cops."',
    steps: [
      { text: 'Steal a car — press E next to any parked car', at: null, radius: 0, steal: true },
      { text: 'Lose the heat — get your wanted level to 0', at: null, radius: 0, clearWanted: true },
      { text: 'Bring the car to the Safehouse', at: [-150, 110], radius: 12 },
    ],
    done: 'Rae: "Borrowed. They’ll never miss it. Probably."',
  },
  {
    id: 'm3', act: 1, title: 'The Canal Run', payout: 650,
    brief: 'Marlowe Voss: "High tide opens the quarter. Take the boat through the Stilt Quarter — fast, before the water drops."',
    steps: [
      { text: 'Take the skiff at the Marina dock', at: [-140, -95], radius: 10, needBoat: true },
      { text: 'Run the Stilt Quarter canal — checkpoint 1', at: [110, 30], radius: 12 },
      { text: 'Checkpoint 2 — under the washing lines', at: [150, 60], radius: 12 },
      { text: 'Reach the Causeway dock', at: [40, 150], radius: 12 },
    ],
    done: 'Rae: "The tide carried me. The tide always carries me."',
  },
];

export const SIDE_JOBS = [
  { id: 'taxi', name: 'Taxi Fare', payout: 90, blurb: 'Drive a fare across town.' },
  { id: 'delivery', name: 'Crate Delivery', payout: 140, blurb: 'Foundry crates to the Marina. No questions.' },
  { id: 'charts', name: 'Tide Charts', payout: 0, blurb: '12 charts hidden on rooftops and buoys. Find them all.' },
];

export const PLAYER_START = { x: -140, z: -100, heading: Math.PI / 2 };
export const SAFEHOUSE = { x: -150, z: 110 };
export const VAULT = { x: 60, z: -150 };

// Dusk palette: teal water, sodium orange, magenta/cyan neon.
export const PALETTE = {
  skyTop: 0x1b2a4a,
  skyLow: 0xff7a2a,
  fog: 0x2a1e33,
  sun: 0xff8c3a,
  water: 0x0e5f6b,
  waterHigh: 0x14919b,
  asphalt: 0x23232b,
  sidewalk: 0x3d3d46,
  neonMagenta: 0xff2d78,
  neonCyan: 0x19c2d8,
  neonOrange: 0xff9a1f,
};

export const SAVE_KEY = 'lowtide-save-v1';
export const START_CASH = 150;
export const START_HEALTH = 100;
