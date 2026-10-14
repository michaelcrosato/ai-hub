/* SOURCE: content/ashwick/world-data.js */
/* Ashwick geometry, placements, reusable prefab and actor definitions. World positions are pixels; terrain bounds are tiles. */
(()=>{
'use strict';
globalThis.HBASHWICK_WORLD = {
  "regions": [
    {
      "id": "ashwick:village",
      "name": "Ashwick",
      "builder": "ashwick",
      "width": 48,
      "height": 44,
      "tileSize": 16,
      "defaultFloor": "grass",
      "spawn": {
        "x": 392,
        "y": 584
      },
      "spawns": {
        "arrival": {
          "x": 392,
          "y": 584
        },
        "northRoad": {
          "x": 304,
          "y": 112
        }
      },
      "anchors": {
        "square": {
          "x": 314,
          "y": 392
        },
        "bakery": {
          "x": 184,
          "y": 448
        },
        "quay": {
          "x": 414,
          "y": 615
        },
        "chapel": {
          "x": 438,
          "y": 152
        },
        "prison": {
          "x": 696,
          "y": 391
        },
        "workshop": {
          "x": 216,
          "y": 219
        }
      },
      "terrain": [
        {
          "x": 0,
          "y": 37,
          "w": 48,
          "h": 7,
          "floor": "water",
          "blocked": true
        },
        {
          "x": 45,
          "y": 0,
          "w": 3,
          "h": 44,
          "floor": "water",
          "blocked": true
        },
        {
          "x": 0,
          "y": 0,
          "w": 48,
          "h": 2,
          "floor": "forest"
        },
        {
          "x": 0,
          "y": 0,
          "w": 3,
          "h": 37,
          "floor": "forest"
        },
        {
          "x": 3,
          "y": 35,
          "w": 42,
          "h": 3,
          "floor": "quay"
        },
        {
          "x": 21,
          "y": 37,
          "w": 7,
          "h": 5,
          "floor": "dock"
        },
        {
          "x": 17,
          "y": 15,
          "w": 16,
          "h": 15,
          "floor": "stone"
        },
        {
          "x": 19,
          "y": 28,
          "w": 9,
          "h": 9,
          "floor": "stone"
        },
        {
          "x": 9,
          "y": 17,
          "w": 13,
          "h": 5,
          "floor": "stone"
        },
        {
          "x": 14,
          "y": 25,
          "w": 9,
          "h": 4,
          "floor": "stone"
        },
        {
          "x": 21,
          "y": 11,
          "w": 8,
          "h": 9,
          "floor": "stone"
        },
        {
          "x": 29,
          "y": 18,
          "w": 6,
          "h": 6,
          "floor": "stone"
        },
        {
          "x": 30,
          "y": 10,
          "w": 5,
          "h": 5,
          "floor": "stone"
        },
        {
          "x": 16,
          "y": 8,
          "w": 6,
          "h": 7,
          "floor": "dirt"
        },
        {
          "x": 3,
          "y": 18,
          "w": 10,
          "h": 4,
          "floor": "garden"
        },
        {
          "x": 4,
          "y": 33,
          "w": 13,
          "h": 2,
          "floor": "dirt"
        },
        {
          "x": 33,
          "y": 27,
          "w": 11,
          "h": 8,
          "floor": "dirt"
        }
      ],
      "rooms": [
        {
          "x": 4,
          "y": 7,
          "w": 12,
          "h": 11,
          "wall": 1,
          "cutWall": 2,
          "floor": "wood",
          "doors": [
            [
              9,
              17,
              3,
              1
            ],
            [
              15,
              12,
              1,
              3
            ],
            [
              4,
              12,
              1,
              2
            ]
          ]
        },
        {
          "x": 4,
          "y": 23,
          "w": 12,
          "h": 10,
          "wall": 1,
          "cutWall": 2,
          "floor": "warmstone",
          "doors": [
            [
              9,
              23,
              3,
              1
            ],
            [
              15,
              27,
              1,
              2
            ],
            [
              9,
              32,
              3,
              1
            ]
          ]
        },
        {
          "x": 21,
          "y": 3,
          "w": 11,
          "h": 11,
          "wall": 3,
          "cutWall": 4,
          "floor": "chapel",
          "doors": [
            [
              25,
              13,
              3,
              1
            ],
            [
              21,
              8,
              1,
              2
            ],
            [
              31,
              8,
              1,
              2
            ]
          ]
        },
        {
          "x": 29,
          "y": 30,
          "w": 9,
          "h": 7,
          "wall": 1,
          "cutWall": 2,
          "floor": "wood",
          "doors": [
            [
              29,
              33,
              1,
              2
            ],
            [
              33,
              30,
              2,
              1
            ],
            [
              33,
              36,
              2,
              1
            ]
          ]
        },
        {
          "x": 34,
          "y": 13,
          "w": 12,
          "h": 15,
          "wall": 5,
          "cutWall": 6,
          "floor": "crypt",
          "doors": [
            [
              34,
              21,
              1,
              2
            ]
          ]
        }
      ],
      "walls": [
        {
          "x": 0,
          "y": 0,
          "w": 48,
          "h": 1,
          "wall": 7
        },
        {
          "x": 0,
          "y": 0,
          "w": 1,
          "h": 37,
          "wall": 7
        },
        {
          "x": 47,
          "y": 0,
          "w": 1,
          "h": 44,
          "wall": 7
        },
        {
          "x": 39,
          "y": 14,
          "w": 2,
          "h": 1,
          "wall": 5
        },
        {
          "x": 44,
          "y": 16,
          "w": 1,
          "h": 3,
          "wall": 5
        },
        {
          "x": 44,
          "y": 24,
          "w": 1,
          "h": 2,
          "wall": 5
        },
        {
          "x": 3,
          "y": 18,
          "w": 1,
          "h": 4,
          "wall": 8
        },
        {
          "x": 4,
          "y": 21,
          "w": 3,
          "h": 1,
          "wall": 8
        },
        {
          "x": 10,
          "y": 21,
          "w": 3,
          "h": 1,
          "wall": 8
        },
        {
          "x": 3,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 4,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 5,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 6,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 7,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 8,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 9,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 10,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 11,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 12,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 13,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 14,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 15,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 16,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 17,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 18,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 19,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 20,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 28,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 29,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 30,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 31,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 32,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 33,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 34,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 35,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 36,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 37,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 38,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 39,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 40,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 41,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 42,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 43,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 44,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 21,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 27,
          "y": 37,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 27,
          "y": 38,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 21,
          "y": 39,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 21,
          "y": 40,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 27,
          "y": 40,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 21,
          "y": 41,
          "w": 1,
          "h": 1,
          "wall": 9
        },
        {
          "x": 27,
          "y": 41,
          "w": 1,
          "h": 1,
          "wall": 9
        }
      ],
      "entities": [
        {
          "id": "wren",
          "definition": "ashwick:wren",
          "kind": "actor",
          "x": 314,
          "y": 392,
          "z": 0,
          "state": {
            "facing": 1.1
          }
        },
        {
          "id": "baker",
          "definition": "ashwick:baker",
          "kind": "actor",
          "x": 184,
          "y": 448,
          "z": 0,
          "state": {
            "facing": 0.8
          }
        },
        {
          "id": "ferryman",
          "definition": "ashwick:ferryman",
          "kind": "actor",
          "x": 414,
          "y": 615,
          "z": 0,
          "state": {
            "facing": -1.6
          }
        },
        {
          "id": "prior",
          "definition": "ashwick:prior",
          "kind": "actor",
          "x": 438,
          "y": 152,
          "z": 0,
          "state": {
            "facing": 1.6
          }
        },
        {
          "id": "prisoner",
          "definition": "ashwick:prisoner",
          "kind": "actor",
          "x": 696,
          "y": 391,
          "z": 0,
          "state": {
            "facing": 2.8
          },
          "allowUnreachable": true
        },
        {
          "id": "sentinel1",
          "definition": "ashwick:warden",
          "kind": "actor",
          "x": 633,
          "y": 288,
          "z": 0,
          "state": {},
          "allowUnreachable": true
        },
        {
          "id": "sentinel2",
          "definition": "ashwick:warden",
          "kind": "actor",
          "x": 685,
          "y": 350,
          "z": 0,
          "state": {},
          "allowUnreachable": true
        },
        {
          "id": "bell",
          "definition": "ashwick:bell",
          "kind": "prefab",
          "x": 360,
          "y": 344,
          "z": 0,
          "state": {}
        },
        {
          "id": "ledger",
          "definition": "ashwick:ledger",
          "kind": "prefab",
          "x": 384,
          "y": 104,
          "z": 0,
          "state": {}
        },
        {
          "id": "workbench",
          "definition": "ashwick:workbench",
          "kind": "prefab",
          "x": 136,
          "y": 160,
          "z": 0,
          "state": {}
        },
        {
          "id": "crate",
          "definition": "ashwick:crate",
          "kind": "prefab",
          "x": 200,
          "y": 200,
          "z": 0,
          "state": {}
        },
        {
          "id": "chest",
          "definition": "ashwick:chest",
          "kind": "prefab",
          "x": 200,
          "y": 176,
          "z": 0,
          "state": {}
        },
        {
          "id": "herbs",
          "definition": "ashwick:herbs",
          "kind": "prefab",
          "x": 136,
          "y": 312,
          "z": 0,
          "state": {}
        },
        {
          "id": "oven",
          "definition": "ashwick:oven",
          "kind": "prefab",
          "x": 112,
          "y": 416,
          "z": 0,
          "state": {}
        },
        {
          "id": "door",
          "definition": "ashwick:door",
          "kind": "prefab",
          "x": 552,
          "y": 352,
          "z": 0,
          "state": {}
        },
        {
          "id": "resonator",
          "definition": "ashwick:resonator",
          "kind": "prefab",
          "x": 656,
          "y": 280,
          "z": 0,
          "state": {},
          "allowUnreachable": true
        },
        {
          "id": "bed",
          "definition": "ashwick:bed",
          "kind": "prefab",
          "x": 550,
          "y": 526,
          "z": 0,
          "state": {}
        },
        {
          "id": "offering",
          "definition": "ashwick:offering",
          "kind": "prefab",
          "x": 464,
          "y": 104,
          "z": 0,
          "state": {}
        },
        {
          "id": "well",
          "definition": "ashwick:well",
          "kind": "prefab",
          "x": 440,
          "y": 416,
          "z": 0,
          "state": {}
        }
      ],
      "landmarks": [
        {
          "name": "The Undercroft",
          "x": 640,
          "y": 330,
          "bounds": [
            34,
            13,
            12,
            15
          ]
        },
        {
          "name": "Chapel of the Tide",
          "x": 423,
          "y": 147,
          "bounds": [
            21,
            3,
            11,
            11
          ]
        },
        {
          "name": "The Bellwright’s Workshop",
          "x": 160,
          "y": 192,
          "bounds": [
            4,
            7,
            12,
            11
          ]
        },
        {
          "name": "Mara’s Bakehouse",
          "x": 160,
          "y": 447,
          "bounds": [
            4,
            23,
            12,
            10
          ]
        },
        {
          "name": "The Lantern Inn",
          "x": 536,
          "y": 535,
          "bounds": [
            29,
            30,
            9,
            7
          ]
        },
        {
          "name": "The Silverleaf Garden",
          "x": 128,
          "y": 313,
          "bounds": [
            3,
            18,
            10,
            4
          ]
        },
        {
          "name": "Ashwick · The Old Quay",
          "x": 392,
          "y": 590,
          "bounds": [
            0,
            35,
            48,
            9
          ]
        },
        {
          "name": "Ashwick · Bell Square",
          "x": 365,
          "y": 375,
          "bounds": [
            0,
            0,
            48,
            44
          ]
        }
      ],
      "mapPresentation": {
        "name": "The village of Ashwick"
      }
    }
  ],
  "prefabs": [
    {
      "id": "ashwick:bell",
      "name": "The Hollow Bell",
      "interaction": "bell",
      "dialogue": "ashwick:talk:bell",
      "description": "The Hollow Bell",
      "verbs": [
        "inspect"
      ],
      "type": "bell",
      "icon": "bell",
      "range": 29,
      "pick": {
        "height": 50,
        "range": 18
      },
      "visual": {
        "kind": "bell"
      }
    },
    {
      "id": "ashwick:ledger",
      "name": "Covenant ledger",
      "interaction": "ledger",
      "dialogue": "ashwick:talk:ledger",
      "description": "Covenant ledger",
      "verbs": [
        "inspect",
        "read"
      ],
      "type": "clue",
      "icon": "book",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "furniture",
        "name": "lectern"
      }
    },
    {
      "id": "ashwick:workbench",
      "name": "Bellwright’s bench",
      "interaction": "workbench",
      "dialogue": "ashwick:talk:workbench",
      "description": "Bellwright’s bench",
      "verbs": [
        "inspect"
      ],
      "type": "clue",
      "icon": "search",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "furniture",
        "name": "table",
        "w": 44,
        "d": 20,
        "cloth": "#65756a",
        "tools": true
      }
    },
    {
      "id": "ashwick:crate",
      "name": "Heavy crate",
      "interaction": "crate",
      "dialogue": "ashwick:talk:crate",
      "description": "Heavy crate",
      "verbs": [
        "inspect",
        "move"
      ],
      "type": "move",
      "icon": "hand",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "prop",
        "name": "crate",
        "size": 1.65,
        "color": "#aa875a"
      },
      "initialState": {
        "moved": false
      },
      "move": {
        "grid": 16
      },
      "collider": {
        "w": 16,
        "h": 16,
        "when": "always"
      }
    },
    {
      "id": "ashwick:chest",
      "name": "Iron-bound chest",
      "interaction": "chest",
      "dialogue": "ashwick:talk:chest",
      "description": "Iron-bound chest",
      "verbs": {
        "inspect": {},
        "open": {
          "conditions": {
            "op": "entity",
            "target": "crate",
            "key": "moved",
            "value": true,
            "reason": "Move the keeper’s supply crate before opening the chest."
          }
        },
        "close": {}
      },
      "type": "loot",
      "icon": "chest",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "prop",
        "name": "chest",
        "size": 1.25,
        "color": "#86724a"
      },
      "initialState": {
        "open": false,
        "locked": false
      },
      "capacity": 20,
      "inventory": {}
    },
    {
      "id": "ashwick:herbs",
      "name": "Silverleaf garden",
      "interaction": "herbs",
      "dialogue": "ashwick:talk:herbs",
      "description": "Silverleaf garden",
      "verbs": [
        "inspect",
        "gather"
      ],
      "type": "gather",
      "icon": "leaf",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "marker",
        "color": "#b7cf94"
      },
      "gather": {
        "item": "herb",
        "count": 2,
        "cap": 6
      }
    },
    {
      "id": "ashwick:oven",
      "name": "Mara’s oven",
      "interaction": "oven",
      "dialogue": "ashwick:talk:oven",
      "description": "Mara’s oven",
      "verbs": [
        "inspect"
      ],
      "type": "craft",
      "icon": "flame",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "furniture",
        "name": "oven"
      }
    },
    {
      "id": "ashwick:door",
      "name": "Undercroft gate",
      "interaction": "door",
      "dialogue": "ashwick:talk:door",
      "description": "Undercroft gate",
      "verbs": [
        "inspect",
        "open",
        "close",
        "unlock"
      ],
      "type": "gate",
      "icon": "key",
      "range": 33,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "gate",
        "orientation": "vertical",
        "width": 32,
        "height": 38
      },
      "initialState": {
        "open": false,
        "locked": true
      },
      "key": "key",
      "collider": {
        "w": 16,
        "h": 32,
        "when": "closed"
      }
    },
    {
      "id": "ashwick:resonator",
      "name": "The Resonator",
      "interaction": "resonator",
      "dialogue": "ashwick:talk:resonator",
      "description": "The Resonator",
      "verbs": [
        "inspect"
      ],
      "type": "finale",
      "icon": "rune",
      "range": 29,
      "pick": {
        "height": 48,
        "range": 18
      },
      "visual": {
        "kind": "resonator"
      }
    },
    {
      "id": "ashwick:bed",
      "name": "The traveller’s bed",
      "interaction": "bed",
      "dialogue": "ashwick:talk:bed",
      "description": "The traveller’s bed",
      "verbs": [
        "inspect",
        "rest"
      ],
      "type": "rest",
      "icon": "bed",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "furniture",
        "name": "bed"
      },
      "rest": {
        "hp": 100,
        "mana": 60,
        "seconds": 30
      }
    },
    {
      "id": "ashwick:offering",
      "name": "Offering bowl",
      "interaction": "offering",
      "dialogue": "ashwick:talk:offering",
      "description": "Offering bowl",
      "verbs": [
        "inspect"
      ],
      "type": "steal",
      "icon": "coin",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "furniture",
        "name": "offering"
      },
      "owner": "ashwick:covenant"
    },
    {
      "id": "ashwick:well",
      "name": "The old well",
      "interaction": "well",
      "dialogue": "ashwick:talk:well",
      "description": "The old well",
      "verbs": [
        "inspect"
      ],
      "type": "restore",
      "icon": "water",
      "range": 29,
      "pick": {
        "height": 24,
        "range": 18
      },
      "visual": {
        "kind": "well"
      }
    }
  ],
  "actors": [
    {
      "id": "ashwick:wren",
      "name": "Wren",
      "role": "Apprentice",
      "team": "neutral",
      "interaction": "wren",
      "dialogue": "ashwick:talk:wren",
      "portrait": "ashwick:portrait:wren",
      "color": "#739285",
      "stats": {
        "hp": 70,
        "maxHp": 70,
        "mana": 40,
        "maxMana": 40,
        "speed": 67,
        "radius": 4,
        "damage": 9
      },
      "appearance": {
        "size": 1.1,
        "build": "heroic",
        "outfit": "tunic",
        "weapon": "staff",
        "hair": "short",
        "hood": false,
        "sleeves": "long",
        "colors": {
          "skin": "#cda887",
          "hair": "#a87540",
          "cloth": "#739285",
          "pants": "#45453c",
          "boot": "#3b302a",
          "trim": "#d3b77c",
          "belt": "#6b4a31"
        }
      },
      "companion": {
        "assist": true,
        "assistDamage": 9,
        "assistInterval": 5,
        "assistRange": 70,
        "defensive": true
      },
      "range": 29
    },
    {
      "id": "ashwick:baker",
      "name": "Mara",
      "role": "Baker",
      "team": "neutral",
      "interaction": "baker",
      "dialogue": "ashwick:talk:baker",
      "portrait": "ashwick:portrait:baker",
      "color": "#b5734d",
      "stats": {
        "hp": 70,
        "maxHp": 70,
        "mana": 40,
        "maxMana": 40,
        "speed": 67,
        "radius": 4,
        "damage": 9
      },
      "appearance": {
        "size": 1.2,
        "build": "heroic",
        "outfit": "tunic",
        "weapon": null,
        "hair": "long",
        "hood": false,
        "sleeves": "long",
        "colors": {
          "skin": "#cda887",
          "hair": "#514038",
          "cloth": "#b5734d",
          "pants": "#45453c",
          "boot": "#3b302a",
          "trim": "#d3b77c",
          "belt": "#6b4a31"
        }
      },
      "schedule": [
        {
          "start": 0,
          "end": 120,
          "regionId": "ashwick:village",
          "anchor": "bakery",
          "activity": "tending the counter"
        },
        {
          "start": 120,
          "end": 240,
          "regionId": "ashwick:village",
          "anchor": "workshop",
          "activity": "delivering the midday loaf"
        }
      ],
      "range": 29
    },
    {
      "id": "ashwick:ferryman",
      "name": "Toma",
      "role": "Ferryman",
      "team": "neutral",
      "interaction": "ferryman",
      "dialogue": "ashwick:talk:ferryman",
      "portrait": "ashwick:portrait:ferryman",
      "color": "#5e8293",
      "stats": {
        "hp": 70,
        "maxHp": 70,
        "mana": 40,
        "maxMana": 40,
        "speed": 67,
        "radius": 4,
        "damage": 9
      },
      "appearance": {
        "size": 1.2,
        "build": "heroic",
        "outfit": "tunic",
        "weapon": null,
        "hair": "short",
        "hood": false,
        "sleeves": "long",
        "colors": {
          "skin": "#cda887",
          "hair": "#514038",
          "cloth": "#5e8293",
          "pants": "#45453c",
          "boot": "#3b302a",
          "trim": "#d3b77c",
          "belt": "#6b4a31"
        }
      },
      "range": 29
    },
    {
      "id": "ashwick:prior",
      "name": "Sister Ione",
      "role": "Keeper of the Bell",
      "team": "neutral",
      "interaction": "prior",
      "dialogue": "ashwick:talk:prior",
      "portrait": "ashwick:portrait:prior",
      "color": "#a59666",
      "stats": {
        "hp": 70,
        "maxHp": 70,
        "mana": 40,
        "maxMana": 40,
        "speed": 67,
        "radius": 4,
        "damage": 9
      },
      "appearance": {
        "size": 1.2,
        "build": "heroic",
        "outfit": "robe",
        "weapon": null,
        "hair": "bald",
        "hood": true,
        "sleeves": "long",
        "colors": {
          "skin": "#cda887",
          "hair": "#514038",
          "cloth": "#a59666",
          "pants": "#45453c",
          "boot": "#3b302a",
          "trim": "#d3b77c",
          "belt": "#6b4a31"
        }
      },
      "range": 29
    },
    {
      "id": "ashwick:prisoner",
      "name": "Elian",
      "role": "Bellwright",
      "team": "neutral",
      "interaction": "prisoner",
      "dialogue": "ashwick:talk:prisoner",
      "portrait": "ashwick:portrait:prisoner",
      "color": "#897585",
      "stats": {
        "hp": 70,
        "maxHp": 70,
        "mana": 40,
        "maxMana": 40,
        "speed": 67,
        "radius": 4,
        "damage": 9
      },
      "appearance": {
        "size": 1.2,
        "build": "heroic",
        "outfit": "tunic",
        "weapon": null,
        "hair": "short",
        "hood": false,
        "sleeves": "long",
        "colors": {
          "skin": "#cda887",
          "hair": "#514038",
          "cloth": "#897585",
          "pants": "#45453c",
          "boot": "#3b302a",
          "trim": "#d3b77c",
          "belt": "#6b4a31"
        }
      },
      "range": 29
    },
    {
      "id": "ashwick:player",
      "name": "Wayfarer",
      "team": "player",
      "stats": {
        "hp": 100,
        "maxHp": 100,
        "mana": 60,
        "maxMana": 60,
        "speed": 82,
        "radius": 4.3,
        "damage": 23
      },
      "appearance": {
        "size": 1.23,
        "build": "heroic",
        "outfit": "coat",
        "weapon": "sword",
        "hair": "ponytail",
        "sleeves": "long",
        "cape": {
          "len": 8,
          "width": 5,
          "seg": 2.5
        },
        "colors": {
          "skin": "#d3ae86",
          "hair": "#362b27",
          "cloth": "#4b7475",
          "coat": "#3b666b",
          "pants": "#393b3b",
          "boot": "#332c27",
          "belt": "#755338",
          "trim": "#d8ba77",
          "cape": "#b77f43",
          "capeIn": "#604333",
          "metal": "#d8d7c2"
        }
      },
      "range": 29
    },
    {
      "id": "ashwick:warden",
      "name": "Hollow Warden",
      "team": "hostile",
      "stats": {
        "hp": 55,
        "maxHp": 55,
        "mana": 0,
        "maxMana": 0,
        "speed": 35,
        "radius": 5,
        "damage": 13
      },
      "attack": {
        "range": 21,
        "damage": 13,
        "windup": 0.65,
        "active": 0.2,
        "recover": 0.9,
        "cooldown": 1.5,
        "aggroRange": 160,
        "profile": "melee",
        "animation": "overhead"
      },
      "peaceWhen": {
        "op": "any",
        "conditions": [
          {
            "op": "flag",
            "key": "resonatorOff",
            "value": true
          },
          {
            "op": "state",
            "key": "ending",
            "compare": "ne",
            "value": null
          }
        ]
      },
      "appearance": {
        "size": 1.3,
        "build": "bulky",
        "weapon": "sword",
        "armor": true,
        "hat": "helmet",
        "outfit": "tunic",
        "eyeGlow": "#84e5d0",
        "colors": {
          "skin": "#727a6c",
          "cloth": "#486e69",
          "plate": "#64847c",
          "metal": "#a3b4a1",
          "pants": "#384944",
          "trim": "#b4a166"
        }
      },
      "loot": {},
      "xpReward": 5,
      "range": 29
    }
  ],
  "assets": [
    {
      "id": "ashwick:portrait:wren",
      "type": "portrait",
      "kind": "procedural",
      "color": "#739285",
      "name": "Wren",
      "aliases": [
        "wren"
      ]
    },
    {
      "id": "ashwick:portrait:baker",
      "type": "portrait",
      "kind": "procedural",
      "color": "#b5734d",
      "name": "Mara",
      "aliases": [
        "baker"
      ]
    },
    {
      "id": "ashwick:portrait:ferryman",
      "type": "portrait",
      "kind": "procedural",
      "color": "#5e8293",
      "name": "Toma",
      "aliases": [
        "ferryman"
      ]
    },
    {
      "id": "ashwick:portrait:prior",
      "type": "portrait",
      "kind": "procedural",
      "color": "#a59666",
      "name": "Sister Ione",
      "aliases": [
        "prior"
      ]
    },
    {
      "id": "ashwick:portrait:prisoner",
      "type": "portrait",
      "kind": "procedural",
      "color": "#897585",
      "name": "Elian",
      "aliases": [
        "prisoner"
      ]
    },
    {
      "id": "ashwick:portrait:bell",
      "aliases": [
        "bell"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "bell",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:ledger",
      "aliases": [
        "ledger"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "ledger",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:workbench",
      "aliases": [
        "workbench"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "workbench",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:crate",
      "aliases": [
        "crate"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "crate",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:chest",
      "aliases": [
        "chest"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "chest",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:herbs",
      "aliases": [
        "herbs"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "herbs",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:oven",
      "aliases": [
        "oven"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "oven",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:door",
      "aliases": [
        "door"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "door",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:resonator",
      "aliases": [
        "resonator"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "resonator",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:bed",
      "aliases": [
        "bed"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "bed",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:well",
      "aliases": [
        "well"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "well",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:offering",
      "aliases": [
        "offering"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "offering",
      "color": "#9b9e78"
    },
    {
      "id": "ashwick:portrait:magic",
      "aliases": [
        "magic"
      ],
      "type": "portrait",
      "kind": "procedural",
      "name": "magic",
      "color": "#9b9e78"
    }
  ]
};
})();

/* SOURCE: content/ashwick/pack.js */
/* Ashwick authored RPG content. Original prose and action aliases are retained.
 * Records are data: no story switch or mutable gameplay implementation lives here.
 * World definitions are authored separately in world-data.js. */
(function (root) {
  'use strict';
  const pack = {
  "id": "ashwick",
  "version": "2.0.0",
  "name": "The Hollow Bell",
  "initial": {
    "version": 1,
    "flags": {},
    "inventory": {
      "bread": 1,
      "herb": 2,
      "lockpick": 1,
      "flour": 1
    },
    "hp": 100,
    "mana": 60,
    "gold": 12,
    "reputation": 0,
    "ending": null,
    "time": 0,
    "player": {
      "x": 384,
      "y": 570
    },
    "enemies": [
      {
        "id": "sentinel1",
        "hp": 55
      },
      {
        "id": "sentinel2",
        "hp": 55
      }
    ],
    "regionId": "ashwick:village"
  },
  "stateProjections": [
    {
      "flag": "doorOpen",
      "condition": {
        "op": "entity",
        "target": "door",
        "key": "open",
        "value": true
      }
    },
    {
      "flag": "crateMoved",
      "condition": {
        "op": "entity",
        "target": "crate",
        "key": "moved",
        "value": true
      }
    }
  ],
  "settings": {
    "primaryQuest": "ashwick:investigation",
    "partyLimit": 3,
    "dayLength": 240,
    "inventoryCapacity": 80,
    "maxContainerDepth": 4,
    "player": {
      "appearance": {
        "size": 1.23,
        "build": "heroic",
        "outfit": "coat",
        "weapon": "sword",
        "hair": "ponytail",
        "sleeves": "long",
        "cape": {
          "len": 8,
          "width": 5,
          "seg": 2.5
        },
        "colors": {
          "skin": "#d3ae86",
          "hair": "#362b27",
          "cloth": "#4b7475",
          "coat": "#3b666b",
          "pants": "#393b3b",
          "boot": "#332c27",
          "belt": "#755338",
          "trim": "#d8ba77",
          "cape": "#b77f43",
          "capeIn": "#604333",
          "metal": "#d8d7c2"
        }
      },
      "stats": {
        "hp": 100,
        "maxHp": 100,
        "mana": 60,
        "maxMana": 60,
        "damage": 23,
        "range": 36
      },
      "attack": {
        "damage": 23,
        "range": 36,
        "windup": 0.1,
        "cooldown": 0.6
      },
      "speed": 75,
      "runSpeed": 108
    },
    "presentation": {
      "welcome": "Welcome to Ashwick. Speak to Wren by the old bell.",
      "deathTitle": "A hand in the dark",
      "deathText": "The bronze wardens leave you at the threshold. A familiar voice calls from the village. Your discoveries will not be lost.",
      "deathChoice": "Accept Mara’s help · recover in the village",
      "endingTarget": "bell",
      "spellbookTitle": "The ways of small magic",
      "spellbookText": "A little light, a mended wound, a moment of peace. Great changes often begin with small spells. Focus returns at the village well or after rest.",
      "fieldLocation": "Ashwick · field notes"
    },
    "music": {
      "bpm": 66,
      "steps": 2,
      "tracks": [
        {
          "wave": "sine",
          "vol": 0.11,
          "notes": "D4 - - . A4 - F4 - E4 - - . C4 - - . D4 - - . A4 - C5 - Bb4 - A4 - F4 - E4 -"
        },
        {
          "wave": "triangle",
          "vol": 0.08,
          "notes": "D3 - - - - - - - C3 - - - - - - - Bb2 - - - - - - - A2 - - - - - - -"
        },
        {
          "wave": "sine",
          "vol": 0.035,
          "notes": ". . A5 . . . . . . . G5 . . . . . . . F5 . . . . . . . E5 . . . . ."
        }
      ]
    }
  },
  "queries": {
    "revealCost": {
      "type": "abilityCost",
      "ability": "ashwick:reveal",
      "key": "mana"
    },
    "revealHerbs": {
      "type": "abilityCost",
      "ability": "ashwick:reveal",
      "item": "herb"
    },
    "mendCost": {
      "type": "abilityCost",
      "ability": "ashwick:mend",
      "key": "mana"
    },
    "mendHerbs": {
      "type": "abilityCost",
      "ability": "ashwick:mend",
      "item": "herb"
    },
    "wardCost": {
      "type": "abilityCost",
      "ability": "ashwick:ward",
      "key": "mana"
    },
    "wardHerbs": {
      "type": "abilityCost",
      "ability": "ashwick:ward",
      "item": "herb"
    },
    "unsealCost": {
      "type": "abilityCost",
      "ability": "ashwick:unseal",
      "key": "mana"
    },
    "unsealHerbs": {
      "type": "abilityCost",
      "ability": "ashwick:unseal",
      "item": "herb"
    },
    "clues": {
      "type": "objectiveCount",
      "quest": "ashwick:investigation",
      "group": "evidence"
    },
    "clueTotal": {
      "type": "objectiveTotal",
      "quest": "ashwick:investigation",
      "group": "evidence"
    },
    "objective": {
      "type": "objective",
      "quest": "ashwick:investigation"
    },
    "retuneMissing": {
      "type": "missing",
      "quest": "ashwick:investigation",
      "group": "evidence",
      "includeRequirements": true
    },
    "companionSummary": {
      "type": "text",
      "value": {
        "cases": [
          {
            "when": {
              "op": "flag",
              "key": "companion",
              "value": true
            },
            "text": "Wren stood beside you."
          }
        ],
        "default": "You walked your own path."
      }
    }
  },
  "legacy": {
    "regionId": "ashwick:village",
    "statuses": [
      {
        "untilFlag": "wardUntil",
        "status": "ashwick:stillness",
        "target": "player"
      }
    ],
    "entityStates": [
      {
        "flag": "crateMoved",
        "entity": "crate",
        "key": "moved",
        "value": true,
        "transform": {
          "x": 232,
          "y": 223
        }
      },
      {
        "flag": "doorOpen",
        "entity": "door",
        "key": "open",
        "value": true
      },
      {
        "flag": "doorOpen",
        "entity": "door",
        "key": "locked",
        "value": false
      },
      {
        "flag": "chestOpened",
        "entity": "chest",
        "key": "open",
        "value": true
      },
      {
        "flag": "resonatorOff",
        "entity": "resonator",
        "key": "active",
        "value": false
      }
    ],
    "party": [
      {
        "flag": "companion",
        "member": "wren"
      }
    ],
    "enemyIds": {
      "sentinel1": "sentinel1",
      "sentinel2": "sentinel2"
    }
  },
  "items": [
    {
      "id": "ashwick:bread",
      "aliases": [
        "bread"
      ],
      "name": "Hearth bread",
      "description": "Warm bread restores 25 vitality. Toma has not eaten since the bell rang.",
      "icon": "◒",
      "stackable": true,
      "weight": 1,
      "protected": false,
      "useAction": "ashwick:item:bread"
    },
    {
      "id": "ashwick:herb",
      "aliases": [
        "herb"
      ],
      "name": "Silverleaf",
      "description": "A reagent for spells. New leaves grow in Ione’s garden.",
      "icon": "❧",
      "stackable": true,
      "weight": 1,
      "protected": false
    },
    {
      "id": "ashwick:lockpick",
      "aliases": [
        "lockpick"
      ],
      "name": "Iron lockpick",
      "description": "Opens the bell tower service door. One use.",
      "icon": "⌁",
      "stackable": true,
      "weight": 1,
      "protected": false,
      "useAction": "ashwick:item:lockpick"
    },
    {
      "id": "ashwick:key",
      "aliases": [
        "key"
      ],
      "name": "Tower key",
      "description": "A copper key found beneath the keeper’s spare tools.",
      "icon": "⚿",
      "stackable": true,
      "weight": 1,
      "protected": true,
      "useAction": "ashwick:item:key"
    },
    {
      "id": "ashwick:flour",
      "aliases": [
        "flour"
      ],
      "name": "Sack of flour",
      "description": "Combine with well water at the bakery oven. Mara’s flour store is renewable.",
      "icon": "▧",
      "stackable": true,
      "weight": 1,
      "protected": false
    },
    {
      "id": "ashwick:tonic",
      "aliases": [
        "tonic"
      ],
      "name": "Restorative draught",
      "description": "Restores 50 vitality. A bitter, generous remedy.",
      "icon": "♜",
      "stackable": true,
      "weight": 1,
      "protected": false,
      "useAction": "ashwick:item:tonic"
    },
    {
      "id": "ashwick:note",
      "aliases": [
        "note"
      ],
      "name": "Scorched tuning note",
      "description": "Evidence: the ward can carry freely offered memories.",
      "icon": "▤",
      "stackable": true,
      "weight": 1,
      "protected": true,
      "useAction": "ashwick:item:note"
    },
    {
      "id": "ashwick:ledger",
      "aliases": [
        "ledger"
      ],
      "name": "Covenant ledger",
      "description": "Evidence: each storm ward toll erased another resident’s memory.",
      "icon": "▤",
      "stackable": true,
      "weight": 1,
      "protected": true,
      "useAction": "ashwick:item:ledger"
    },
    {
      "id": "ashwick:token",
      "aliases": [
        "token"
      ],
      "name": "Ferryman’s token",
      "description": "Evidence: the Covenant took Toma’s memory of his wife.",
      "icon": "◈",
      "stackable": true,
      "weight": 1,
      "protected": true,
      "useAction": "ashwick:item:token"
    }
  ],
  "dialogues": [
    {
      "id": "ashwick:ending",
      "title": {
        "cases": [
          {
            "when": {
              "op": "state",
              "key": "ending",
              "compare": "eq",
              "value": "retune"
            },
            "text": "A willing chorus"
          }
        ],
        "default": "The last toll"
      },
      "subtitle": "THE HOLLOW BELL · Story complete",
      "text": {
        "join": [
          {
            "cases": [
              {
                "when": {
                  "op": "state",
                  "key": "ending",
                  "compare": "eq",
                  "value": "retune"
                },
                "text": "Wren holds the high note. Elian takes the low. From the quay, a ferryman’s tune joins them. The stolen voices pour out like birds at sunrise.\n\nThe ward rises around Ashwick, bright and clear. Ione’s ledger is opened to the town. From this day on, no memory is taken without permission."
              }
            ],
            "default": "Your final blow splits the bronze. A thousand half-remembered mornings rise into the salt air, finding the people who lost them.\n\nThe ward fades. The tide remains. In the square, Mara starts counting blankets while Elian opens the old floodworks. Ashwick will weather the storm together."
          },
          {
            "cases": [
              {
                "when": {
                  "op": "flag",
                  "key": "ferrymanFed",
                  "value": true
                },
                "text": "Toma brings bread to the first volunteer shift. He remembers who shared a loaf when he could hardly speak."
              },
              {
                "when": {
                  "op": "flag",
                  "key": "ferrymanMended",
                  "value": true
                },
                "text": "Toma joins the first volunteer shift with steady hands. He remembers the small spell that gave him strength when he could hardly speak."
              },
              {
                "when": {
                  "op": "flag",
                  "key": "ferrymanHelped",
                  "value": true
                },
                "text": "Toma joins the first volunteer shift. He remembers the kindness that helped him recover his strength."
              }
            ],
            "default": "Toma sits by the quay, listening for the memories finding their way home."
          },
          {
            "cases": [
              {
                "when": {
                  "op": "flag",
                  "key": "offeringTaken",
                  "value": true
                },
                "text": "The relief bowl is still empty. Your good work does not erase the people you took from."
              },
              {
                "when": {
                  "op": "stat",
                  "key": "reputation",
                  "compare": "gt",
                  "value": 0
                },
                "text": "Small kindnesses travel farther than the sound of a bell."
              }
            ],
            "default": ""
          },
          "Evidence found: {{clues}}/{{clueTotal}}. {{companionSummary}}"
        ],
        "separator": "\n\n"
      },
      "portrait": "bell",
      "choices": [
        {
          "label": "Return to Ashwick",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:talk:wren",
      "title": "Wren",
      "subtitle": "Bellkeeper’s apprentice",
      "text": "“Elian missed the dawn toll. He has never missed a dawn. Last night the bell rang in someone else’s voice.”\n\nThe apprentice holds a cracked tuning fork so tightly that their knuckles pale.",
      "portrait": "wren",
      "choices": [
        {
          "label": "Elian · What happened?",
          "action": "wren:elian"
        },
        {
          "label": "The bell · What did you hear?",
          "action": "wren:bell"
        },
        {
          "label": "Come with me",
          "action": "wren:join"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "wren",
        "talk:wren"
      ],
      "variants": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "title": "Wren",
          "subtitle": "Bellkeeper’s apprentice",
          "text": {
            "cases": [
              {
                "when": {
                  "op": "state",
                  "key": "ending",
                  "compare": "eq",
                  "value": "retune"
                },
                "text": "“For once, the bell sounds like all of us. Elian says I held the high note. I think he is being kind.”"
              }
            ],
            "default": "“I thought Ashwick was the sound of that bell. It is the people carrying sandbags. I can hear them now.”"
          },
          "portrait": "wren",
          "choices": [
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": {
            "op": "flag",
            "key": "companion",
            "value": true
          },
          "title": "Wren",
          "subtitle": "Bellkeeper’s apprentice",
          "text": "“I am here. Whatever they put inside that bell, Elian would never have agreed to it.”",
          "portrait": "wren",
          "choices": [
            {
              "label": "Elian · What happened?",
              "action": "wren:elian"
            },
            {
              "label": "The bell · What did you hear?",
              "action": "wren:bell"
            },
            {
              "label": "Our next step",
              "action": "wren:hint"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:baker",
      "title": "Mara",
      "subtitle": "Baker of Ashwick",
      "text": "“The Covenant gave us grain after the floods. Hard to question the hands that feed you.”\n\nShe looks toward the quay. “Toma has not touched a meal since the toll.”",
      "portrait": "baker",
      "choices": [
        {
          "label": "Toma · How can I help?",
          "action": "baker:toma"
        },
        {
          "label": "Elian · Did you see him?",
          "action": "baker:elian"
        },
        {
          "label": "Baking · Teach me",
          "action": "baker:baking"
        },
        {
          "label": "Buy a draught · 6 crowns",
          "action": "baker:buy"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "baker",
        "talk:baker"
      ],
      "variants": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "title": "Mara",
          "subtitle": "Baker of Ashwick",
          "text": "“Storm or no storm, people will need bread tomorrow. Take some flour. We have work to do.”",
          "portrait": "baker",
          "choices": [
            {
              "label": "Toma · How can I help?",
              "action": "baker:toma"
            },
            {
              "label": "Elian · Did you see him?",
              "action": "baker:elian"
            },
            {
              "label": "Baking · Teach me",
              "action": "baker:baking"
            },
            {
              "label": "Buy a draught · 6 crowns",
              "action": "baker:buy"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:ferryman",
      "title": "Toma",
      "subtitle": "Ferryman",
      "text": "The ferryman turns a copper token between his fingers.\n\n“I remember loving someone. I cannot remember her name. Every time the bell rings, there is less of her.”",
      "portrait": "ferryman",
      "choices": [
        {
          "label": "Last night · Tell me what you saw",
          "action": "ferryman:night"
        },
        {
          "label": {
            "cases": [
              {
                "when": {
                  "op": "item",
                  "item": "bread",
                  "count": 1
                },
                "text": "Offer hearth bread"
              }
            ],
            "default": "Offer hearth bread · none carried"
          },
          "action": "ferryman:feed"
        },
        {
          "label": "Mend his exhaustion · {{mendCost}} mana + {{mendHerbs}} silverleaf",
          "action": "ferryman:mend"
        },
        {
          "label": "The revealed memory",
          "action": "ferryman:reveal",
          "when": {
            "op": "flag",
            "key": "revealed",
            "value": true
          }
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "ferryman",
        "talk:ferryman"
      ],
      "variants": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "title": "Toma",
          "subtitle": "Ferryman",
          "text": {
            "cases": [
              {
                "when": {
                  "op": "state",
                  "key": "ending",
                  "compare": "eq",
                  "value": "retune"
                },
                "text": "“Anwen. Her name was Anwen.”\n\nToma says it again, carefully, as if carrying a full cup across a rocking deck."
              }
            ],
            "default": "“The voice in the bell is quiet. But I dreamed of her face. Perhaps the rest will come.”"
          },
          "portrait": "ferryman",
          "choices": [
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": {
            "op": "flag",
            "key": "clueWitness",
            "value": true
          },
          "text": "“I can still remember the tune. It was hers. The words… the words are coming back slowly.”"
        }
      ]
    },
    {
      "id": "ashwick:talk:prior",
      "title": "Sister Ione",
      "subtitle": "Prior of the Lantern Covenant",
      "text": "“The ward keeps Ashwick above water. Fear would undo what the storm could not. Help us keep the peace.”",
      "portrait": "prior",
      "choices": [
        {
          "label": "Elian · Where is the keeper?",
          "action": "prior:elian"
        },
        {
          "label": "The ward · What powers it?",
          "action": "prior:ward"
        },
        {
          "label": {
            "cases": [
              {
                "when": {
                  "op": "objectives",
                  "quest": "ashwick:investigation",
                  "group": "evidence",
                  "min": 2
                },
                "text": "Present the evidence · {{clues}}/{{clueTotal}}"
              }
            ],
            "default": "Question her account · need 2 clues"
          },
          "action": "prior:confront"
        },
        {
          "label": "The Covenant ledger",
          "action": "talk:ledger"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "prior",
        "talk:prior"
      ],
      "variants": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "title": "Sister Ione",
          "subtitle": "Prior of the Lantern Covenant",
          "text": {
            "cases": [
              {
                "when": {
                  "op": "state",
                  "key": "ending",
                  "compare": "eq",
                  "value": "retune"
                },
                "text": "“I said there was no other way. I meant there was no way I was willing to wait for.”\n\nShe places the hall keys on the table. Ashwick will decide who keeps them."
              }
            ],
            "default": "“Without the ward, the water will come.”\n\nOutside, she hears the first hammer strike a flood barrier. After a long silence, she takes off her ceremonial cloak and joins them."
          },
          "portrait": "prior",
          "choices": [
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": {
            "op": "flag",
            "key": "confronted",
            "value": true
          },
          "text": "“The sea does not ask whether we consent. I thought saving lives was answer enough.”\n\nHer eyes settle on the tower. “Elian disagreed. He is alive. Beneath the bell.”"
        }
      ]
    },
    {
      "id": "ashwick:talk:prisoner",
      "title": "Behind the service gate",
      "subtitle": "Ashwick · field notes",
      "text": "A voice answers from below. “The service door. There is a spare key in my tool chest. Please hurry.”",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:door"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "prisoner",
        "talk:prisoner"
      ],
      "variants": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            }
          },
          "title": "Behind the service gate",
          "subtitle": "Ashwick · field notes",
          "text": "A voice answers from below. “The service door. There is a spare key in my tool chest. Please hurry.”",
          "portrait": "",
          "choices": [
            {
              "label": "Continue",
              "action": "talk:door"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": {
            "op": "flag",
            "key": "melody",
            "value": true
          },
          "title": "Elian",
          "subtitle": "The missing bellkeeper",
          "text": "“A ward can be a promise, freely given. It does not have to be a debt collected in secret.”\n\nHe hums the counter-melody once more. “If you must break it, I will help the town build what comes after.”",
          "portrait": "prisoner",
          "choices": [
            {
              "label": "The counter-melody · Remind me",
              "action": "prisoner:free"
            },
            {
              "label": "The ward sentinels",
              "action": "prisoner:sentinels"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": true,
          "title": "Elian",
          "subtitle": "The missing bellkeeper",
          "text": "The keeper is bruised but breathing. Fine silver threads run from his wrists toward the bell above.\n\n“I built it to warn us of the sea. Ione made it swallow the things we could least afford to lose.”",
          "portrait": "prisoner",
          "choices": [
            {
              "label": "Free Elian and learn the counter-melody",
              "action": "prisoner:free"
            },
            {
              "label": "The ward sentinels",
              "action": "prisoner:sentinels"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:bell",
      "title": "The Hollow Bell",
      "subtitle": "Voices beneath the bronze",
      "text": "A dozen borrowed voices tremble inside the metal. Something living answers from the undercroft.\n\nFind Elian below the tower before you touch the bell.",
      "portrait": "bell",
      "choices": [
        {
          "label": "Listen",
          "action": "bell:listen"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "bell",
        "talk:bell"
      ],
      "variants": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "redirect": "ashwick:ending"
        },
        {
          "when": {
            "op": "flag",
            "key": "melody",
            "value": true
          },
          "title": "The Hollow Bell",
          "subtitle": "The choice belongs to Ashwick",
          "text": "Elian’s counter-melody loosens the stolen memories. The bronze is beginning to crack.\n\nShatter it, and the extraction ends forever. Retune it, and a freely offered harmony can keep the ward alive. There is no time left for Ione to choose for anyone else.",
          "portrait": "bell",
          "choices": [
            {
              "label": "Shatter the bell · end the extraction",
              "action": "ending:shatter_confirm"
            },
            {
              "label": {
                "cases": [
                  {
                    "when": {
                      "op": "all",
                      "conditions": [
                        {
                          "op": "flag",
                          "key": "melody",
                          "value": true
                        },
                        {
                          "op": "party",
                          "member": "wren",
                          "mode": "follow"
                        },
                        {
                          "op": "questComplete",
                          "quest": "ashwick:investigation",
                          "group": "evidence"
                        }
                      ]
                    },
                    "text": "Retune the ward · freely offered voices"
                  }
                ],
                "default": "Retune the ward · requirements"
              },
              "action": {
                "cases": [
                  {
                    "when": {
                      "op": "all",
                      "conditions": [
                        {
                          "op": "flag",
                          "key": "melody",
                          "value": true
                        },
                        {
                          "op": "party",
                          "member": "wren",
                          "mode": "follow"
                        },
                        {
                          "op": "questComplete",
                          "quest": "ashwick:investigation",
                          "group": "evidence"
                        }
                      ]
                    },
                    "text": "ending:retune_confirm"
                  }
                ],
                "default": "ending:locked"
              }
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:ledger",
      "title": "The Covenant ledger",
      "subtitle": "A careful hand. An awful arithmetic.",
      "text": "A green-bound ledger lies open beneath a heavy brass lantern. The columns record names, storm heights, and things that cannot be weighed.",
      "portrait": "ledger",
      "choices": [
        {
          "label": "Read the ledger",
          "action": "ledger:read"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "ledger",
        "talk:ledger"
      ],
      "variants": [
        {
          "when": {
            "op": "flag",
            "key": "clueLedger",
            "value": true
          },
          "title": "The Covenant ledger",
          "subtitle": "A careful hand. An awful arithmetic.",
          "text": "“Toma: one winter together. Lysa: her mother’s voice. Elian: withheld consent.”\n\nEvery person has a column. No column records permission.",
          "portrait": "ledger",
          "choices": [
            {
              "label": "Read the names again",
              "action": "ledger:read"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:workbench",
      "title": "Elian’s workbench",
      "subtitle": "Tools laid out for a return",
      "text": "A tuning fork. A coil of copper. A half-burned note pinned beneath a blue glass weight.\n\nThe last line has been underlined so hard the paper has torn.",
      "portrait": "workbench",
      "choices": [
        {
          "label": "Read the scorched note",
          "action": "workbench:read"
        },
        {
          "label": "Study the spell notation",
          "action": "workbench:magic"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "workbench",
        "talk:workbench"
      ]
    },
    {
      "id": "ashwick:talk:crate",
      "title": "Keeper’s supply crate",
      "subtitle": "Heavy, but movable",
      "text": "A crate of bell ropes blocks a small tool chest. There are fresh scratches beneath its feet.",
      "portrait": "crate",
      "choices": [
        {
          "label": "Push the crate aside",
          "action": "crate:move"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "crate",
        "talk:crate"
      ],
      "variants": [
        {
          "when": {
            "op": "flag",
            "key": "crateMoved",
            "value": true
          },
          "title": "Keeper’s supply crate",
          "subtitle": "The way is clear",
          "text": "You pushed the crate aside. A copper-banded tool chest is now within reach.",
          "portrait": "crate",
          "choices": [
            {
              "label": "Examine the chest",
              "action": "talk:chest"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:chest",
      "title": "The tool chest",
      "subtitle": "Ashwick · field notes",
      "text": "The supply crate blocks the lid. Move the crate first.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:crate"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "chest",
        "talk:chest"
      ],
      "variants": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "crateMoved",
              "value": true
            }
          },
          "title": "The tool chest",
          "subtitle": "Ashwick · field notes",
          "text": "The supply crate blocks the lid. Move the crate first.",
          "portrait": "",
          "choices": [
            {
              "label": "Continue",
              "action": "talk:crate"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": {
            "op": "flag",
            "key": "chestOpened",
            "value": true
          },
          "title": "Elian’s tool chest",
          "subtitle": "Copper hinges, worn smooth",
          "text": "Only old tuning pins remain. You have already taken the spare key and supplies.",
          "portrait": "chest",
          "choices": [
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": true,
          "title": "Elian’s tool chest",
          "subtitle": "Copper hinges, worn smooth",
          "text": "Inside: a spare tower key, a restorative draught, and a note. “Wren — take these if I am late. E.”",
          "portrait": "chest",
          "choices": [
            {
              "label": "Take the key and draught",
              "action": "chest:take"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:herbs",
      "title": "Silverleaf garden",
      "subtitle": "Ione’s medicinal beds",
      "text": "Pale leaves catch the last light. A wooden sign reads: “Take what heals. Leave what grows.”\n\nSilverleaf feeds Reveal, Mend, and Ward. The sheltered plants grow in the garden west of the well.",
      "portrait": "herbs",
      "choices": [
        {
          "label": {
            "cases": [
              {
                "when": {
                  "op": "item",
                  "item": "herb",
                  "count": 6
                },
                "text": "Gather silverleaf · pouch holds 6"
              }
            ],
            "default": "Gather silverleaf · +2"
          },
          "action": "herbs:gather"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "herbs",
        "talk:herbs"
      ]
    },
    {
      "id": "ashwick:talk:oven",
      "title": "Mara’s bread oven",
      "subtitle": "Flour, water, a little patience",
      "text": "The embers glow beneath a stone shelf. Mara leaves renewable flour and well water for anyone willing to work.\n\nA loaf needs one sack of flour. The baking station supplies it if your satchel is empty, then consumes it in the recipe. Bread restores vitality; a warm loaf might help Toma speak about last night.",
      "portrait": "oven",
      "choices": [
        {
          "label": "Bake a loaf · 1 flour, water from the jug",
          "action": "oven:bake"
        },
        {
          "label": "Take flour · renewable",
          "action": "oven:flour"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "oven",
        "talk:oven"
      ]
    },
    {
      "id": "ashwick:talk:door",
      "title": "Bell tower service door",
      "subtitle": "A copper lock and a listening seal",
      "text": "Beyond the grate, a familiar tune falters into silence. The lock can take a key, a pick, or a little patient magic.",
      "portrait": "door",
      "choices": [
        {
          "label": {
            "cases": [
              {
                "when": {
                  "op": "item",
                  "item": "key",
                  "count": 1
                },
                "text": "Use tower key"
              }
            ],
            "default": "Use tower key · not found"
          },
          "action": "door:key"
        },
        {
          "label": {
            "cases": [
              {
                "when": {
                  "op": "item",
                  "item": "lockpick",
                  "count": 1
                },
                "text": "Pick the lock · consumes pick"
              }
            ],
            "default": "Pick the lock · no pick"
          },
          "action": "door:pick"
        },
        {
          "label": "Unseal · {{unsealCost}} mana + {{unsealHerbs}} silverleaf",
          "action": "door:unseal"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "door",
        "talk:door"
      ],
      "variants": [
        {
          "when": {
            "op": "flag",
            "key": "doorOpen",
            "value": true
          },
          "title": "The service door",
          "subtitle": "Ashwick · field notes",
          "text": "The copper lock hangs open. Elian is in the undercroft beyond.",
          "portrait": "",
          "choices": [
            {
              "label": "Continue",
              "action": "talk:prisoner"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        },
        {
          "when": {
            "op": "entity",
            "target": "door",
            "key": "locked",
            "value": false
          },
          "title": "Bell tower service door",
          "subtitle": "Unlocked, ready to open",
          "text": "The seal has already yielded. Swing the service gate open to reach the undercroft.",
          "choices": [
            {
              "label": "Open the unlocked gate",
              "action": "door:open"
            },
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:resonator",
      "title": "The ward resonator",
      "subtitle": "A borrowed heartbeat",
      "text": "Two bronze tines bend toward a glass heart. The sentinels answer every pulse. A counter-melody could still them; so could unraveling the seal.",
      "portrait": "resonator",
      "choices": [
        {
          "label": {
            "cases": [
              {
                "when": {
                  "op": "flag",
                  "key": "melody",
                  "value": true
                },
                "text": "Sing Elian’s counter-melody"
              }
            ],
            "default": "Sing · learn Elian’s melody first"
          },
          "action": "resonator:sing"
        },
        {
          "label": "Unravel the seal · {{unsealCost}} mana + {{unsealHerbs}} silverleaf",
          "action": "resonator:unseal"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "resonator",
        "talk:resonator"
      ],
      "variants": [
        {
          "when": {
            "op": "flag",
            "key": "resonatorOff",
            "value": true
          },
          "title": "The ward resonator",
          "subtitle": "Quiet at last",
          "text": "The threads of light have gone slack. The ward sentinels no longer hear the bell’s command.",
          "portrait": "resonator",
          "choices": [
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:talk:bed",
      "title": "Keeper’s resting bench",
      "subtitle": "A moment beside the hearth",
      "text": "Clean blankets wait by the coals. Rest restores all vitality and focus; Ashwick’s mystery will wait for you.",
      "portrait": "bed",
      "choices": [
        {
          "label": "Rest · restore vitality and focus",
          "action": "bed:rest"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "bed",
        "talk:bed"
      ]
    },
    {
      "id": "ashwick:talk:well",
      "title": "The old well",
      "subtitle": "Cold water, clear thoughts",
      "text": "The water tastes of rain and stone. Drink to restore focus. A full cup is enough; there is always more below.",
      "portrait": "well",
      "choices": [
        {
          "label": "Drink · restore focus",
          "action": "well:drink"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "well",
        "talk:well"
      ]
    },
    {
      "id": "ashwick:talk:offering",
      "title": "The flood relief bowl",
      "subtitle": "These crowns belong to Ashwick’s families",
      "text": "Twelve crowns wait beneath a sign: “For those the tide left with nothing.”\n\nTaking them is theft. Wren and the townsfolk will remember it.",
      "portrait": "offering",
      "choices": [
        {
          "label": "Leave 3 crowns for the families",
          "action": "offering:donate"
        },
        {
          "label": "Take the relief money · theft",
          "action": "offering:warn"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ],
      "aliases": [
        "offering",
        "talk:offering"
      ],
      "variants": [
        {
          "when": {
            "op": "flag",
            "key": "offeringTaken",
            "value": true
          },
          "title": "The flood relief bowl",
          "subtitle": "These crowns belong to Ashwick’s families",
          "text": "The bowl is empty. Someone has placed a single smooth pebble where the crowns were.",
          "portrait": "offering",
          "choices": [
            {
              "label": "Leave",
              "action": "close"
            }
          ]
        }
      ]
    },
    {
      "id": "ashwick:wren:elian",
      "title": "Wren",
      "subtitle": "Elian",
      "text": "“He found something wrong with the tide ward. Took his notes to Sister Ione. Then he vanished.”\n\n“His workshop is northwest of the square. He always left a spare key in his tool chest, behind that ridiculous heavy crate.”",
      "portrait": "wren",
      "choices": [
        {
          "label": "Come with me",
          "action": "wren:join"
        },
        {
          "label": "Other questions",
          "action": "talk:wren"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:wren:bell",
      "title": "Wren",
      "subtitle": "A stolen voice",
      "text": "“Toma’s wife used to sing on the ferry. She died three winters ago. Last night, the bell sang her song.”\n\n“Toma cannot remember her name anymore.”",
      "portrait": "wren",
      "choices": [
        {
          "label": "Other questions",
          "action": "talk:wren"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:wren:join",
      "title": "Wren",
      "subtitle": "Together",
      "text": "“I know every crack in that tower. And I owe Elian more than waiting safely in the square.”\n\nWren follows you and offers a thought when the trail grows cold. Their voice may prove as useful as your blade.",
      "portrait": "wren",
      "choices": [
        {
          "label": "What should we do first?",
          "action": "wren:hint"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:baker:toma",
      "title": "Mara",
      "subtitle": "Bread for the ferryman",
      "text": "“A hungry man cannot bear much grief. Take flour from my oven, bake a loaf, and bring it to him.”\n\n“Keep another for yourself. The world is cruel enough without making bread a test.”",
      "portrait": "baker",
      "choices": [
        {
          "label": "Baking · Teach me",
          "action": "baker:baking"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:baker:baking",
      "title": "Mara",
      "subtitle": "A loaf for the road",
      "text": "“Flour and water, then a little patience. The oven is right here in the bakery. Use it whenever you need bread.”\n\n“A warm loaf restores your strength. Toma could use one, too.”",
      "portrait": "baker",
      "choices": [
        {
          "label": "Other questions",
          "action": "talk:baker"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:baker:elian",
      "title": "Mara",
      "subtitle": "After curfew",
      "text": "“A Covenant cart went to the tower after the last ferry. I saw Elian’s blue coat inside.”\n\n“I told myself he was asleep. I have been telling myself things all morning.”",
      "portrait": "baker",
      "choices": [
        {
          "label": "Other questions",
          "action": "talk:baker"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:prior:ward",
      "title": "Sister Ione",
      "subtitle": "The cost of safety",
      "text": "“Before the ward, we counted children after every storm. Now we count the tides.”\n\n“People forget how much peace costs. They should be grateful someone remembers.”",
      "portrait": "prior",
      "choices": [
        {
          "label": "Read the ledger",
          "action": "talk:ledger"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ledger:read",
      "title": "Evidence · The Covenant ledger",
      "subtitle": "Ashwick · field notes",
      "text": "Beside Toma’s name: “One winter with Anwen. Ward yield: sufficient.”\n\nBeside Elian’s: “Consent withheld. Confined below until compliant.”\n\nThe ward is fed by memories taken without permission.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:prior"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:workbench:read",
      "title": "Evidence · The scorched note",
      "subtitle": "Ashwick · field notes",
      "text": "“A memory freely offered is not consumed. Two willing voices can carry the ward. The old counter-melody releases what was taken.”\n\nBelow it: “Ione must listen. There is another way.”",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:workbench"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:workbench:magic",
      "title": "A field book of small miracles",
      "subtitle": "Ashwick · field notes",
      "text": "REVEAL — trace a memory’s echo. {{revealCost}} focus + {{revealHerbs}} silverleaf.\n\nMEND — restore vitality. {{mendCost}} focus + {{mendHerbs}} silverleaf.\n\nWARD — pacify hostile wardens for twenty seconds. {{wardCost}} focus + {{wardHerbs}} silverleaf.\n\nUNSEAL — choose it at a locked door or resonator. {{unsealCost}} focus + {{unsealHerbs}} silverleaf.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:workbench"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:prisoner:sentinels",
      "title": "Elian",
      "subtitle": "The ward sentinels",
      "text": "“They are instruments, not people. The glass resonator tells them what to guard.”\n\n“Sing my counter-melody to it, or use Unseal on its listening heart. You need not fight them.”",
      "portrait": "prisoner",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:bed:rest",
      "title": "A quiet moment",
      "subtitle": "Ashwick · field notes",
      "text": "The fire settles. When you rise, your hands are steady again. The bell is still waiting.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:bed"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:well:drink",
      "title": "Clear thoughts",
      "subtitle": "Ashwick · field notes",
      "text": "The taste of iron fades. Your focus is fully restored.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:well"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:bell:listen",
      "title": "Under the bronze",
      "subtitle": "Ashwick · field notes",
      "text": "Among the trapped voices, one living voice repeats three low notes. Elian is beneath the tower, beyond the service door.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:wren:hint",
      "title": "Wren",
      "subtitle": "Our next step",
      "text": {
        "join": [
          "{{objective}}",
          {
            "cases": [
              {
                "when": {
                  "op": "not",
                  "condition": {
                    "op": "questComplete",
                    "quest": "ashwick:investigation",
                    "group": "evidence"
                  }
                },
                "text": "“The workshop, the hall, and the quay. Places where last night left a mark.”"
              }
            ],
            "default": "“We know what happened. Now we get to decide what happens next.”"
          }
        ],
        "separator": "\n\n"
      },
      "portrait": "wren",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:prior:elian",
      "title": "Sister Ione",
      "subtitle": "The keeper",
      "text": {
        "cases": [
          {
            "when": {
              "op": "flag",
              "key": "confronted",
              "value": true
            },
            "text": "“Beneath the tower. I ordered the sentinels to keep him there. I thought he would see reason when the storm had passed.”"
          }
        ],
        "default": "“Elian is tending to the foundations. The work is delicate. I asked that he not be disturbed.”\n\nHer hand closes over the corner of the ledger."
      },
      "portrait": "prior",
      "choices": [
        {
          "label": "Other questions",
          "action": "talk:prior"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:prior:confront",
      "title": "Sister Ione",
      "subtitle": "The truth beneath the toll",
      "text": "“Yes. The bell takes memories. A winter. A face. A voice. I chose the smallest losses I could.”\n\n“Elian found a way to ask instead of take. It needed time. We had a storm.”\n\nFor the first time, her certainty fails. “He is alive. Beneath the tower.”",
      "portrait": "prior",
      "choices": [
        {
          "label": "Find Elian",
          "action": "close"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:prisoner:free",
      "title": "Elian",
      "subtitle": "The counter-melody",
      "text": "You loosen the silver threads. Elian sings three low notes, and the bell above answers. The stolen voices begin to separate.\n\n“Break the bell, and they are free. Or bring Wren, the proof of what was taken, and the willing tune. We can teach the ward to listen.”\n\n“The resonator nearby will calm the sentinels if you sing to it.”",
      "portrait": "prisoner",
      "choices": [
        {
          "label": "What does retuning require?",
          "action": "ending:locked"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:chest:take",
      "title": "A keeper’s precautions",
      "subtitle": "Ashwick · field notes",
      "text": "The spare key fits the bell tower service door. Elian’s note asks Wren to take it if he is late.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:herbs:gather",
      "title": "Silverleaf gathered",
      "subtitle": "Ashwick · field notes",
      "text": "You take the full-grown leaves and leave the new shoots. More silverleaf remains whenever you need it.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:herbs"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:herbs:full",
      "title": "Silverleaf gathered",
      "subtitle": "Ashwick · field notes",
      "text": "Your reagent pouch already holds six leaves. Leave these growing for later.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:herbs"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:oven:bake",
      "title": "A small, useful kindness",
      "subtitle": "Ashwick · field notes",
      "text": "Flour, water, and the oven’s heat become a warm loaf. Mara smiles without interrupting her work.\n\nToma waits by the quay. You can also eat bread from your satchel.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:oven"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:oven:full",
      "title": "Enough for now",
      "subtitle": "Ashwick · field notes",
      "text": "Your pack already holds eight loaves. Share or eat some before baking more.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:oven"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:baker:buy",
      "title": "Restorative draught",
      "subtitle": "Ashwick · field notes",
      "text": "Mara wraps the bottle in cloth. “Come back in one piece.”",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:baker"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:baker:poor",
      "title": "Not enough crowns",
      "subtitle": "Ashwick · field notes",
      "text": "A draught costs 6 crowns. Mara’s oven and the keeper’s resting bench are freely available.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:baker"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:night",
      "title": "Toma",
      "subtitle": "A memory just out of reach",
      "text": "“I signed something. Ione said it would protect the harbor. I cannot… it is all mixed up.”\n\nHe sways with exhaustion. Bread or a Mend spell might steady him. Reveal could trace the memory-salt on his token.",
      "portrait": "ferryman",
      "choices": [
        {
          "label": "Offer bread",
          "action": "ferryman:feed"
        },
        {
          "label": "Other questions",
          "action": "talk:ferryman"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:witness",
      "title": "Toma",
      "subtitle": "Evidence · A winter stolen",
      "text": "“Ione promised a winter without floods. She did not say it would cost the winter I spent with my wife.”\n\nHe presses the copper token into your palm. “I heard her singing inside the bell.”\n\nHe hums a little tune. “That part I give freely. If it can help someone, let it.”",
      "portrait": "ferryman",
      "choices": [
        {
          "label": "Other questions",
          "action": "talk:ferryman"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:no-bread",
      "title": "A warm meal",
      "subtitle": "Ashwick · field notes",
      "text": "You have no bread. Mara leaves flour at her oven; you can bake a fresh loaf for free.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:ferryman"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:no-mend",
      "title": "Mend needs focus and silverleaf",
      "subtitle": "Ashwick · field notes",
      "text": "You need 10 focus and one silverleaf. Drink at the well and gather in the garden; both are renewable.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:ferryman"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:no-reveal",
      "title": "The memory is hidden",
      "subtitle": "Ashwick · field notes",
      "text": "Cast Reveal, then speak to Toma again.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:ferryman"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:prior:unproven",
      "title": "Suspicion is not proof",
      "subtitle": "Ashwick · field notes",
      "text": "Find at least two pieces of evidence: Elian’s workbench, the Covenant ledger, or Toma’s account at the quay. You may still enter the tower without confronting Ione.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:prior"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:door:missing-key",
      "title": "A missing key",
      "subtitle": "Ashwick · field notes",
      "text": "Elian keeps a spare in the tool chest behind his supply crate. A lockpick or Unseal spell also works.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:door"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:door:missing-pick",
      "title": "No lockpick",
      "subtitle": "Ashwick · field notes",
      "text": "Find Elian’s spare key behind the supply crate, or use Unseal with 20 focus and one silverleaf.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:door"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:door:key",
      "title": "The way below",
      "subtitle": "Ashwick · field notes",
      "text": "The copper key turns. The service door opens.\n\nElian waits in the undercroft. The bell’s sentinels can be stilled at their resonator or overcome in combat.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:door:pick",
      "title": "The way below",
      "subtitle": "Ashwick · field notes",
      "text": "The lock yields as the pick bends. The service door opens.\n\nElian waits in the undercroft. The bell’s sentinels can be stilled at their resonator or overcome in combat.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:door:unseal",
      "title": "The way below",
      "subtitle": "Ashwick · field notes",
      "text": "Silver light slips between the pins. The service door opens.\n\nElian waits in the undercroft. The bell’s sentinels can be stilled at their resonator or overcome in combat.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:resonator:no-melody",
      "title": "An incomplete tune",
      "subtitle": "Ashwick · field notes",
      "text": "Elian knows the counter-melody. Find him beyond the service door. Unseal can also still the resonator.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:resonator"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:resonator:silenced",
      "title": "A borrowed heartbeat stops",
      "subtitle": "Ashwick · field notes",
      "text": "Light drains gently from the resonator. The ward sentinels lower their weapons. You may pass in peace.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:offering:donate",
      "title": "For those the tide left behind",
      "subtitle": "Ashwick · field notes",
      "text": "Three small coins ring against the bowl. No bell answers them.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:offering:donated",
      "title": "Your kindness remains",
      "subtitle": "Ashwick · field notes",
      "text": "You have already left a gift for the families. Mara will see it reaches them.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:offering"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:offering:poor",
      "title": "An empty purse",
      "subtitle": "Ashwick · field notes",
      "text": "You do not have three crowns to spare. A loaf for Toma helps just as much.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:offering"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:offering:warn",
      "title": "Take the relief money?",
      "subtitle": "Owned by the families of Ashwick",
      "text": {
        "cases": [
          {
            "when": {
              "op": "flag",
              "key": "companion",
              "value": true
            },
            "text": "Taking these twelve crowns will cost you the town’s trust. Wren watches you. “That is someone’s supper.”"
          }
        ],
        "default": "Taking these twelve crowns will cost you the town’s trust. The names of hungry families are written beneath the bowl."
      },
      "portrait": "offering",
      "choices": [
        {
          "label": "Leave it where it belongs",
          "action": "close"
        },
        {
          "label": "Take 12 crowns · trust −2",
          "action": "offering:steal"
        }
      ]
    },
    {
      "id": "ashwick:offering:steal",
      "title": "A lighter bowl",
      "subtitle": "Ashwick · field notes",
      "text": {
        "cases": [
          {
            "when": {
              "op": "flag",
              "key": "companion",
              "value": true
            },
            "text": "Wren says nothing for several steps. Then: “We can help people without taking from others who need help.”"
          }
        ],
        "default": "Twelve crowns weigh more in your pocket than you expected."
      },
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ending:locked",
      "title": "A willing harmony",
      "subtitle": "Ashwick · field notes",
      "text": {
        "cases": [
          {
            "when": {
              "op": "all",
              "conditions": [
                {
                  "op": "flag",
                  "key": "melody",
                  "value": true
                },
                {
                  "op": "party",
                  "member": "wren",
                  "mode": "follow"
                },
                {
                  "op": "questComplete",
                  "quest": "ashwick:investigation",
                  "group": "evidence"
                }
              ]
            },
            "text": "You have all {{clueTotal}} clues, Elian’s counter-melody, and Wren beside you. Return to the bell to choose its future."
          }
        ],
        "default": "{{retuneMissing}}"
      },
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:ending:shatter_confirm",
      "title": "Break the hollow bell?",
      "subtitle": "An ending for Ashwick",
      "text": "The stolen voices will be released and the extraction will end forever. Ashwick will face the next storm with its own hands and the people you have helped.\n\nThis completes the story.",
      "portrait": "bell",
      "choices": [
        {
          "label": "Shatter the bell",
          "action": "ending:shatter"
        },
        {
          "label": "Keep considering",
          "action": "talk:bell"
        }
      ]
    },
    {
      "id": "ashwick:ending:retune_confirm",
      "title": "Give the ward a willing voice?",
      "subtitle": "An ending for Ashwick",
      "text": "Wren begins Elian’s harmony. Toma’s tune answers it. The evidence will be made public; the ward will belong to the people it protects.\n\nThis completes the story.",
      "portrait": "bell",
      "choices": [
        {
          "label": "Retune the ward",
          "action": "ending:retune"
        },
        {
          "label": "Keep considering",
          "action": "talk:bell"
        }
      ]
    },
    {
      "id": "ashwick:item:note",
      "title": "Scorched tuning note",
      "subtitle": "Ashwick · field notes",
      "text": "“A memory freely offered is not consumed. Two willing voices can carry the ward. The old counter-melody releases what was taken.”",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:item:ledger",
      "title": "Covenant ledger",
      "subtitle": "Ashwick · field notes",
      "text": "Toma: a winter with Anwen. Lysa: her mother’s voice. Elian: consent withheld.\n\nThe ward’s hidden cost is written beside every name.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:item:token",
      "title": "Ferryman’s token",
      "subtitle": "Ashwick · field notes",
      "text": "Warm copper, worn by a thousand crossings. The memory of Anwen’s tune clings to it. Toma offered the tune freely.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:item:key",
      "title": "Tower key",
      "subtitle": "Ashwick · field notes",
      "text": "Use this at the bell tower service door.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:item:lockpick",
      "title": "Iron lockpick",
      "subtitle": "Ashwick · field notes",
      "text": "Use this at the bell tower service door.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:item:missing",
      "title": "Empty pocket",
      "subtitle": "Ashwick · field notes",
      "text": "You are not carrying that item.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:item:well",
      "title": "Already well",
      "subtitle": "Ashwick · field notes",
      "text": "Your vitality is full. Save this for the road ahead.",
      "portrait": "",
      "choices": [
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:oven:flour",
      "title": "Flour for the road",
      "subtitle": "Ashwick · field notes",
      "text": "You take a sack from Mara’s freely offered store. Use it in the oven or keep it for another recipe. Fresh sacks remain beside the water jug.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:oven"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:oven:flour-full",
      "title": "Leave some for others",
      "subtitle": "Ashwick · field notes",
      "text": "You already carry six sacks. Use some flour before taking more.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:oven"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:magic:failed",
      "title": "The seal holds",
      "subtitle": "Ashwick · field notes",
      "text": "{{lastMessage}} Drink at the well or rest by the hearth for focus. Silverleaf grows in the garden.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:door"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    },
    {
      "id": "ashwick:magic:resisted",
      "title": "The resonator resists",
      "subtitle": "Ashwick · field notes",
      "text": "{{lastMessage}} Drink at the well or rest by the hearth for focus. Silverleaf grows in the garden.",
      "portrait": "",
      "choices": [
        {
          "label": "Continue",
          "action": "talk:resonator"
        },
        {
          "label": "Leave",
          "action": "close"
        }
      ]
    }
  ],
  "actions": [
    {
      "id": "ashwick:wren:elian",
      "aliases": [
        "wren:elian"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "metWren",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "metWren",
              "value": true
            },
            {
              "op": "event",
              "message": "Wren asks you to find the missing bellkeeper.",
              "kind": "quest"
            }
          ]
        }
      ],
      "dialogue": "ashwick:wren:elian"
    },
    {
      "id": "ashwick:wren:bell",
      "aliases": [
        "wren:bell"
      ],
      "effects": [],
      "dialogue": "ashwick:wren:bell"
    },
    {
      "id": "ashwick:wren:join",
      "aliases": [
        "wren:join"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "companion",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "companion",
              "value": true
            },
            {
              "op": "flag",
              "key": "metWren",
              "value": true
            },
            {
              "op": "party",
              "member": "wren",
              "mode": "recruit"
            },
            {
              "op": "event",
              "message": "Wren joined you. Two voices can carry a harmony.",
              "kind": "companion"
            }
          ]
        }
      ],
      "dialogue": "ashwick:wren:join"
    },
    {
      "id": "ashwick:wren:hint",
      "aliases": [
        "wren:hint"
      ],
      "effects": [],
      "dialogue": "ashwick:wren:hint"
    },
    {
      "id": "ashwick:baker:toma",
      "aliases": [
        "baker:toma"
      ],
      "effects": [
        {
          "op": "flag",
          "key": "bakeryQuest",
          "value": true
        },
        {
          "op": "event",
          "message": "Mara asks you to bring Toma a warm loaf.",
          "kind": "quest"
        }
      ],
      "dialogue": "ashwick:baker:toma"
    },
    {
      "id": "ashwick:baker:baking",
      "aliases": [
        "baker:baking"
      ],
      "effects": [],
      "dialogue": "ashwick:baker:baking"
    },
    {
      "id": "ashwick:baker:elian",
      "aliases": [
        "baker:elian"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "cartRumor",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "cartRumor",
              "value": true
            },
            {
              "op": "event",
              "message": "Mara saw a Covenant cart take Elian toward the tower.",
              "kind": "story"
            }
          ]
        }
      ],
      "dialogue": "ashwick:baker:elian"
    },
    {
      "id": "ashwick:baker:buy",
      "aliases": [
        "baker:buy"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "stat",
              "key": "gold",
              "compare": "gte",
              "value": 6
            }
          },
          "dialogue": "ashwick:baker:poor"
        },
        {
          "when": true,
          "costs": {
            "gold": 6
          },
          "effects": [
            {
              "op": "item",
              "item": "tonic",
              "count": 1
            }
          ],
          "dialogue": "ashwick:baker:buy",
          "message": "Bought a restorative draught for 6 crowns.",
          "kind": "item"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:night",
      "aliases": [
        "ferryman:night"
      ],
      "branches": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "flag",
                "key": "clueWitness",
                "value": true
              },
              {
                "op": "flag",
                "key": "revealed",
                "value": true
              },
              {
                "op": "flag",
                "key": "ferrymanHelped",
                "value": true
              }
            ]
          },
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                },
                {
                  "op": "item",
                  "item": "token",
                  "count": 1
                },
                {
                  "op": "event",
                  "message": "Evidence found: Toma remembers the ward’s hidden price. · Evidence {{clues}}/{{clueTotal}}",
                  "kind": "evidence"
                }
              ]
            },
            {
              "op": "flag",
              "key": "willingTune",
              "value": true
            }
          ],
          "dialogue": "ashwick:ferryman:witness"
        },
        {
          "when": true,
          "dialogue": "ashwick:ferryman:night"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:feed",
      "aliases": [
        "ferryman:feed"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "ferrymanHelped",
            "value": true
          },
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                },
                {
                  "op": "item",
                  "item": "token",
                  "count": 1
                },
                {
                  "op": "event",
                  "message": "Evidence found: Toma remembers the ward’s hidden price. · Evidence {{clues}}/{{clueTotal}}",
                  "kind": "evidence"
                }
              ]
            },
            {
              "op": "flag",
              "key": "willingTune",
              "value": true
            }
          ],
          "dialogue": "ashwick:ferryman:witness"
        },
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "bread",
              "count": 1
            }
          },
          "dialogue": "ashwick:ferryman:no-bread"
        },
        {
          "when": true,
          "costs": {
            "items": {
              "bread": 1
            }
          },
          "effects": [
            {
              "op": "flag",
              "key": "ferrymanHelped",
              "value": true
            },
            {
              "op": "flag",
              "key": "ferrymanFed",
              "value": true
            },
            {
              "op": "reputation",
              "amount": 1
            },
            {
              "op": "event",
              "message": "You shared a warm loaf with Toma. Trust +1.",
              "kind": "kindness"
            },
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                },
                {
                  "op": "item",
                  "item": "token",
                  "count": 1
                },
                {
                  "op": "event",
                  "message": "Evidence found: Toma remembers the ward’s hidden price. · Evidence {{clues}}/{{clueTotal}}",
                  "kind": "evidence"
                }
              ]
            },
            {
              "op": "flag",
              "key": "willingTune",
              "value": true
            }
          ],
          "dialogue": "ashwick:ferryman:witness"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:mend",
      "aliases": [
        "ferryman:mend"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "ferrymanHelped",
            "value": true
          },
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                },
                {
                  "op": "item",
                  "item": "token",
                  "count": 1
                },
                {
                  "op": "event",
                  "message": "Evidence found: Toma remembers the ward’s hidden price. · Evidence {{clues}}/{{clueTotal}}",
                  "kind": "evidence"
                }
              ]
            },
            {
              "op": "flag",
              "key": "willingTune",
              "value": true
            }
          ],
          "dialogue": "ashwick:ferryman:witness"
        },
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "canPay",
              "costs": {
                "ability": "ashwick:mend"
              }
            }
          },
          "dialogue": "ashwick:ferryman:no-mend"
        },
        {
          "when": true,
          "costs": {
            "ability": "ashwick:mend"
          },
          "effects": [
            {
              "op": "flag",
              "key": "ferrymanHelped",
              "value": true
            },
            {
              "op": "flag",
              "key": "ferrymanMended",
              "value": true
            },
            {
              "op": "reputation",
              "amount": 1
            },
            {
              "op": "event",
              "message": "You steadied Toma with Mend. Trust +1.",
              "kind": "kindness"
            },
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                },
                {
                  "op": "item",
                  "item": "token",
                  "count": 1
                },
                {
                  "op": "event",
                  "message": "Evidence found: Toma remembers the ward’s hidden price. · Evidence {{clues}}/{{clueTotal}}",
                  "kind": "evidence"
                }
              ]
            },
            {
              "op": "flag",
              "key": "willingTune",
              "value": true
            }
          ],
          "dialogue": "ashwick:ferryman:witness"
        }
      ]
    },
    {
      "id": "ashwick:ferryman:reveal",
      "aliases": [
        "ferryman:reveal"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "revealed",
              "value": true
            }
          },
          "dialogue": "ashwick:ferryman:no-reveal"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "clueWitness",
                  "value": true
                },
                {
                  "op": "item",
                  "item": "token",
                  "count": 1
                },
                {
                  "op": "event",
                  "message": "Evidence found: Toma remembers the ward’s hidden price. · Evidence {{clues}}/{{clueTotal}}",
                  "kind": "evidence"
                }
              ]
            },
            {
              "op": "flag",
              "key": "willingTune",
              "value": true
            }
          ],
          "dialogue": "ashwick:ferryman:witness"
        }
      ]
    },
    {
      "id": "ashwick:prior:elian",
      "aliases": [
        "prior:elian"
      ],
      "effects": [],
      "dialogue": "ashwick:prior:elian"
    },
    {
      "id": "ashwick:prior:ward",
      "aliases": [
        "prior:ward"
      ],
      "effects": [],
      "dialogue": "ashwick:prior:ward"
    },
    {
      "id": "ashwick:prior:confront",
      "aliases": [
        "prior:confront"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "objectives",
              "quest": "ashwick:investigation",
              "group": "evidence",
              "min": 2
            }
          },
          "dialogue": "ashwick:prior:unproven"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "confronted",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "confronted",
                  "value": true
                },
                {
                  "op": "event",
                  "message": "Ione admits Elian is imprisoned beneath the tower.",
                  "kind": "quest"
                }
              ]
            }
          ],
          "dialogue": "ashwick:prior:confront"
        }
      ]
    },
    {
      "id": "ashwick:ledger:read",
      "aliases": [
        "ledger:read"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "clueLedger",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "clueLedger",
              "value": true
            },
            {
              "op": "item",
              "item": "ledger",
              "count": 1
            },
            {
              "op": "event",
              "message": "Evidence found: the ledger records stolen memories. · Evidence {{clues}}/{{clueTotal}}",
              "kind": "evidence"
            }
          ]
        }
      ],
      "dialogue": "ashwick:ledger:read"
    },
    {
      "id": "ashwick:workbench:read",
      "aliases": [
        "workbench:read"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "clueWorkshop",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "clueWorkshop",
              "value": true
            },
            {
              "op": "item",
              "item": "note",
              "count": 1
            },
            {
              "op": "event",
              "message": "Evidence found: Elian discovered a willing harmony. · Evidence {{clues}}/{{clueTotal}}",
              "kind": "evidence"
            }
          ]
        }
      ],
      "dialogue": "ashwick:workbench:read"
    },
    {
      "id": "ashwick:workbench:magic",
      "aliases": [
        "workbench:magic"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "learnedMagic",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "learnedMagic",
              "value": true
            },
            {
              "op": "event",
              "message": "Read Elian’s notes on small practical spells.",
              "kind": "story"
            }
          ]
        }
      ],
      "dialogue": "ashwick:workbench:magic"
    },
    {
      "id": "ashwick:crate:move",
      "aliases": [
        "crate:move"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "crateMoved",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "crateMoved",
              "value": true
            },
            {
              "op": "move",
              "target": "crate",
              "x": 232,
              "y": 223
            },
            {
              "op": "entity",
              "target": "crate",
              "key": "moved",
              "value": true
            },
            {
              "op": "event",
              "message": "The supply crate slides aside, revealing Elian’s tool chest.",
              "kind": "world"
            }
          ]
        }
      ],
      "dialogue": "ashwick:talk:chest"
    },
    {
      "id": "ashwick:chest:take",
      "aliases": [
        "chest:take"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "crateMoved",
              "value": true
            }
          },
          "dialogue": "ashwick:talk:chest"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "chestOpened",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "chestOpened",
                  "value": true
                },
                {
                  "op": "entity",
                  "target": "chest",
                  "key": "open",
                  "value": true
                },
                {
                  "op": "item",
                  "item": "key",
                  "count": 1
                },
                {
                  "op": "item",
                  "item": "tonic",
                  "count": 1
                },
                {
                  "op": "event",
                  "message": "Found the tower key and a restorative draught.",
                  "kind": "item"
                }
              ]
            }
          ],
          "dialogue": "ashwick:chest:take"
        }
      ]
    },
    {
      "id": "ashwick:herbs:gather",
      "aliases": [
        "herbs:gather"
      ],
      "branches": [
        {
          "when": {
            "op": "item",
            "item": "herb",
            "count": 6
          },
          "dialogue": "ashwick:herbs:full"
        },
        {
          "when": {
            "op": "item",
            "item": "herb",
            "count": 5
          },
          "effects": [
            {
              "op": "item",
              "item": "herb",
              "count": 1
            }
          ],
          "message": "Gathered 1 silverleaf.",
          "kind": "item",
          "dialogue": "ashwick:herbs:gather"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "item",
              "item": "herb",
              "count": 2
            }
          ],
          "message": "Gathered 2 silverleaf.",
          "kind": "item",
          "dialogue": "ashwick:herbs:gather"
        }
      ]
    },
    {
      "id": "ashwick:oven:flour",
      "aliases": [
        "oven:flour"
      ],
      "branches": [
        {
          "when": {
            "op": "item",
            "item": "flour",
            "count": 6
          },
          "dialogue": "ashwick:oven:flour-full"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "item",
              "item": "flour",
              "count": 1
            }
          ],
          "message": "Took one sack of freely offered flour.",
          "kind": "item",
          "dialogue": "ashwick:oven:flour"
        }
      ]
    },
    {
      "id": "ashwick:oven:bake",
      "aliases": [
        "oven:bake"
      ],
      "branches": [
        {
          "when": {
            "op": "item",
            "item": "bread",
            "count": 8
          },
          "dialogue": "ashwick:oven:full"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "item",
                  "item": "flour",
                  "count": 1
                }
              },
              "then": [
                {
                  "op": "item",
                  "item": "flour",
                  "count": 1
                }
              ]
            },
            {
              "op": "craft",
              "recipe": "ashwick:bread",
              "station": "oven"
            },
            {
              "op": "flag",
              "key": "breadCrafted",
              "value": true
            }
          ],
          "message": "Baked a warm loaf. Bread restores 25 vitality.",
          "kind": "craft",
          "dialogue": "ashwick:oven:bake"
        }
      ]
    },
    {
      "id": "ashwick:door:open",
      "aliases": [
        "door:open"
      ],
      "conditions": {
        "op": "entity",
        "target": "door",
        "key": "locked",
        "value": false,
        "reason": "Unlock the service gate first."
      },
      "effects": [
        {
          "op": "flag",
          "key": "doorOpen",
          "value": true
        },
        {
          "op": "entity",
          "target": "door",
          "key": "locked",
          "value": false
        },
        {
          "op": "entity",
          "target": "door",
          "key": "open",
          "value": true
        }
      ],
      "dialogue": "ashwick:door:key",
      "message": "The unlocked service gate swings open.",
      "kind": "world"
    },
    {
      "id": "ashwick:door:key",
      "aliases": [
        "door:key"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "doorOpen",
            "value": true
          },
          "dialogue": "ashwick:talk:door"
        },
        {
          "when": {
            "op": "entity",
            "target": "door",
            "key": "locked",
            "value": false
          },
          "effects": [
            {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            },
            {
              "op": "entity",
              "target": "door",
              "key": "locked",
              "value": false
            },
            {
              "op": "entity",
              "target": "door",
              "key": "open",
              "value": true
            }
          ],
          "dialogue": "ashwick:door:key",
          "message": "The unlocked service gate swings open.",
          "kind": "world"
        },
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "key",
              "count": 1
            }
          },
          "dialogue": "ashwick:door:missing-key"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            },
            {
              "op": "entity",
              "target": "door",
              "key": "locked",
              "value": false
            },
            {
              "op": "entity",
              "target": "door",
              "key": "open",
              "value": true
            }
          ],
          "dialogue": "ashwick:door:key",
          "message": "The copper key turns. The service door opens.",
          "kind": "world"
        }
      ]
    },
    {
      "id": "ashwick:door:pick",
      "aliases": [
        "door:pick"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "doorOpen",
            "value": true
          },
          "dialogue": "ashwick:talk:door"
        },
        {
          "when": {
            "op": "entity",
            "target": "door",
            "key": "locked",
            "value": false
          },
          "effects": [
            {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            },
            {
              "op": "entity",
              "target": "door",
              "key": "locked",
              "value": false
            },
            {
              "op": "entity",
              "target": "door",
              "key": "open",
              "value": true
            }
          ],
          "dialogue": "ashwick:door:key",
          "message": "The unlocked service gate swings open.",
          "kind": "world"
        },
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "lockpick",
              "count": 1
            }
          },
          "dialogue": "ashwick:door:missing-pick"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            },
            {
              "op": "entity",
              "target": "door",
              "key": "locked",
              "value": false
            },
            {
              "op": "entity",
              "target": "door",
              "key": "open",
              "value": true
            }
          ],
          "dialogue": "ashwick:door:pick",
          "message": "The lock yields as the pick bends. The service door opens.",
          "kind": "world",
          "costs": {
            "items": {
              "lockpick": 1
            }
          }
        }
      ]
    },
    {
      "id": "ashwick:door:unseal",
      "aliases": [
        "door:unseal"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "doorOpen",
            "value": true
          },
          "dialogue": "ashwick:talk:door"
        },
        {
          "when": {
            "op": "entity",
            "target": "door",
            "key": "locked",
            "value": false
          },
          "effects": [
            {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            },
            {
              "op": "entity",
              "target": "door",
              "key": "locked",
              "value": false
            },
            {
              "op": "entity",
              "target": "door",
              "key": "open",
              "value": true
            }
          ],
          "dialogue": "ashwick:door:key",
          "message": "The unlocked service gate swings open.",
          "kind": "world"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            },
            {
              "op": "entity",
              "target": "door",
              "key": "locked",
              "value": false
            },
            {
              "op": "entity",
              "target": "door",
              "key": "open",
              "value": true
            }
          ],
          "dialogue": "ashwick:door:unseal",
          "message": "Silver light slips between the pins. The service door opens.",
          "kind": "world",
          "costs": {
            "ability": "ashwick:unseal"
          },
          "failure": "ashwick:magic:failed"
        }
      ]
    },
    {
      "id": "ashwick:prisoner:free",
      "aliases": [
        "prisoner:free"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "doorOpen",
              "value": true
            }
          },
          "dialogue": "ashwick:talk:prisoner"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "melody",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "melody",
                  "value": true
                },
                {
                  "op": "flag",
                  "key": "rescued",
                  "value": true
                },
                {
                  "op": "event",
                  "message": "Elian is free. You learned the counter-melody.",
                  "kind": "quest"
                }
              ]
            }
          ],
          "dialogue": "ashwick:prisoner:free"
        }
      ]
    },
    {
      "id": "ashwick:prisoner:sentinels",
      "aliases": [
        "prisoner:sentinels"
      ],
      "effects": [],
      "dialogue": "ashwick:prisoner:sentinels"
    },
    {
      "id": "ashwick:resonator:sing",
      "aliases": [
        "resonator:sing"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "melody",
              "value": true
            }
          },
          "dialogue": "ashwick:resonator:no-melody"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "resonatorOff",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "resonatorOff",
                  "value": true
                },
                {
                  "op": "entity",
                  "target": "resonator",
                  "key": "active",
                  "value": false
                },
                {
                  "op": "event",
                  "message": "The resonator falls quiet. The ward sentinels are pacified.",
                  "kind": "world"
                }
              ]
            }
          ],
          "dialogue": "ashwick:resonator:silenced"
        }
      ]
    },
    {
      "id": "ashwick:resonator:unseal",
      "aliases": [
        "resonator:unseal"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "resonatorOff",
            "value": true
          },
          "dialogue": "ashwick:talk:resonator"
        },
        {
          "when": true,
          "costs": {
            "ability": "ashwick:unseal"
          },
          "effects": [
            {
              "op": "when",
              "condition": {
                "op": "not",
                "condition": {
                  "op": "flag",
                  "key": "resonatorOff",
                  "value": true
                }
              },
              "then": [
                {
                  "op": "flag",
                  "key": "resonatorOff",
                  "value": true
                },
                {
                  "op": "entity",
                  "target": "resonator",
                  "key": "active",
                  "value": false
                },
                {
                  "op": "event",
                  "message": "The resonator falls quiet. The ward sentinels are pacified.",
                  "kind": "world"
                }
              ]
            }
          ],
          "dialogue": "ashwick:resonator:silenced",
          "failure": "ashwick:magic:resisted"
        }
      ]
    },
    {
      "id": "ashwick:bed:rest",
      "aliases": [
        "bed:rest"
      ],
      "effects": [
        {
          "op": "setStat",
          "key": "hp",
          "value": 100
        },
        {
          "op": "setStat",
          "key": "mana",
          "value": 60
        },
        {
          "op": "flag",
          "key": "rested",
          "value": true
        }
      ],
      "dialogue": "ashwick:bed:rest",
      "message": "Rested by the hearth. Vitality and focus restored.",
      "kind": "heal"
    },
    {
      "id": "ashwick:well:drink",
      "aliases": [
        "well:drink"
      ],
      "effects": [
        {
          "op": "setStat",
          "key": "mana",
          "value": 60
        }
      ],
      "dialogue": "ashwick:well:drink",
      "message": "Cold well water restores your focus.",
      "kind": "heal"
    },
    {
      "id": "ashwick:offering:donate",
      "aliases": [
        "offering:donate"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "donated",
            "value": true
          },
          "dialogue": "ashwick:offering:donated"
        },
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "stat",
              "key": "gold",
              "compare": "gte",
              "value": 3
            }
          },
          "dialogue": "ashwick:offering:poor"
        },
        {
          "when": true,
          "costs": {
            "gold": 3
          },
          "effects": [
            {
              "op": "reputation",
              "amount": 1
            },
            {
              "op": "flag",
              "key": "donated",
              "value": true
            }
          ],
          "message": "You left three crowns for the flood victims. Trust +1.",
          "kind": "kindness",
          "dialogue": "ashwick:offering:donate"
        }
      ]
    },
    {
      "id": "ashwick:offering:warn",
      "aliases": [
        "offering:warn"
      ],
      "branches": [
        {
          "when": {
            "op": "flag",
            "key": "offeringTaken",
            "value": true
          },
          "dialogue": "ashwick:talk:offering"
        },
        {
          "when": true,
          "dialogue": "ashwick:offering:warn"
        }
      ]
    },
    {
      "id": "ashwick:offering:steal",
      "aliases": [
        "offering:steal"
      ],
      "effects": [
        {
          "op": "when",
          "condition": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "offeringTaken",
              "value": true
            }
          },
          "then": [
            {
              "op": "flag",
              "key": "offeringTaken",
              "value": true
            },
            {
              "op": "gold",
              "amount": 12
            },
            {
              "op": "reputation",
              "amount": -2
            },
            {
              "op": "when",
              "condition": {
                "op": "flag",
                "key": "companion",
                "value": true
              },
              "then": [
                {
                  "op": "event",
                  "message": "You took the relief money. Wren objects. Trust −2.",
                  "kind": "theft"
                }
              ],
              "else": [
                {
                  "op": "event",
                  "message": "You took the relief money. Ashwick will remember. Trust −2.",
                  "kind": "theft"
                }
              ]
            }
          ]
        }
      ],
      "dialogue": "ashwick:offering:steal"
    },
    {
      "id": "ashwick:bell:listen",
      "aliases": [
        "bell:listen"
      ],
      "effects": [],
      "dialogue": "ashwick:bell:listen"
    },
    {
      "id": "ashwick:ending:locked",
      "aliases": [
        "ending:locked"
      ],
      "effects": [],
      "dialogue": "ashwick:ending:locked"
    },
    {
      "id": "ashwick:ending:shatter_confirm",
      "aliases": [
        "ending:shatter_confirm"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "flag",
              "key": "melody",
              "value": true
            }
          },
          "dialogue": "ashwick:talk:bell"
        },
        {
          "when": true,
          "dialogue": "ashwick:ending:shatter_confirm"
        }
      ]
    },
    {
      "id": "ashwick:ending:retune_confirm",
      "aliases": [
        "ending:retune_confirm"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "flag",
                  "key": "melody",
                  "value": true
                },
                {
                  "op": "party",
                  "member": "wren",
                  "mode": "follow"
                },
                {
                  "op": "questComplete",
                  "quest": "ashwick:investigation",
                  "group": "evidence"
                }
              ]
            }
          },
          "dialogue": "ashwick:ending:locked"
        },
        {
          "when": true,
          "dialogue": "ashwick:ending:retune_confirm"
        }
      ]
    },
    {
      "id": "ashwick:ending:shatter",
      "aliases": [
        "ending:shatter"
      ],
      "branches": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "dialogue": "ashwick:ending"
        },
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "flag",
                  "key": "melody",
                  "value": true
                },
                {
                  "op": "flag",
                  "key": "doorOpen",
                  "value": true
                }
              ]
            }
          },
          "dialogue": "ashwick:talk:bell"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "ending",
              "value": "shatter"
            },
            {
              "op": "flag",
              "key": "resonatorOff",
              "value": true
            },
            {
              "op": "flag",
              "key": "rescued",
              "value": true
            }
          ],
          "message": "The last toll · Ashwick’s stolen voices are free.",
          "kind": "ending",
          "dialogue": "ashwick:ending"
        }
      ]
    },
    {
      "id": "ashwick:ending:retune",
      "aliases": [
        "ending:retune"
      ],
      "branches": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "dialogue": "ashwick:ending"
        },
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "all",
              "conditions": [
                {
                  "op": "all",
                  "conditions": [
                    {
                      "op": "flag",
                      "key": "melody",
                      "value": true
                    },
                    {
                      "op": "party",
                      "member": "wren",
                      "mode": "follow"
                    },
                    {
                      "op": "questComplete",
                      "quest": "ashwick:investigation",
                      "group": "evidence"
                    }
                  ]
                },
                {
                  "op": "flag",
                  "key": "doorOpen",
                  "value": true
                }
              ]
            }
          },
          "dialogue": "ashwick:ending:locked"
        },
        {
          "when": true,
          "effects": [
            {
              "op": "ending",
              "value": "retune"
            },
            {
              "op": "flag",
              "key": "resonatorOff",
              "value": true
            },
            {
              "op": "flag",
              "key": "rescued",
              "value": true
            }
          ],
          "message": "A willing chorus · Ashwick’s ward is renewed.",
          "kind": "ending",
          "dialogue": "ashwick:ending"
        }
      ]
    },
    {
      "id": "ashwick:item:bread",
      "aliases": [
        "item:bread"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "bread",
              "count": 1
            }
          },
          "dialogue": "ashwick:item:missing"
        },
        {
          "when": {
            "op": "stat",
            "key": "hp",
            "compare": "gte",
            "value": 100
          },
          "dialogue": "ashwick:item:well"
        },
        {
          "when": true,
          "costs": {
            "items": {
              "bread": 1
            }
          },
          "effects": [
            {
              "op": "heal",
              "target": "player",
              "amount": 25
            }
          ],
          "message": "Ate hearth bread. Vitality restored.",
          "kind": "heal"
        }
      ]
    },
    {
      "id": "ashwick:item:tonic",
      "aliases": [
        "item:tonic"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "tonic",
              "count": 1
            }
          },
          "dialogue": "ashwick:item:missing"
        },
        {
          "when": {
            "op": "stat",
            "key": "hp",
            "compare": "gte",
            "value": 100
          },
          "dialogue": "ashwick:item:well"
        },
        {
          "when": true,
          "costs": {
            "items": {
              "tonic": 1
            }
          },
          "effects": [
            {
              "op": "heal",
              "target": "player",
              "amount": 50
            }
          ],
          "message": "Drank a restorative draught. Vitality restored.",
          "kind": "heal"
        }
      ]
    },
    {
      "id": "ashwick:item:note",
      "aliases": [
        "item:note"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "note",
              "count": 1
            }
          },
          "dialogue": "ashwick:item:missing"
        },
        {
          "when": true,
          "dialogue": "ashwick:item:note"
        }
      ]
    },
    {
      "id": "ashwick:item:ledger",
      "aliases": [
        "item:ledger"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "ledger",
              "count": 1
            }
          },
          "dialogue": "ashwick:item:missing"
        },
        {
          "when": true,
          "dialogue": "ashwick:item:ledger"
        }
      ]
    },
    {
      "id": "ashwick:item:token",
      "aliases": [
        "item:token"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "token",
              "count": 1
            }
          },
          "dialogue": "ashwick:item:missing"
        },
        {
          "when": true,
          "dialogue": "ashwick:item:token"
        }
      ]
    },
    {
      "id": "ashwick:item:key",
      "aliases": [
        "item:key"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "key",
              "count": 1
            }
          },
          "dialogue": "ashwick:item:missing"
        },
        {
          "when": true,
          "dialogue": "ashwick:item:key"
        }
      ]
    },
    {
      "id": "ashwick:item:lockpick",
      "aliases": [
        "item:lockpick"
      ],
      "branches": [
        {
          "when": {
            "op": "not",
            "condition": {
              "op": "item",
              "item": "lockpick",
              "count": 1
            }
          },
          "dialogue": "ashwick:item:missing"
        },
        {
          "when": true,
          "dialogue": "ashwick:item:lockpick"
        }
      ]
    }
  ],
  "quests": [
    {
      "id": "ashwick:investigation",
      "title": "The Hollow Bell",
      "initialState": "investigating",
      "states": [
        "investigating",
        "resolved"
      ],
      "completionCondition": {
        "op": "any",
        "conditions": [
          {
            "op": "state",
            "key": "ending",
            "compare": "eq",
            "value": "retune"
          },
          {
            "op": "state",
            "key": "ending",
            "compare": "eq",
            "value": "shatter"
          }
        ]
      },
      "completionEffects": [
        {
          "op": "quest",
          "quest": "ashwick:investigation",
          "state": "resolved"
        }
      ],
      "failurePolicy": "No irreversible failure; the key, food, silverleaf, well and rest are renewable recovery routes. Either ending completes the story.",
      "objectives": [
        {
          "id": "rescue",
          "title": "The missing bellkeeper",
          "condition": {
            "op": "flag",
            "key": "rescued",
            "value": true
          },
          "text": "Wren’s teacher Elian vanished after questioning the tide ward. Find him below the bell tower.",
          "completedText": "Elian is free. Ione confined him when he refused to feed the ward."
        },
        {
          "id": "workshop",
          "group": "evidence",
          "title": "A scorched possibility",
          "condition": {
            "op": "flag",
            "key": "clueWorkshop",
            "value": true
          },
          "text": "Search the workbench in Elian’s workshop.",
          "completedText": "Elian’s tuning note proves willing memories can power the ward without being consumed.",
          "missingText": "Read the tuning note on Elian’s workbench."
        },
        {
          "id": "ledger",
          "group": "evidence",
          "title": "The price of the ward",
          "condition": {
            "op": "flag",
            "key": "clueLedger",
            "value": true
          },
          "text": "Read the ledger in the Covenant hall.",
          "completedText": "Ione’s ledger records the memories taken from residents without their permission.",
          "missingText": "Read the Covenant ledger in the hall."
        },
        {
          "id": "witness",
          "group": "evidence",
          "title": "What the ferryman lost",
          "condition": {
            "op": "flag",
            "key": "clueWitness",
            "value": true
          },
          "text": "Toma waits at the quay. Offer bread, Mend his exhaustion, or Reveal the memory on his token.",
          "completedText": "Toma lost a winter with his wife. He freely offered her tune, and the truth of what happened.",
          "missingText": "Help Toma at the quay and learn what the bell took."
        },
        {
          "id": "kindness",
          "title": "Bread on the water",
          "required": false,
          "condition": {
            "op": "flag",
            "key": "ferrymanHelped",
            "value": true
          },
          "text": "Optional: bake bread at Mara’s oven and share it with Toma. Mend also helps.",
          "completedText": "You helped Toma recover his strength. Mara’s kindness reached the quay."
        },
        {
          "id": "entrance",
          "title": "A way beneath",
          "condition": {
            "op": "flag",
            "key": "doorOpen",
            "value": true
          },
          "text": "Move the workshop crate to reach the spare key. A lockpick or Unseal spell also opens the door.",
          "completedText": "The tower service door is open."
        },
        {
          "id": "future",
          "title": "The bell’s future",
          "condition": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "text": "Learn Elian’s melody. Shattering the bell is always possible; retuning needs Wren and all {{clueTotal}} clues.",
          "completedText": {
            "cases": [
              {
                "when": {
                  "op": "state",
                  "key": "ending",
                  "compare": "eq",
                  "value": "retune"
                },
                "text": "A willing chorus keeps Ashwick safe. The ledger belongs to the town."
              }
            ],
            "default": "The bell is broken and the stolen voices are free. Ashwick prepares together."
          }
        }
      ],
      "requirements": [
        {
          "condition": {
            "op": "flag",
            "key": "melody",
            "value": true
          },
          "missingText": "Learn Elian’s counter-melody beneath the tower."
        },
        {
          "condition": {
            "op": "party",
            "member": "wren",
            "mode": "follow"
          },
          "missingText": "Ask Wren to accompany you; the harmony needs two voices."
        }
      ],
      "objectiveVariants": [
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "retune"
              },
              {
                "op": "state",
                "key": "ending",
                "compare": "eq",
                "value": "shatter"
              }
            ]
          },
          "text": {
            "cases": [
              {
                "when": {
                  "op": "state",
                  "key": "ending",
                  "compare": "eq",
                  "value": "retune"
                },
                "text": "Story complete · A willing chorus. Explore Ashwick or begin again."
              }
            ],
            "default": "Story complete · The last toll. Explore Ashwick or begin again."
          }
        },
        {
          "when": {
            "op": "flag",
            "key": "melody",
            "value": true
          },
          "text": "Return to the Hollow Bell. Shatter it, or gather all {{clueTotal}} clues and Wren to retune the ward."
        },
        {
          "when": {
            "op": "flag",
            "key": "doorOpen",
            "value": true
          },
          "text": "Find Elian in the tower undercroft. The resonator can pacify its sentinels."
        },
        {
          "when": {
            "op": "objectives",
            "quest": "ashwick:investigation",
            "group": "evidence",
            "min": 2
          },
          "text": "Open the tower service door: spare key, lockpick, or Unseal. Ione can answer your evidence."
        },
        {
          "when": {
            "op": "any",
            "conditions": [
              {
                "op": "flag",
                "key": "companion",
                "value": true
              },
              {
                "op": "flag",
                "key": "metWren",
                "value": true
              },
              {
                "op": "objectives",
                "quest": "ashwick:investigation",
                "group": "evidence",
                "min": 1
              }
            ]
          },
          "text": "Investigate Elian’s workshop, the Covenant ledger, and Toma at the quay."
        },
        {
          "when": true,
          "text": "Speak with Wren near the bell square. Ashwick’s bellkeeper is missing."
        }
      ]
    }
  ],
  "recipes": [
    {
      "id": "ashwick:bread",
      "name": "Hearth bread",
      "description": "One sack of flour, well water and a hot oven.",
      "ingredients": {
        "flour": 1
      },
      "outputs": {
        "bread": 1
      },
      "station": "ashwick:oven"
    }
  ],
  "vendors": [
    {
      "id": "ashwick:mara",
      "name": "Mara’s remedies",
      "entity": "baker",
      "stock": {
        "tonic": {
          "count": 8,
          "price": 6,
          "sellPrice": 3
        },
        "flour": {
          "count": 6,
          "price": 1,
          "sellPrice": 0
        }
      },
      "restockSeconds": 240,
      "buyback": true
    }
  ],
  "abilities": [
    {
      "id": "ashwick:reveal",
      "aliases": [
        "reveal"
      ],
      "name": "Revelation",
      "description": "Trace hidden memory-salt and evidence.",
      "target": "self",
      "requiresLearned": false,
      "costs": {
        "mana": 12,
        "items": {
          "herb": 1
        }
      },
      "conditions": {
        "op": "canPay",
        "costs": {
          "ability": "ashwick:reveal"
        },
        "reason": "Not enough focus or silverleaf. Drink at the well or rest by the hearth, and gather silverleaf in the garden."
      },
      "effects": [
        {
          "op": "flag",
          "key": "revealed",
          "value": true
        },
        {
          "op": "event",
          "message": "Reveal wakes the memory-salt. Ask Toma about the revealed memory.",
          "kind": "magic"
        }
      ],
      "animation": "cast",
      "sfx": "powerup",
      "contextualOnly": false
    },
    {
      "id": "ashwick:mend",
      "aliases": [
        "mend"
      ],
      "name": "Mend",
      "description": "Restore 35 vitality.",
      "target": "self",
      "requiresLearned": false,
      "costs": {
        "mana": 10,
        "items": {
          "herb": 1
        }
      },
      "conditions": {
        "op": "canPay",
        "costs": {
          "ability": "ashwick:mend"
        },
        "reason": "Not enough focus or silverleaf. Drink at the well or rest by the hearth, and gather silverleaf in the garden."
      },
      "effects": [
        {
          "op": "heal",
          "target": "player",
          "amount": 35
        },
        {
          "op": "event",
          "message": "Mend restores 35 vitality.",
          "kind": "magic"
        }
      ],
      "animation": "cast",
      "sfx": "powerup",
      "contextualOnly": false
    },
    {
      "id": "ashwick:ward",
      "aliases": [
        "ward"
      ],
      "name": "Stillness",
      "description": "Pacify hostile wardens for twenty seconds.",
      "target": "self",
      "requiresLearned": false,
      "costs": {
        "mana": 16,
        "items": {
          "herb": 1
        }
      },
      "conditions": {
        "op": "canPay",
        "costs": {
          "ability": "ashwick:ward"
        },
        "reason": "Not enough focus or silverleaf. Drink at the well or rest by the hearth, and gather silverleaf in the garden."
      },
      "effects": [
        {
          "op": "flag",
          "key": "wardUntil",
          "timeOffset": 20
        },
        {
          "op": "flag",
          "key": "wardActive",
          "value": true
        },
        {
          "op": "status",
          "status": "ashwick:stillness",
          "target": "player",
          "duration": 20
        },
        {
          "op": "event",
          "message": "A ward surrounds you for 20 seconds.",
          "kind": "magic"
        }
      ],
      "animation": "cast",
      "sfx": "powerup",
      "contextualOnly": false
    },
    {
      "id": "ashwick:unseal",
      "aliases": [
        "unseal"
      ],
      "name": "Unseal",
      "description": "Unravel a listening seal through its contextual interaction.",
      "target": "self",
      "requiresLearned": false,
      "costs": {
        "mana": 20,
        "items": {
          "herb": 1
        }
      },
      "conditions": {
        "op": "canPay",
        "costs": {
          "ability": "ashwick:unseal"
        },
        "reason": "Not enough focus or silverleaf. Drink at the well or rest by the hearth, and gather silverleaf in the garden."
      },
      "effects": [
        {
          "op": "event",
          "message": "The listening seal yields.",
          "kind": "magic"
        }
      ],
      "animation": "cast",
      "sfx": "powerup",
      "contextualOnly": true
    }
  ],
  "statuses": [
    {
      "id": "ashwick:stillness",
      "name": "Stillness",
      "duration": 20,
      "stacking": "refresh",
      "modifiers": {
        "pacifies": true
      }
    }
  ],
  "encounters": []
};
  const world = root.HBASHWICK_WORLD;
  if (!world) throw new Error('Load content/ashwick/world-data.js before Ashwick pack.js');
  for (const kind of ['regions', 'prefabs', 'actors', 'assets']) pack[kind] = world[kind] || [];
  (root.HBPacks ||= []).push(pack);
})(globalThis);

/* SOURCE: content/ashwick/village-life.records.js */
/* Small promises: five linked quests and the playable North Breakwater.
 * Helpers below only build records. All play state uses the shared runtime. */
(() => {
  'use strict';
  const ashwick = HBPacks.find(pack => pack.id === 'ashwick');
  const F = (key, value = true) => ({op: 'flag', key: `shore:${key}`, value});
  const flag = (key, value = true) => ({op: 'flag', key: `shore:${key}`, value});
  const not = condition => ({op: 'not', condition});
  const all = (...conditions) => ({op: 'all', conditions});
  const any = (...conditions) => ({op: 'any', conditions});
  const has = (item, count = 1) => ({op: 'item', item, count});
  const ended = {op: 'state', key: 'ending', compare: 'ne', value: null};
  const following = {op: 'party', member: 'wren', mode: 'follow', reason: 'Ask Wren to follow you. Bring them to this conversation.'};
  const give = (item, count = 1) => ({op: 'item', item, count});
  const xp = amount => ({op: 'xp', amount});
  const leave = {label: 'Leave', action: 'close'};
  const choice = (label, action, conditions, when) => ({label, action: `shore:${action}`, ...(conditions ? {conditions} : {}), ...(when ? {when} : {})});
  const back = (label, action) => ({label, action});
  const pack = {
    items: [], prefabs: [], actors: [], regions: [], dialogues: [], actions: [], quests: [], recipes: [], statuses: [], abilities: [], assets: [], encounters: [], placements: []
  };
  const dialogue = (id, title, text, choices = [leave], extra = {}) => pack.dialogues.push({id: `shore:${id}`, title, subtitle: 'Small promises', text, choices, ...extra});
  const action = (id, target, effects, dialogueId, extra = {}) => pack.actions.push({id: `shore:${id}`, target, effects, ...(dialogueId ? {dialogue: `shore:${dialogueId}`} : {}), ...extra});
  const object = (id, name, text, node, visual = 'sign', extra = {}) => pack.prefabs.push({
    id: `shore:${id}`, name, description: text, dialogue: `shore:${node}`, range: 38,
    verbs: ['inspect'], visual: {kind: 'prop', name: visual}, ...extra
  });
  const objective = (id, title, condition, text, completedText, extra = {}) => ({id, title, condition, text, completedText, ...extra});
  const quest = (id, title, started, done, objectives, rewards, extra = {}) => pack.quests.push({
    id: `shore:${id}`, title, initialState: 'active', states: ['active', 'complete'],
    visibleWhen: F(started), completionCondition: F(done), completionEffects: rewards,
    completedText: `${title} is complete. Your choice remains part of village life.`,
    objectives, failurePolicy: 'No timed failure. Supplies can be gathered again. Rewards are granted once.', ...extra
  });

  pack.items.push(
    {id: 'shore:rope', name: 'Dry cord', description: 'Clean cord from the breakwater supply rack. Gather more whenever you need it.', icon: 'bag', weight: 1},
    {id: 'shore:glass', name: 'Stormglass', description: 'Sea-polished glass. Two pieces and one dry cord make a signal lens at the repair bench.', icon: 'search', weight: 1},
    {id: 'shore:lens', name: 'Bound signal lens', description: 'Fit this lens to the north signal lamp after the salvage warden is safe.', icon: 'search', weight: 0, protected: true},
    {id: 'shore:broth', name: 'Silverleaf broth', description: 'One hearth bread and one silverleaf, warmed at Mara’s oven. Restores 32 vitality.', icon: 'potion', weight: 1, use: {consume: true, effects: [{op: 'heal', target: '$actor', amount: 32}]}},
    {id: 'shore:reed', name: 'Bellmaker’s reed', description: 'A spare brass reed. Wren can make it into a small instrument without taking a memory.', icon: 'key', weight: 0, protected: true},
    {id: 'shore:apron', name: 'Mara’s work apron', description: 'A thick apron from the bakery. Armor +2 when equipped in the body slot.', weight: 1, stackable: false, equipment: {slot: 'body', modifiers: {armor: 2}}},
    {id: 'shore:knot', name: 'Three-name knot', description: 'Three threads for three remembered workers. Maximum focus +6 when equipped as a charm.', weight: 1, stackable: false, equipment: {slot: 'charm', modifiers: {maxMana: 6}}},
    {id: 'shore:coat', name: 'Breakwater coat', description: 'A repaired oilskin coat. Armor +4 when equipped in the body slot. It replaces other body equipment.', weight: 2, stackable: false, equipment: {slot: 'body', modifiers: {armor: 4}}}
  );
  pack.recipes.push(
    {id: 'shore:broth-recipe', name: 'Silverleaf broth', description: 'Warm bread and silverleaf at Mara’s oven. Both ingredients are renewable.', station: 'ashwick:oven', ingredients: {'ashwick:bread': 1, 'ashwick:herb': 1}, outputs: {'shore:broth': 1}},
    {id: 'shore:lens-recipe', name: 'Bind a signal lens', description: 'Use the breakwater repair bench. The beach and rack provide replacement materials.', station: 'shore:bench', ingredients: {'shore:glass': 2, 'shore:rope': 1}, outputs: {'shore:lens': 1}, conditions: all(not(F('lampDone')), not(has('shore:lens')))}
  );
  pack.statuses.push({id: 'shore:sheltered', name: 'Shelter song', description: 'Armor +3 for 25 seconds. Repeating the song refreshes its duration; it does not stack.', duration: 25, stacking: 'refresh', modifiers: {armor: 3}});
  pack.abilities.push({id: 'shore:shelter-song', name: 'Shelter song', description: 'Learn Wren’s small song. Spend 12 focus to gain 3 armor for 25 seconds. Repeating it refreshes the effect.', target: 'self', requiresLearned: true, costs: {mana: 12}, effects: [{op: 'status', status: 'shore:sheltered', target: '$actor'}], animation: 'cast', sfx: 'powerup'});

  // Village entry points appear in every conversation variant, including endings.
  function addTopic(id, topic) {
    const node = ashwick.dialogues.find(node => node.id === id);
    for (const branch of [node, ...(node.variants || [])]) {
      if (!branch.choices) continue;
      branch.choices.splice(Math.max(0, branch.choices.length - 1), 0, structuredClone(topic));
    }
  }
  addTopic('ashwick:talk:baker', choice('Village work · A table for everyone', 'meals-talk'));
  addTopic('ashwick:talk:ferryman', choice('North Breakwater · The unlit shore', 'toma-talk'));
  addTopic('ashwick:talk:prior', choice('The flood workers · Names and repairs', 'ione-talk'));
  addTopic('ashwick:talk:wren', choice('Your own music · A small promise', 'wren-talk'));
  addTopic('ashwick:talk:oven', choice('Cook silverleaf broth · 1 bread + 1 silverleaf', 'cook-broth'));
  action('cook-broth', 'oven', [{op: 'craft', recipe: 'shore:broth-recipe', station: 'oven'}], 'cooked-broth');
  dialogue('cooked-broth', 'A warm bowl', 'One bread and one silverleaf make a bowl of broth. Carry it to Rill at the breakwater, save it for the repair shift, or drink it to restore 32 vitality.', [back('Return to the oven', 'talk:oven'), leave]);
  addTopic('ashwick:talk:workbench', choice('Fit Wren’s reed · 1 dry cord', 'fit-reed', all(F('wrenStarted'), has('shore:reed'), has('shore:rope'), not(F('reedFitted')))));
  ashwick.regions[0].spawns.breakwaterRoad = {x: 488, y: 568};
  ashwick.regions[0].exits ||= [];
  ashwick.regions[0].exits.push({id: 'shore:outbound', entity: 'shore:quay-post', targetRegion: 'shore:breakwater', spawn: 'arrival'});
  pack.placements.push({id: 'shore:quay-post', definition: 'shore:quay-post', regionId: 'ashwick:village', x: 488, y: 552});
  object('quay-post', 'North Breakwater and village notices', 'The north signal is dark. A chalk list asks for meals, repairs, and the names of the flood workers.', 'notice');
  dialogue('notice', 'Small promises', {
    join: ['The north signal lamp is dark. Rill waits beyond the quay road. Mara needs a meal carried to the watch.',
      {cases: [{when: F('lampDone'), text: 'The north lamp is lit. Boats can read the channel again.'}], default: ''},
      {cases: [{when: F('namesPublic'), text: 'SAEL · EDDA · BRIN. Their names are now on the public board.'}, {when: F('namesLetters'), text: 'Three letters have reached the workers’ families. The public board records the work, not their private words.'}], default: ''},
      {cases: [{when: F('rebuildDone'), text: 'The repair rota has food, cord, and a named watch. No one must offer a memory to take part.'}, {when: ended, text: 'The bell’s choice is made. There is still ordinary work to do.'}], default: ''}], separator: '\n\n'
  }, [choice('Take the north road', 'travel'), choice('Read the village repair rota', 'rebuild-talk', undefined, ended), leave]);
  action('travel', 'shore:quay-post', [flag('visited'), flag('lampStarted'), {op: 'travel', region: 'shore:breakwater', spawn: 'arrival'}]);

  // 1. A table for everyone: old kindness counts; the new delivery is distinct.
  action('meals-talk', 'baker', [flag('mealsStarted')], 'meals');
  dialogue('meals', 'Mara · A table for everyone', {
    cases: [{when: F('mealsDone'), text: '“Rill sent back an empty bowl. That is the answer a cook likes. Keep the apron. The oven is yours to use.”'},
      {when: F('mealDelivered'), text: '“You reached the watch? Good. Tell me that Toma is eating too, and I can stop counting empty chairs.”'}],
    default: '“Help Toma at the quay first. Bread or a little magic will do. Then warm one bread and one silverleaf at my oven. Carry the broth to Rill on the North Breakwater.”\n\n“Take the north road from the notice post east of the mill sign. There is no deadline. Warm food is still worth carrying late.”'
  }, [choice('Report both meals · receive a work apron', 'meals-finish', all(F('mealDelivered'), {op: 'flag', key: 'ferrymanHelped'}), not(F('mealsDone'))), back('Ask about the oven', 'baker:baking'), leave], {portrait: 'baker'});
  action('meals-finish', 'baker', [flag('mealsDone')], 'meals', {once: true, repeatDialogue: 'shore:meals', conditions: all(F('mealsStarted'), F('mealDelivered'), {op: 'flag', key: 'ferrymanHelped', reason: 'Help Toma with bread or Mend before you report back.'})});
  quest('meals', 'A table for everyone', 'mealsStarted', 'mealsDone', [
    objective('toma', 'A place at the table', {op: 'flag', key: 'ferrymanHelped'}, 'Help Toma at the quay with bread or Mend. Previous help counts.', 'Toma has recovered his strength.'),
    objective('delivery', 'A bowl for the watch', F('mealDelivered'), 'Cook broth at Mara’s oven with 1 bread and 1 silverleaf. Carry it to Rill on the North Breakwater.', 'Rill has eaten. The watch no longer works on an empty stomach.'),
    objective('report', 'An empty bowl', F('mealsDone'), 'Return to Mara. Reward: work apron, armor +2 in the body slot, and 12 experience.', 'Mara gave you her work apron. Her oven remains open.')
  ], [give('shore:apron'), xp(12), {op: 'reputation', amount: 1}]);

  // 2. The lamp: a repair recipe and equal peaceful/combat access rewards.
  action('toma-talk', 'ferryman', [flag('lampStarted'), flag('namesStarted')], 'toma');
  dialogue('toma', 'Toma · The unlit shore', {
    cases: [{when: F('lampDone'), text: '“I can see the north signal again. A lamp does not ask us to forget anything. That is a useful sort of light.”'}],
    default: '“The north lamp went dark when the salvage warden locked its brake. Rill knows the release order. Follow the quay east to the notice post.”\n\n“Three workers kept that road open during the flood. The hall lists the expense, not their names. Look at the tally in Rill’s hut, the mooring stone, and the west rail.”'
  }, [choice('Record the workers’ names', 'names-reminder'), leave], {portrait: 'ferryman'});
  action('names-reminder', 'ferryman', [flag('namesStarted')], 'names-hint');
  dialogue('names-hint', 'Names the water kept', 'Copy three traces at the North Breakwater: the tally in the keeper’s hut, the mooring stone by the supply rack, and the ribbon on the west rail. Bring all three to Ione. You will choose a public memorial or private family letters.', [leave]);
  object('return-post', 'Quay road to Ashwick', 'Return to the notice post on the Ashwick quay.', 'return');
  dialogue('return', 'The road home', 'The quay road is open. Companions who are following will travel with you.', [choice('Return to Ashwick', 'return'), leave]);
  action('return', 'shore:return-post', [{op: 'travel', region: 'ashwick:village', spawn: 'breakwaterRoad'}]);
  object('bench', 'Breakwater repair bench', 'Bind a signal lens here with two stormglass pieces and one dry cord.', 'bench', 'table', {visual: {kind: 'prop', name: 'table', tools: true}});
  dialogue('bench', 'The repair bench', 'A clean diagram shows two pieces of stormglass held in a cord frame. The frame will fit the north lamp. The beach and supply rack hold more materials.', [
    {label: 'Bind a signal lens · 2 stormglass + 1 dry cord', command: {type: 'craft', recipe: 'shore:lens-recipe', station: 'shore:bench'}, conditions: all(not(F('lampDone')), not(has('shore:lens')), has('shore:glass', 2), has('shore:rope'))},
    {label: 'Open the recipe book', panel: {name: 'crafting', params: {station: 'shore:bench'}}}, leave
  ]);
  for (const [id, name, item, count, cap, visual, text] of [
    ['cord-rack', 'Dry cord rack', 'shore:rope', 2, 6, 'barrel', 'Rill leaves six lengths per traveler. Gather more after using them.'],
    ['glass-bank', 'Stormglass beach', 'shore:glass', 2, 6, 'rock', 'Clean pieces collect between the stones. Take two at a time.']
  ]) {
    object(id, name, text, id, visual, {verbs: ['inspect', 'gather'], gather: {item, count, cap}});
    dialogue(id, name, text, [{label: `Gather ${count} · carry up to ${cap}`, command: {type: 'verb', verb: 'gather', target: `shore:${id}`}}, leave]);
  }
  object('lamp', 'North signal lamp', 'A cracked signal lens waits above the channel. Make the warden safe before fitting a new lens.', 'lamp', 'lantern', {initialState: {lit: false}, visual: {kind: 'shore:signal', name: 'lantern'}});
  dialogue('lamp', 'The north signal', {cases: [{when: F('lampDone'), text: 'The lens sends a steady light across the channel. Rill has marked the safe line for the next boat.'}], default: 'The lamp frame is sound. Fit a bound signal lens after releasing or defeating the salvage warden. Craft the lens at the repair bench southwest of here.'}, [choice('Fit the lens and light the channel', 'lamp-finish', all(has('shore:lens'), F('watchSafe')), not(F('lampDone'))), leave]);
  action('lamp-finish', 'shore:lamp', [flag('lampDone'), {op: 'entity', target: 'shore:lamp', key: 'lit', value: true}], 'lamp', {once: true, repeatDialogue: 'shore:lamp', conditions: all(F('lampStarted'), F('watchSafe')), costs: {items: {'shore:lens': 1}}});
  quest('lamp-quest', 'The unlit shore', 'lampStarted', 'lampDone', [
    objective('watch', 'A safe approach', F('watchSafe'), 'Speak with Rill. Release the warden at the control stand, or defeat it. Both routes grant the same experience.', 'The salvage warden can no longer threaten the lamp.'),
    objective('lens', 'A light that asks nothing', any(has('shore:lens'), F('lampDone')), 'Gather 2 stormglass at the beach and 1 dry cord at the rack. Bind a lens at the repair bench.', 'A replacement lens is ready.'),
    objective('light', 'The north signal', F('lampDone'), 'Fit the lens to the north lamp. Reward: 8 crowns and 16 experience.', 'The North Breakwater signal is lit. Boats have a safe line home.')
  ], [{op: 'gold', amount: 8}, xp(16)]);

  object('controls', 'Salvage control stand', 'A three-part safety release. Read Rill’s maintenance plate; mistakes reset the sequence without costing supplies.', 'controls', 'pillar');
  const step = n => F('releaseStep', n);
  dialogue('controls', 'Ground · inlet · brake', {join: [
    'The maintenance plate reads: “FIRST ground the line. THEN close the inlet. LAST release the brake.” A wrong order resets the mechanism. It cannot trap you.',
    {cases: [{when: F('watchSafe'), text: 'The warden is safe. No further release is needed.'}, {when: step(2), text: 'The line is grounded and the inlet is closed. Release the brake.'}, {when: step(1), text: 'The line is grounded. Close the inlet next.'}], default: 'The line is live. Start by grounding it.'}], separator: '\n\n'}, [
    choice('Ground the line', 'ground', not(F('watchSafe'))), choice('Close the inlet', 'inlet', not(F('watchSafe'))), choice('Release the brake', 'brake', not(F('watchSafe'))), leave
  ]);
  action('ground', 'shore:controls', [flag('releaseStep', 1)], 'controls', {conditions: not(F('watchSafe'))});
  action('inlet', 'shore:controls', [], 'controls', {conditions: not(F('watchSafe')), branches: [{when: step(1), effects: [flag('releaseStep', 2)], message: 'The inlet closes. Release the brake next.'}, {when: true, effects: [flag('releaseStep', 0)], message: 'The line trips. Nothing is damaged. Ground the line first.'}]});
  action('brake', 'shore:controls', [], 'controls', {conditions: not(F('watchSafe')), branches: [{when: step(2), effects: [flag('releaseStep', 3), flag('maintenance')], message: 'The brake releases. The warden folds its arms and stands down.'}, {when: true, effects: [flag('releaseStep', 0)], message: 'The brake holds. Ground the line, close the inlet, then release the brake.'}]});
  const warden = structuredClone(ashwick.actors.find(actor => actor.id === 'ashwick:warden'));
  Object.assign(warden, {id: 'shore:salvage-warden', aliases: [], name: 'Salvage warden', xpReward: 0, loot: {}, peaceWhen: F('watchSafe'), stats: {...warden.stats, hp: 65, maxHp: 65, damage: 12, speed: 32}, attack: {...warden.attack, damage: 12, windup: 0.85, recovery: 1.05, aggroRange: 90}});
  pack.actors.push(warden);
  pack.encounters.push({id: 'shore:salvage-watch', regionId: 'shore:breakwater', members: ['shore:warden'], resolution: F('maintenance'), effects: [flag('watchSafe'), xp(12), {op: 'event', kind: 'story', message: 'The lamp approach is safe. +12 experience.'}]});

  // Rill makes the peaceful path explicit and provides cost-free recovery.
  const rill = structuredClone(ashwick.actors.find(actor => actor.id === 'ashwick:baker'));
  Object.assign(rill, {id: 'shore:rill-actor', aliases: [], name: 'Rill', dialogue: 'shore:rill', schedule: [], appearance: {...rill.appearance, hair: 'short', outfit: 'coat', colors: {...rill.appearance.colors, cloth: '#526e70', coat: '#526e70', hair: '#c0b9a2'}}});
  pack.actors.push(rill);
  pack.assets.push({id: 'shore:rill-portrait', type: 'portrait', palette: ['#385b63', '#a4926b', '#c5b994', '#23393d'], accessory: 'hood', license: 'Original procedural portrait palette for The Hollow Bell.'});
  dialogue('rill', 'Rill · Keeper of the north watch', {join: [
    {cases: [{when: F('lampDone'), text: '“That light reaches the boats before my voice does. Thank you. The lamp belongs to everyone who needs it.”'}], default: '“The salvage warden is obeying a broken instruction. You can fight it, but you do not have to. The control stand is on this side of the channel.”\n\n“Ground the line. Close the inlet. Release the brake. Then bind a new lens at the bench and fit it to the lamp.”'},
    {cases: [{when: F('mealDelivered'), text: 'The empty broth bowl is clean and ready for Mara.'}], default: 'Rill rubs a cold hand. “Mara said she would send a meal. I should have gone to the bakery myself.”'},
    '“Use the shelter if you are hurt. The cord and glass are free. A mistake is not a debt.”'], separator: '\n\n'}, [
    choice('I will repair the lamp', 'rill-start', undefined, not(F('lampStarted'))),
    choice('Deliver Mara’s broth', 'meal-deliver', all(F('mealsStarted'), has('shore:broth')), not(F('mealDelivered'))),
    choice('Ask about the flood workers', 'rill-names'), choice('Ask about Wren’s spare reed', 'rill-reed', F('wrenStarted')), leave
  ], {portrait: 'shore:rill-portrait'});
  action('rill-start', 'shore:rill', [flag('lampStarted')], 'rill');
  action('meal-deliver', 'shore:rill', [flag('mealDelivered')], 'rill', {once: true, repeatDialogue: 'shore:rill', conditions: F('mealsStarted'), costs: {items: {'shore:broth': 1}}});
  action('rill-names', 'shore:rill', [flag('namesStarted')], 'names-hint');
  action('rill-reed', 'shore:rill', [], 'reed-hint');
  dialogue('reed-hint', 'A spare, not a sacrifice', '“Elian left a brass reed in the blue tool case in my hut. Take it for Wren. Fit it with dry cord at Elian’s workshop. An instrument can carry a tune without keeping the singer.”');
  object('shelter', 'The watch shelter', 'Rest safely and recover all vitality and focus. No coin is required.', 'shelter', 'bed', {verbs: ['inspect', 'rest'], rest: {seconds: 30}});
  dialogue('shelter', 'A dry place', 'A blanket, a covered water jar, and enough room to sit. Rest restores vitality and focus. Thirty seconds pass; no quest has a deadline.', [{label: 'Rest · restore vitality and focus', command: {type: 'verb', verb: 'rest', target: 'shore:shelter'}}, leave]);

  // 3. Records can be found before the quest is offered. Nothing is consumed.
  for (const [id, name, title, text, visual] of [
    ['tally', 'Keeper’s flood tally', 'Sael · The rope holder', '“Sael held the ferry line until the last family crossed. Paid: no. Returned home: yes.” A small hand has added: “Ask before calling this a debt.”', 'table'],
    ['stone', 'Mooring stone', 'Edda · The boat builder', 'EDDA is cut into the stone beneath three repair dates. Rill’s note reads: “She lent the boat. She did not sell us her courage.”', 'rock'],
    ['ribbon', 'Ribbon on the west rail', 'Brin · The night cook', 'A cloth strip carries a recipe and a name: Brin. “I stayed because someone had to feed the people who stayed.”', 'sign']
  ]) {
    object(id, name, text, id, visual);
    dialogue(id, title, text, [choice('Copy this name into the journal', `read-${id}`, undefined, not(F(`name-${id}`))), leave]);
    action(`read-${id}`, `shore:${id}`, [flag('namesStarted'), flag(`name-${id}`)], `${id}`, {once: true, repeatDialogue: `shore:${id}`, message: `${title.split(' · ')[0]} is recorded. The original stays here.`});
  }
  const namesFound = all(F('name-tally'), F('name-stone'), F('name-ribbon'));
  action('ione-talk', 'prior', [flag('namesStarted')], 'ione');
  dialogue('ione', 'Ione · Names the water kept', {cases: [
    {when: F('namesPublic'), text: '“The board has their names, not my seal. Rill will ask what they wish to add. I will not speak for them again.”'},
    {when: F('namesLetters'), text: '“Three letters, in their own words. Their families choose what to share. I kept copies of the work, not the private words.”'},
    {when: namesFound, text: '“Sael. Edda. Brin. I recorded how much their work saved, and left out the people.”\n\nChoose what happens to your copies. Both choices preserve the names and award the three-name charm. This choice does not decide the bell’s ending.'}],
    default: '“Bring the names from the breakwater tally, the mooring stone, and the west rail. A number alone cannot tell us what a person gave.”'
  }, [
    choice('Make a public memorial · +2 trust', 'names-public', namesFound, not(F('namesDone'))),
    choice('Send private family letters · +1 trust, 2 broth', 'names-letters', namesFound, not(F('namesDone'))),
    choice('Read the village repair rota', 'ione-rebuild', undefined, ended), leave
  ], {portrait: 'prior'});
  for (const [mode, effects] of [['public', [flag('namesPublic'), {op: 'reputation', amount: 2}]], ['letters', [flag('namesLetters'), {op: 'reputation', amount: 1}, give('shore:broth', 2)]]]) {
    action(`names-${mode}`, 'prior', [flag('namesDone'), ...effects], 'ione', {once: true, conditions: all(namesFound, not(F('namesDone')))});
  }
  quest('names', 'Names the water kept', 'namesStarted', 'namesDone', [
    objective('tally', 'The rope holder', F('name-tally'), 'Copy the flood tally in the keeper’s hut on the North Breakwater.', 'Sael held the ferry line until the last family crossed.'),
    objective('stone', 'The boat builder', F('name-stone'), 'Read the mooring stone beside the breakwater cord rack.', 'Edda lent her repaired boat without asking for payment.'),
    objective('ribbon', 'The night cook', F('name-ribbon'), 'Read the ribbon on the west rail of the breakwater.', 'Brin cooked for the people who stayed through the flood.'),
    objective('return', 'Who tells the story?', F('namesDone'), 'Take all three names to Ione. Choose a public memorial or private letters. Reward: a charm with maximum focus +6 and 12 experience.', {cases: [{when: F('namesPublic'), text: 'The quay board names the workers. Their own words can follow.'}], default: 'Private letters have reached the families. They decide what to share.'})
  ], [give('shore:knot'), xp(12)]);

  // 4. Wren gets an independent project and a choice with a stated benefit.
  action('wren-talk', 'wren', [flag('wrenStarted')], 'wren');
  dialogue('wren', 'Wren · A note of our own', {cases: [
    {when: F('wrenPublic'), text: '“Rill learned the low part. Mara keeps losing the beat. It is better when they laugh. No one has to sound like Elian.”'},
    {when: F('wrenDuet'), text: '“This one is ours. Not secret. Just small enough to carry when the rest of the world is loud.”'},
    {when: F('reedFitted'), text: 'Wren tests the new reed. Its note is thin, clear, and entirely new.\n\n“Shall we teach it to the village, or keep it as a traveling duet?”\n\nBoth choices teach Shelter song: 12 focus grants armor +3 for 25 seconds. Bring Wren with you to finish.'}],
    default: '“Elian taught me to repeat a perfect note. I want to make a useful one.”\n\n“Rill has a spare brass reed in the blue tool case at the North Breakwater. Fit it with one dry cord at Elian’s workbench. Then let us decide who this tune is for.”'
  }, [
    choice('Travel with me', 'wren-follow', undefined, not(following)),
    choice('Teach the village · +2 trust', 'wren-public', all(F('reedFitted'), following), not(F('wrenDone'))),
    choice('Keep a traveling duet · maximum focus +6', 'wren-duet', all(F('reedFitted'), following), not(F('wrenDone'))), leave
  ], {portrait: 'wren'});
  action('wren-follow', 'wren', [{op: 'party', member: 'wren', mode: 'recruit'}, {op: 'party', member: 'wren', mode: 'follow'}], 'wren');
  object('tool-case', 'Blue tool case', 'Rill has set aside a spare brass reed for Wren. It is a gift, not stolen property.', 'tool-case', 'chest');
  dialogue('tool-case', 'The spare reed', {cases: [{when: F('reedTaken'), text: 'The spare reed is with Wren’s project. The other tools stay for the watch.'}], default: 'A brass reed lies in folded cloth. A tag reads: “For the apprentice. Make something of your own.”'}, [choice('Take Wren’s reed', 'take-reed', undefined, not(F('reedTaken'))), leave]);
  action('take-reed', 'shore:tool-case', [flag('wrenStarted'), flag('reedTaken'), give('shore:reed')], 'tool-case', {once: true, repeatDialogue: 'shore:tool-case'});
  action('fit-reed', 'workbench', [flag('reedFitted')], 'fitted-reed', {once: true, repeatDialogue: 'shore:fitted-reed', conditions: F('wrenStarted'), costs: {items: {'shore:reed': 1, 'shore:rope': 1}}});
  dialogue('fitted-reed', 'A new instrument', 'The cord holds the reed without choking its sound. No memory was used or taken. Speak with Wren while they are following you to choose the tune’s future.');
  for (const [mode, effects] of [['public', [flag('wrenPublic'), {op: 'reputation', amount: 2}]], ['duet', [flag('wrenDuet'), {op: 'addStat', key: 'maxMana', value: 6}]]]) {
    action(`wren-${mode}`, 'wren', [flag('wrenDone'), ...effects], 'wren', {once: true, conditions: all(F('reedFitted'), following, not(F('wrenDone')))});
  }
  quest('wren-quest', 'A note of our own', 'wrenStarted', 'wrenDone', [
    objective('reed', 'A spare, not a sacrifice', F('reedTaken'), 'Take the brass reed from the blue tool case in Rill’s hut on the North Breakwater.', 'Rill gave the spare reed to Wren.'),
    objective('fit', 'Room to sound', F('reedFitted'), 'Bring the reed and 1 dry cord to Elian’s workbench. Fit the reed there.', 'The new reed is fitted. No memory powers it.'),
    objective('choice', 'Choose the audience', F('wrenDone'), 'Ask Wren to follow, then speak about the new tune. Learn Shelter song and gain 14 experience.', {cases: [{when: F('wrenPublic'), text: 'The village is learning Wren’s shelter song.'}], default: 'You and Wren carry a traveling duet.'})
  ], [{op: 'learn', ability: 'shore:shelter-song'}, xp(14)]);

  // 5. An epilogue with practical work, available after either original ending.
  action('rebuild-talk', 'shore:quay-post', [flag('rebuildStarted')], 'rebuild', {conditions: ended});
  action('ione-rebuild', 'prior', [flag('rebuildStarted')], 'rebuild-from-hall', {conditions: ended});
  const readyToBuild = all(ended, F('lampDone'), F('mealsDone'), F('namesDone'));
  dialogue('rebuild', 'After the toll', {join: [
    {cases: [{when: {op: 'state', key: 'ending', compare: 'eq', value: 'retune'}, text: 'The willing chorus keeps the ward. The village still needs a watch, a meal, and people whose work has a name.'}], default: 'Without the old bell, every flood barrier matters. The village needs a watch, a meal, and people whose work has a name.'},
    {cases: [{when: F('rebuildDone'), text: 'The first repair shift is supplied. Rill watches the channel. Mara feeds the workers. Ione keeps a public rota. Your coat hangs on a peg, ready for the next wet road.'}], default: 'Finish the north lamp, Mara’s meal delivery, and the workers’ names. Then bring 2 dry cord and 2 silverleaf broth to this quay notice post. Wren’s personal project is optional.'}], separator: '\n\n'}, [
    choice('Supply the first repair shift · 2 cord + 2 broth', 'rebuild-finish', all(readyToBuild, has('shore:rope', 2), has('shore:broth', 2)), not(F('rebuildDone'))), leave
  ]);
  dialogue('rebuild-from-hall', 'After the toll', 'The bell’s choice is made. Finish the north lamp, Mara’s meal round, and the workers’ names. Bring 2 dry cord and 2 broth to the notice post on the quay, not to the hall. The supplies belong at the work site.');
  action('rebuild-finish', 'shore:quay-post', [flag('rebuildDone')], 'rebuild', {once: true, repeatDialogue: 'shore:rebuild', conditions: readyToBuild, costs: {items: {'shore:rope': 2, 'shore:broth': 2}}});
  quest('rebuild', 'After the toll', 'rebuildStarted', 'rebuildDone', [
    objective('lamp', 'Keep a watch', F('lampDone'), 'Restore the north signal lamp.', 'The channel has a working signal.'),
    objective('meals', 'Feed the workers', F('mealsDone'), 'Complete A table for everyone and report to Mara.', 'Mara’s meal round is established.'),
    objective('names', 'Name the work', F('namesDone'), 'Complete Names the water kept with Ione.', 'The workers and their wishes are recorded.'),
    objective('shift', 'The first repair shift', F('rebuildDone'), 'Bring 2 dry cord and 2 broth to the quay notice post. Reward: breakwater coat, armor +4, and 20 experience.', 'The first shift is supplied. Ashwick keeps going after the bell’s choice.')
  ], [give('shore:coat'), xp(20), {op: 'reputation', amount: 2}]);

  // Geometry: a safe west yard, a keeper’s hut, and a visible channel approach.
  pack.regions.push({
    id: 'shore:breakwater', name: 'North Breakwater', width: 32, height: 26, tileSize: 16,
    defaultFloor: 'water', spawn: {x: 152, y: 376}, spawns: {arrival: {x: 152, y: 376}}, recovery: {x: 152, y: 376},
    terrain: [
      {x: 0, y: 0, w: 32, h: 26, floor: 'water', blocked: true},
      {x: 3, y: 3, w: 13, h: 21, floor: 'quay'},
      {x: 6, y: 23, w: 6, h: 3, floor: 'stone'},
      {x: 15, y: 9, w: 14, h: 4, floor: 'stone'},
      {x: 23, y: 3, w: 6, h: 12, floor: 'stone'},
      {x: 4, y: 17, w: 9, h: 4, floor: 'dirt'},
      {x: 13, y: 20, w: 4, h: 4, floor: 'dock'}
    ],
    rooms: [{x: 4, y: 4, w: 9, h: 8, floor: 'wood', wall: 1, cutWall: 2, doors: [[8, 11, 2, 1]]}],
    props: [
      {name: 'barrel', x: 72, y: 344}, {name: 'barrel', x: 88, y: 344},
      {name: 'rock', x: 56, y: 304, opts: {size: 1.3}}, {name: 'rock', x: 208, y: 304},
      {name: 'lantern', x: 200, y: 208}, {name: 'lantern', x: 400, y: 216},
      {name: 'pillar', x: 376, y: 56}, {name: 'pillar', x: 456, y: 56},
      {name: 'pot', x: 80, y: 104}, {name: 'flowers', x: 200, y: 360, opts: {color: '#d1b57b'}},
      {name: 'rock', x: 296, y: 232, opts: {size: 1.4}}, {name: 'rock', x: 344, y: 80}
    ],
    entities: [
      {id: 'shore:return-post', definition: 'shore:return-post', x: 200, y: 376},
      {id: 'shore:rill', definition: 'shore:rill-actor', kind: 'actor', x: 168, y: 224},
      {id: 'shore:bench', definition: 'shore:bench', x: 120, y: 248},
      {id: 'shore:cord-rack', definition: 'shore:cord-rack', x: 208, y: 248},
      {id: 'shore:glass-bank', definition: 'shore:glass-bank', x: 120, y: 312},
      {id: 'shore:controls', definition: 'shore:controls', x: 232, y: 216},
      {id: 'shore:tally', definition: 'shore:tally', x: 112, y: 112},
      {id: 'shore:tool-case', definition: 'shore:tool-case', x: 168, y: 112},
      {id: 'shore:shelter', definition: 'shore:shelter', x: 112, y: 152},
      {id: 'shore:stone', definition: 'shore:stone', x: 216, y: 288},
      {id: 'shore:ribbon', definition: 'shore:ribbon', x: 72, y: 232},
      {id: 'shore:warden', definition: 'shore:salvage-warden', kind: 'actor', x: 416, y: 168},
      {id: 'shore:lamp', definition: 'shore:lamp', x: 424, y: 88}
    ],
    landmarks: [
      {name: 'Quay road', x: 152, y: 376, bounds: [3, 21, 14, 5]},
      {name: 'Keeper’s hut', x: 136, y: 128, bounds: [4, 4, 9, 8]},
      {name: 'Repair yard', x: 168, y: 248, bounds: [3, 12, 13, 9]},
      {name: 'North signal', x: 424, y: 88, bounds: [23, 3, 6, 12]},
      {name: 'Channel walk', x: 312, y: 176, bounds: [15, 9, 8, 4]}
    ],
    exits: [{id: 'shore:home', entity: 'shore:return-post', targetRegion: 'ashwick:village', spawn: 'breakwaterRoad'}]
  });
  // Extend Ashwick so content selection cannot leave dangling conversation links.
  for (const [kind, records] of Object.entries(pack)) ashwick[kind] = [...(ashwick[kind] || []), ...records];
  ashwick.version = '2.1.0';
})();

/* SOURCE: content/designer-demo/pack.js */
/* The Mill Ledger — original declarative content. No runtime hooks or behavior extensions. */
(globalThis.HBPacks ||= []).push({
  "id": "designer-demo",
  "version": "1.0.0",
  "name": "The Mill Ledger",
  "preview": {
    "region": "mill:ledger",
    "spawn": "arrival"
  },
  "settings": {
    "progression": {
      "levels": [
        {
          "level": 2,
          "xp": 20,
          "effects": [
            {
              "op": "learn",
              "ability": "mill:lay-dust"
            }
          ]
        }
      ]
    }
  },
  "queries": {
    "millEvidence": {
      "type": "objectiveCount",
      "quest": "mill:accounts",
      "group": "evidence"
    },
    "millEvidenceTotal": {
      "type": "objectiveTotal",
      "quest": "mill:accounts",
      "group": "evidence"
    },
    "millUnlaceCost": {
      "type": "abilityCost",
      "ability": "mill:unlace",
      "key": "mana"
    },
    "millHunger": {
      "type": "stat",
      "key": "millHunger"
    },
    "millMealMode": {
      "type": "text",
      "value": {
        "cases": [
          {
            "when": {
              "op": "flag",
              "key": "mill:mealClock",
              "value": true
            },
            "text": "requested for this visit"
          }
        ],
        "default": "off"
      }
    }
  },
  "items": [
    {
      "id": "mill:oats",
      "name": "Windfall oats",
      "description": "Clean grain gleaned from the sacks beneath the awning. Orris leaves this share for travelers.",
      "weight": 1,
      "stackable": true,
      "icon": "grain"
    },
    {
      "id": "mill:oatcake",
      "name": "Salt-crust oatcake",
      "description": "A warm, rough-edged cake. Restores 18 vitality and resets the optional mill hunger count.",
      "weight": 1,
      "stackable": true,
      "icon": "bread",
      "use": {
        "consume": true,
        "effects": [
          {
            "op": "heal",
            "target": "$actor",
            "amount": 18
          },
          {
            "op": "setStat",
            "key": "millHunger",
            "value": 0
          }
        ]
      }
    },
    {
      "id": "mill:brass-key",
      "name": "Blue-cord mill key",
      "description": "The key opens both mill doors. A blue thread marks it as a loan, not a gift.",
      "weight": 0,
      "stackable": true
    },
    {
      "id": "mill:ledger-leaf",
      "name": "Original ledger leaf",
      "description": "The flood-week page. Its narrow left margin carries a second total: meals delivered without charge.",
      "weight": 0,
      "stackable": true
    },
    {
      "id": "mill:work-gloves",
      "name": "Patched mill gloves",
      "description": "Orris keeps these in the owned chest. They steady the hands without making them clean.",
      "stackable": false,
      "weight": 2,
      "equipment": {
        "slot": "hand",
        "modifiers": {
          "armor": 2,
          "damage": 2
        }
      }
    },
    {
      "id": "mill:counterweight",
      "name": "Counterweight charm",
      "description": "Sedge has filed a cracked brass weight into a small bell. An honest balance, carried close.",
      "stackable": false,
      "weight": 1,
      "equipment": {
        "slot": "charm",
        "modifiers": {
          "armor": 2,
          "damage": 3
        }
      }
    },
    {
      "id": "mill:meal-pouch",
      "name": "Canvas meal pouch",
      "description": "A stout little bag for food or supplies. Its contents count toward your carrying weight.",
      "stackable": false,
      "weight": 1,
      "container": {
        "capacity": 10
      }
    }
  ],
  "assets": [
    {
      "id": "mill:orris-portrait",
      "type": "portrait",
      "palette": [
        "#62594d",
        "#a97a49",
        "#b88d6f",
        "#263d3d"
      ],
      "accessory": "hood",
      "license": "Original procedural portrait palette by the independent Mill Ledger content author."
    },
    {
      "id": "mill:sedge-portrait",
      "type": "portrait",
      "palette": [
        "#bdab7f",
        "#4c8583",
        "#a8795c",
        "#243734"
      ],
      "accessory": "rune",
      "license": "Original procedural portrait palette by the independent Mill Ledger content author."
    }
  ],
  "prefabs": [
    {
      "id": "mill:outbound-sign",
      "name": "Towpath to the Mill Ledger",
      "description": "A blue arrow points upstream. Activate to travel to the mill; its return sign leads safely to Ashwick’s arrival road.",
      "verbs": [
        "inspect",
        "activate"
      ],
      "range": 38,
      "visual": {
        "kind": "prop",
        "name": "sign",
        "color": "#839b8b"
      },
      "onActivate": [
        {
          "op": "flag",
          "key": "mill:visited",
          "value": true
        },
        {
          "op": "travel",
          "region": "mill:ledger",
          "spawn": "arrival"
        }
      ]
    },
    {
      "id": "mill:return-sign",
      "name": "Road home to Ashwick",
      "description": "The bridge is sound. Activate to return to Ashwick’s arrival road. Your companions and discoveries travel with you.",
      "verbs": [
        "inspect",
        "activate"
      ],
      "range": 38,
      "visual": {
        "kind": "prop",
        "name": "sign",
        "color": "#839b8b"
      },
      "onActivate": [
        {
          "op": "travel",
          "region": "ashwick:village",
          "spawn": "arrival"
        }
      ]
    },
    {
      "id": "mill:archive-door",
      "name": "Blue-cord archive gate",
      "description": "A wide slatted gate. A key, Unlace, or the counterweight will release it. Open it after the lock yields.",
      "dialogue": "mill:archive-gate",
      "verbs": [
        "inspect",
        "unlock",
        "open",
        "close"
      ],
      "initialState": {
        "locked": true,
        "open": false
      },
      "key": "mill:brass-key",
      "visual": {
        "kind": "gate",
        "orientation": "horizontal",
        "width": 32,
        "height": 38,
        "color": "#648986"
      },
      "collider": {
        "w": 32,
        "h": 16,
        "when": "closed"
      },
      "range": 42
    },
    {
      "id": "mill:store-door",
      "name": "Millhouse door",
      "description": "The millhouse is unlocked, but its door has swollen in the damp. Open it to reach Orris’s resting place. This door has its own latch.",
      "dialogue": "mill:store-gate",
      "verbs": [
        "inspect",
        "unlock",
        "open",
        "close"
      ],
      "initialState": {
        "locked": true,
        "open": false
      },
      "key": "mill:brass-key",
      "visual": {
        "kind": "gate",
        "orientation": "horizontal",
        "width": 32,
        "height": 38,
        "color": "#9c815c"
      },
      "collider": {
        "w": 32,
        "h": 16,
        "when": "closed"
      },
      "range": 42
    },
    {
      "id": "mill:chest",
      "name": "Blue-banded mill chest",
      "description": "A hinged chest banded in faded blue. Open it, then use the container controls to take or put supplies. Check its owner before taking.",
      "verbs": [
        "inspect",
        "open",
        "close"
      ],
      "initialState": {
        "open": false
      },
      "inventory": {},
      "capacity": 35,
      "visual": {
        "kind": "prop",
        "name": "chest",
        "size": 1.15,
        "color": "#628784"
      },
      "collider": {
        "w": 16,
        "h": 16
      },
      "range": 36,
      "theft": {
        "reputation": -2,
        "witnessRange": 96,
        "message": "Orris sees the borrowed stores vanish. The mill will remember."
      }
    },
    {
      "id": "mill:weight-crate",
      "name": "Counterweight crate",
      "description": "The rope is attached to the archive latch. Sliding this crate west lifts the catch without spending a key or focus.",
      "dialogue": "mill:counterweight-talk",
      "verbs": [
        "inspect",
        "move"
      ],
      "visual": {
        "kind": "prop",
        "name": "crate",
        "color": "#997747"
      },
      "collider": {
        "w": 16,
        "h": 16
      },
      "range": 40,
      "onMove": [
        {
          "op": "entity",
          "target": "mill:archive-gate",
          "key": "locked",
          "value": false
        },
        {
          "op": "flag",
          "key": "mill:counterweightMoved",
          "value": true
        },
        {
          "op": "event",
          "message": "A rope draws taut; the archive lock clicks free. Its gate can now be opened.",
          "kind": "object"
        }
      ]
    },
    {
      "id": "mill:spare-crate",
      "name": "Empty delivery crate",
      "description": "An ordinary empty crate beside the millhouse. Moving it does not move the counterweight or alter either door.",
      "dialogue": "mill:spare-crate-talk",
      "verbs": [
        "inspect",
        "move"
      ],
      "visual": {
        "kind": "prop",
        "name": "crate",
        "color": "#9e875e"
      },
      "collider": {
        "w": 16,
        "h": 16
      },
      "range": 40
    },
    {
      "id": "mill:gleanings",
      "name": "Travelers’ grain awning",
      "description": "Orris renews these windfall oats. Gather two at a time, up to six carried, then bake at the iron pan. They remain available after every purchase and recipe is exhausted.",
      "verbs": [
        "inspect",
        "gather"
      ],
      "gather": {
        "item": "mill:oats",
        "count": 2,
        "cap": 6
      },
      "visual": {
        "kind": "prop",
        "name": "barrel",
        "color": "#bb9d62"
      },
      "range": 36
    },
    {
      "id": "mill:pan",
      "name": "Iron oatcake pan",
      "description": "The pan is warm. Two handfuls of oats make one salt-crust oatcake.",
      "dialogue": "mill:pan-talk",
      "verbs": [
        "inspect"
      ],
      "visual": {
        "kind": "prop",
        "name": "brazier",
        "size": 0.9,
        "color": "#766d59"
      },
      "range": 38
    },
    {
      "id": "mill:docket",
      "name": "Weighbridge docket",
      "description": "A slate sheltered beneath the counting lantern. Read it to begin comparing the public total with the hidden account.",
      "dialogue": "mill:docket-talk",
      "verbs": [
        "inspect",
        "read"
      ],
      "visual": {
        "kind": "prop",
        "name": "sign",
        "color": "#b6ae81"
      },
      "range": 40
    },
    {
      "id": "mill:shift-bell",
      "name": "Night-shift bell post",
      "description": "A little bronze bell hangs from the post. Sedge knows the phrase that releases the counting warden from its vigil.",
      "dialogue": "mill:bell-talk",
      "verbs": [
        "inspect"
      ],
      "visual": {
        "kind": "prop",
        "name": "lantern",
        "size": 1.3,
        "color": "#d0a55d"
      },
      "range": 42
    },
    {
      "id": "mill:rest",
      "name": "Towpath rest shelter",
      "description": "A dry awning, drinking water, and a clean blanket. Rest or recover here without a fee; depleted supplies cannot trap you at the mill.",
      "dialogue": "mill:rest-talk",
      "verbs": [
        "inspect",
        "rest"
      ],
      "visual": {
        "kind": "prop",
        "name": "lantern",
        "size": 1.4,
        "color": "#d8b776"
      },
      "range": 42
    }
  ],
  "actors": [
    {
      "id": "mill:orris-actor",
      "name": "Orris",
      "role": "Miller and keeper of accounts",
      "team": "neutral",
      "description": "Flour has settled into the lines of Orris’s coat. They keep the mill supplied, and keep its mistakes in ink.",
      "dialogue": "mill:orris-talk",
      "portrait": "mill:orris-portrait",
      "stats": {
        "hp": 75,
        "maxHp": 75,
        "mana": 25,
        "maxMana": 25,
        "speed": 53,
        "radius": 4,
        "damage": 7
      },
      "appearance": {
        "size": 1.18,
        "outfit": "coat",
        "hair": "short",
        "sleeves": "long",
        "colors": {
          "skin": "#b88d6f",
          "hair": "#62594d",
          "cloth": "#a97a49",
          "coat": "#977147",
          "pants": "#4a4941",
          "boot": "#39352e",
          "trim": "#c5b997"
        }
      },
      "schedule": [
        {
          "start": 0,
          "end": 120,
          "anchor": "counter",
          "activity": "weighing the travelers’ grain",
          "regionId": "mill:ledger"
        },
        {
          "start": 120,
          "end": 240,
          "anchor": "millhouse-rest",
          "activity": "resting beside the cooling stones",
          "regionId": "mill:ledger"
        }
      ],
      "range": 36
    },
    {
      "id": "mill:sedge-actor",
      "name": "Sedge",
      "role": "The mill’s night runner",
      "team": "neutral",
      "description": "A messenger with oat husks in their cuffs and a careful memory for people whom the ledger forgot.",
      "dialogue": "mill:sedge-talk",
      "portrait": "mill:sedge-portrait",
      "stats": {
        "hp": 80,
        "maxHp": 80,
        "mana": 30,
        "maxMana": 30,
        "speed": 71,
        "radius": 4,
        "damage": 10
      },
      "appearance": {
        "size": 1.08,
        "outfit": "tunic",
        "weapon": "staff",
        "hair": "ponytail",
        "sleeves": "long",
        "colors": {
          "skin": "#a8795c",
          "hair": "#bdab7f",
          "cloth": "#4c8583",
          "pants": "#455b55",
          "boot": "#353a32",
          "belt": "#80643e",
          "trim": "#d6c291"
        }
      },
      "companion": {
        "assist": true,
        "assistDamage": 10,
        "assistInterval": 4,
        "assistRange": 68,
        "defensive": true
      },
      "schedule": [
        {
          "start": 0,
          "end": 140,
          "anchor": "wheel-work",
          "activity": "checking the archive counterweight",
          "regionId": "mill:ledger"
        },
        {
          "start": 140,
          "end": 240,
          "anchor": "runner-rest",
          "activity": "taking a meal by the towpath lantern",
          "regionId": "mill:ledger"
        }
      ],
      "range": 36
    },
    {
      "id": "mill:warden-actor",
      "name": "The counting warden",
      "role": "A debt that learned to stand",
      "team": "hostile",
      "description": "A flour-white guardian keeps its count long after the shift should have ended.",
      "stats": {
        "hp": 52,
        "maxHp": 52,
        "mana": 0,
        "maxMana": 0,
        "speed": 42,
        "radius": 5,
        "damage": 12
      },
      "attack": {
        "range": 30,
        "damage": 12,
        "windup": 0.55,
        "cooldown": 1.35
      },
      "appearance": {
        "size": 1.28,
        "outfit": "armor",
        "weapon": "sword",
        "hair": "short",
        "colors": {
          "skin": "#a99e80",
          "hair": "#beb89d",
          "cloth": "#888b73",
          "armor": "#8b947f",
          "pants": "#505b53",
          "boot": "#3b443e",
          "metal": "#b7b695"
        }
      },
      "loot": {
        "mill:oats": 2
      },
      "xpReward": 8
    }
  ],
  "regions": [
    {
      "id": "mill:ledger",
      "name": "The Mill Ledger",
      "width": 32,
      "height": 26,
      "tileSize": 16,
      "defaultFloor": "grass",
      "spawn": {
        "x": 248,
        "y": 376
      },
      "spawns": {
        "arrival": {
          "x": 248,
          "y": 376
        }
      },
      "anchors": {
        "counter": {
          "x": 216,
          "y": 280
        },
        "millhouse-rest": {
          "x": 184,
          "y": 168
        },
        "wheel-work": {
          "x": 280,
          "y": 264
        },
        "runner-rest": {
          "x": 296,
          "y": 360
        }
      },
      "terrain": [
        {
          "x": 0,
          "y": 0,
          "w": 3,
          "h": 26,
          "floor": "water",
          "blocked": true
        },
        {
          "x": 3,
          "y": 0,
          "w": 2,
          "h": 26,
          "floor": "quay"
        },
        {
          "x": 7,
          "y": 15,
          "w": 22,
          "h": 5,
          "floor": "stone"
        },
        {
          "x": 14,
          "y": 18,
          "w": 3,
          "h": 8,
          "floor": "dirt"
        },
        {
          "x": 6,
          "y": 20,
          "w": 14,
          "h": 3,
          "floor": "dirt"
        },
        {
          "x": 22,
          "y": 13,
          "w": 4,
          "h": 4,
          "floor": "stone"
        }
      ],
      "rooms": [
        {
          "x": 5,
          "y": 4,
          "w": 10,
          "h": 10,
          "floor": "wood",
          "wall": 1,
          "cutWall": 2,
          "doors": [
            [
              9,
              13,
              2,
              1
            ]
          ]
        },
        {
          "x": 19,
          "y": 3,
          "w": 11,
          "h": 12,
          "floor": "stone",
          "wall": 1,
          "cutWall": 2,
          "doors": [
            [
              23,
              14,
              2,
              1
            ]
          ]
        }
      ],
      "walls": [
        {
          "x": 0,
          "y": 0,
          "w": 32,
          "h": 1,
          "wall": 1
        },
        {
          "x": 31,
          "y": 0,
          "w": 1,
          "h": 26,
          "wall": 1
        },
        {
          "x": 0,
          "y": 25,
          "w": 14,
          "h": 1,
          "wall": 1
        },
        {
          "x": 17,
          "y": 25,
          "w": 15,
          "h": 1,
          "wall": 1
        }
      ],
      "props": [
        {
          "name": "tree",
          "x": 88,
          "y": 32,
          "opts": {
            "size": 1.5,
            "color": "#617b66"
          }
        },
        {
          "name": "tree",
          "x": 280,
          "y": 56,
          "opts": {
            "size": 1.25,
            "color": "#718369"
          }
        },
        {
          "name": "tree",
          "x": 472,
          "y": 360,
          "opts": {
            "size": 1.6,
            "color": "#5e7868"
          }
        },
        {
          "name": "bush",
          "x": 456,
          "y": 312,
          "opts": {
            "color": "#7c8b60"
          }
        },
        {
          "name": "flowers",
          "x": 104,
          "y": 360,
          "opts": {
            "color": "#d2b777"
          }
        },
        {
          "name": "flowers",
          "x": 312,
          "y": 376,
          "opts": {
            "color": "#e2c77b"
          }
        },
        {
          "name": "barrel",
          "x": 112,
          "y": 112,
          "opts": {
            "color": "#b49362"
          }
        },
        {
          "name": "barrel",
          "x": 136,
          "y": 112,
          "opts": {
            "color": "#997d55"
          }
        },
        {
          "name": "pot",
          "x": 200,
          "y": 168,
          "opts": {
            "color": "#91a394"
          }
        },
        {
          "name": "lantern",
          "x": 184,
          "y": 144,
          "opts": {
            "size": 0.9
          }
        },
        {
          "name": "pillar",
          "x": 344,
          "y": 88,
          "opts": {
            "color": "#929b82"
          }
        },
        {
          "name": "pillar",
          "x": 456,
          "y": 88,
          "opts": {
            "color": "#929b82"
          }
        },
        {
          "name": "rock",
          "x": 56,
          "y": 280,
          "opts": {
            "size": 1.2
          }
        },
        {
          "name": "grass",
          "x": 440,
          "y": 384,
          "opts": {
            "color": "#8c9668"
          }
        },
        {
          "name": "lantern",
          "x": 360,
          "y": 216,
          "opts": {
            "size": 1.1
          }
        }
      ],
      "entities": [
        {
          "id": "mill:home-sign",
          "definition": "mill:return-sign",
          "x": 280,
          "y": 384
        },
        {
          "id": "mill:archive-gate",
          "definition": "mill:archive-door",
          "x": 384,
          "y": 232
        },
        {
          "id": "mill:store-gate",
          "definition": "mill:store-door",
          "x": 160,
          "y": 216,
          "state": {
            "locked": false
          }
        },
        {
          "id": "mill:ledger-chest",
          "definition": "mill:chest",
          "x": 424,
          "y": 120,
          "inventory": {
            "mill:ledger-leaf": 1,
            "mill:meal-pouch": 1
          }
        },
        {
          "id": "mill:owned-chest",
          "definition": "mill:chest",
          "x": 184,
          "y": 312,
          "owner": "mill:orris",
          "inventory": {
            "mill:oats": 3,
            "mill:work-gloves": 1
          }
        },
        {
          "id": "mill:counterweight-crate",
          "definition": "mill:weight-crate",
          "x": 344,
          "y": 264
        },
        {
          "id": "mill:delivery-crate",
          "definition": "mill:spare-crate",
          "x": 120,
          "y": 264
        },
        {
          "id": "mill:grain-awning",
          "definition": "mill:gleanings",
          "x": 136,
          "y": 312
        },
        {
          "id": "mill:iron-pan",
          "definition": "mill:pan",
          "x": 152,
          "y": 280
        },
        {
          "id": "mill:weighbridge",
          "definition": "mill:docket",
          "x": 248,
          "y": 312
        },
        {
          "id": "mill:shift-post",
          "definition": "mill:shift-bell",
          "x": 328,
          "y": 328
        },
        {
          "id": "mill:shelter",
          "definition": "mill:rest",
          "x": 216,
          "y": 360
        },
        {
          "id": "mill:orris",
          "definition": "mill:orris-actor",
          "kind": "actor",
          "x": 216,
          "y": 280
        },
        {
          "id": "mill:sedge",
          "definition": "mill:sedge-actor",
          "kind": "actor",
          "x": 280,
          "y": 264
        },
        {
          "id": "mill:warden",
          "definition": "mill:warden-actor",
          "kind": "actor",
          "x": 408,
          "y": 168
        }
      ],
      "landmarks": [
        {
          "name": "Ashwick towpath",
          "x": 248,
          "y": 376,
          "bounds": [
            6,
            20,
            14,
            5
          ]
        },
        {
          "name": "The warm pan",
          "x": 176,
          "y": 280,
          "bounds": [
            6,
            15,
            11,
            5
          ]
        },
        {
          "name": "Orris’s millhouse",
          "x": 160,
          "y": 152,
          "bounds": [
            5,
            4,
            10,
            10
          ]
        },
        {
          "name": "The blue-cord archive",
          "x": 400,
          "y": 144,
          "bounds": [
            19,
            3,
            11,
            12
          ]
        },
        {
          "name": "Counterweight yard",
          "x": 328,
          "y": 272,
          "bounds": [
            17,
            15,
            10,
            6
          ]
        }
      ],
      "exits": [
        {
          "id": "mill:return",
          "entity": "mill:home-sign",
          "targetRegion": "ashwick:village",
          "spawn": "arrival"
        }
      ]
    }
  ],
  "placements": [
    {
      "id": "mill:ashwick-sign",
      "definition": "mill:outbound-sign",
      "regionId": "ashwick:village",
      "x": 424,
      "y": 568
    }
  ],
  "actions": [
    {
      "id": "mill:read-docket",
      "effects": [
        {
          "op": "flag",
          "key": "mill:docketRead",
          "value": true
        },
        {
          "op": "xp",
          "amount": 10
        }
      ],
      "once": true,
      "dialogue": "mill:docket-read"
    },
    {
      "id": "mill:hear-sedge",
      "effects": [
        {
          "op": "flag",
          "key": "mill:testimony",
          "value": true
        },
        {
          "op": "xp",
          "amount": 10
        }
      ],
      "once": true,
      "dialogue": "mill:sedge-memory"
    },
    {
      "id": "mill:borrow-key",
      "effects": [
        {
          "op": "item",
          "item": "mill:brass-key",
          "count": 1
        }
      ],
      "once": true,
      "conditions": {
        "op": "flag",
        "key": "mill:testimony",
        "value": true
      },
      "dialogue": "mill:key-loan"
    },
    {
      "id": "mill:read-ledger",
      "effects": [
        {
          "op": "flag",
          "key": "mill:ledgerRead",
          "value": true
        },
        {
          "op": "xp",
          "amount": 5
        }
      ],
      "once": true,
      "conditions": {
        "op": "item",
        "item": "mill:ledger-leaf",
        "count": 1,
        "reason": "Open the archive chest and take the original ledger leaf first."
      },
      "dialogue": "mill:ledger-read"
    },
    {
      "id": "mill:public-account",
      "effects": [
        {
          "op": "flag",
          "key": "mill:publicAccount",
          "value": true
        },
        {
          "op": "quest",
          "quest": "mill:accounts",
          "state": "complete"
        },
        {
          "op": "gold",
          "amount": 8
        },
        {
          "op": "reputation",
          "amount": 1
        },
        {
          "op": "xp",
          "amount": 15
        },
        {
          "op": "item",
          "item": "mill:counterweight",
          "count": 1
        }
      ],
      "once": true,
      "conditions": [
        {
          "op": "not",
          "condition": {
            "op": "quest",
            "quest": "mill:accounts",
            "state": "complete"
          },
          "reason": "The account is already settled."
        },
        {
          "op": "questComplete",
          "quest": "mill:accounts",
          "group": "evidence",
          "reason": "Read the weighbridge docket, hear Sedge, and examine the original ledger."
        }
      ],
      "dialogue": "mill:public-ending"
    },
    {
      "id": "mill:sealed-account",
      "effects": [
        {
          "op": "flag",
          "key": "mill:sealedAccount",
          "value": true
        },
        {
          "op": "quest",
          "quest": "mill:accounts",
          "state": "complete"
        },
        {
          "op": "gold",
          "amount": 4
        },
        {
          "op": "reputation",
          "amount": 2
        },
        {
          "op": "xp",
          "amount": 15
        },
        {
          "op": "item",
          "item": "mill:counterweight",
          "count": 1
        }
      ],
      "once": true,
      "conditions": [
        {
          "op": "not",
          "condition": {
            "op": "quest",
            "quest": "mill:accounts",
            "state": "complete"
          },
          "reason": "The account is already settled."
        },
        {
          "op": "questComplete",
          "quest": "mill:accounts",
          "group": "evidence",
          "reason": "Read the weighbridge docket, hear Sedge, and examine the original ledger."
        }
      ],
      "dialogue": "mill:sealed-ending"
    },
    {
      "id": "mill:quiet-warden",
      "effects": [
        {
          "op": "flag",
          "key": "mill:shiftEnded",
          "value": true
        },
        {
          "op": "event",
          "kind": "story",
          "message": "The warden lowers its counting hand. The night shift is over."
        }
      ],
      "once": true,
      "conditions": {
        "op": "flag",
        "key": "mill:testimony",
        "value": true,
        "reason": "Ask Sedge what happened during the flood week; they know the old shift phrase."
      },
      "dialogue": "mill:quiet-response"
    },
    {
      "id": "mill:unlace-gate",
      "effects": [
        {
          "op": "entity",
          "target": "$target",
          "key": "locked",
          "value": false
        }
      ],
      "conditions": {
        "op": "entity",
        "target": "$target",
        "key": "locked",
        "value": true,
        "reason": "This lock has already yielded."
      },
      "costs": {
        "ability": "mill:unlace"
      },
      "message": "The blue cord falls slack. Open the gate to pass."
    },
    {
      "id": "mill:meal-clock-on",
      "effects": [
        {
          "op": "setStat",
          "key": "millHunger",
          "value": 0
        },
        {
          "op": "flag",
          "key": "mill:mealClock",
          "value": true
        },
        {
          "op": "status",
          "status": "mill:meal-clock",
          "target": "player"
        }
      ],
      "dialogue": "mill:rest-talk"
    },
    {
      "id": "mill:meal-clock-off",
      "effects": [
        {
          "op": "flag",
          "key": "mill:mealClock",
          "value": false
        }
      ],
      "dialogue": "mill:rest-talk"
    }
  ],
  "dialogues": [
    {
      "id": "mill:orris-talk",
      "title": "Orris · keeper of accounts",
      "text": "“A mill is a promise,” Orris says. “Grain goes in, bread comes out. This one started keeping the promises it broke.”\n\nA flood-week debt appears against six households. Sedge carried those sacks. The slate outside records the official weight; the original leaf is in the blue-cord archive. {{millEvidence}} of {{millEvidenceTotal}} accounts compared.\n\n“The blue-banded chest beside the awning is my working stock,” Orris adds. “The grain barrel is for everyone.”",
      "choices": [
        {
          "label": "Ask for the blue-cord key.",
          "action": "mill:borrow-key"
        },
        {
          "label": "Trade for oats, cakes, and a meal pouch.",
          "panel": {
            "name": "trading",
            "params": {
              "vendor": "mill:orris-stall"
            }
          }
        },
        {
          "label": "Read the ledger leaf in my satchel.",
          "action": "mill:read-ledger"
        },
        {
          "label": "Publish the full account · 8 crowns, +1 standing.",
          "action": "mill:public-account",
          "conditions": [
            {
              "op": "not",
              "condition": {
                "op": "quest",
                "quest": "mill:accounts",
                "state": "complete"
              },
              "reason": "The account is already settled."
            },
            {
              "op": "questComplete",
              "quest": "mill:accounts",
              "group": "evidence",
              "reason": "Read the weighbridge docket, hear Sedge, and examine the original ledger."
            }
          ]
        },
        {
          "label": "Settle the debt; seal the household names · 4 crowns, +2 standing.",
          "action": "mill:sealed-account",
          "conditions": [
            {
              "op": "not",
              "condition": {
                "op": "quest",
                "quest": "mill:accounts",
                "state": "complete"
              },
              "reason": "The account is already settled."
            },
            {
              "op": "questComplete",
              "quest": "mill:accounts",
              "group": "evidence",
              "reason": "Read the weighbridge docket, hear Sedge, and examine the original ledger."
            }
          ]
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ],
      "portrait": "mill:orris-portrait",
      "variants": [
        {
          "when": {
            "op": "flag",
            "key": "mill:publicAccount",
            "value": true
          },
          "text": "A fair copy hangs beneath the awning. The false debt is crossed out, and everyone can see whose hands changed it. Orris meets your eye. “The truth is ours to carry now.”\n\n“The blue-banded chest beside the awning is my working stock,” Orris adds. “The grain barrel is for everyone.”"
        },
        {
          "when": {
            "op": "flag",
            "key": "mill:sealedAccount",
            "value": true
          },
          "text": "The debt is struck through, but the household names rest in a sealed packet. Orris taps the wrapper. “A settlement, witnessed. Their hunger need not become a spectacle.”\n\n“The blue-banded chest beside the awning is my working stock,” Orris adds. “The grain barrel is for everyone.”"
        }
      ]
    },
    {
      "id": "mill:sedge-talk",
      "title": "Sedge · the night runner",
      "text": "Sedge knots a rope, tests it, then knots it again. “People call the flood a lost week. I remember every door.”\n\nThey work at the counterweight by day and take their meal at the southern lantern after the late bell. They will walk with you and Wren if asked.",
      "choices": [
        {
          "label": "Tell me who received the flood-week flour.",
          "action": "mill:hear-sedge"
        },
        {
          "label": "Travel with me; there is room beside Wren.",
          "command": {
            "type": "party",
            "member": "mill:sedge",
            "mode": "recruit"
          }
        },
        {
          "label": "Manage companions and shared supplies.",
          "panel": {
            "name": "party"
          }
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ],
      "portrait": "mill:sedge-portrait"
    },
    {
      "id": "mill:sedge-memory",
      "title": "Every door had a name",
      "text": "“Those sacks were relief,” Sedge says. “No charge. Orris told me so. The collector copied the weight into the debt column afterward.”\n\n“The warden remembers orders better than faces. Tell the night bell: The last sack is home. It will stand down.”\n\nThe testimony and its ten experience are recorded once.",
      "choices": [
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ],
      "portrait": "mill:sedge-portrait"
    },
    {
      "id": "mill:key-loan",
      "title": "The blue cord",
      "text": "Orris sets the key in your palm. “Bring back an answer. You may keep the key until you have one.”\n\nThe key fits both doors. Unlock, then open. If the key is elsewhere, the counterweight crate releases the archive catch; Unlace does the same for twelve focus.",
      "choices": [
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ],
      "portrait": "mill:orris-portrait"
    },
    {
      "id": "mill:docket-talk",
      "title": "Weighbridge docket",
      "text": "The slate reads: FLOOD WEEK — SIX SACKS OUT; SIX DEBTS DUE. Under it, an older chalk mark has been rubbed into the grain of the wood.\n\nA docket proves what was counted. It does not prove what was owed.",
      "choices": [
        {
          "label": "Copy the public total into my journal.",
          "action": "mill:read-docket"
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:docket-read",
      "title": "Six sacks, six names",
      "text": "The official total matches the weight of relief flour. The arithmetic is sound; the heading is the lie.\n\nSedge’s testimony and the original ledger can establish who changed it. Ten experience is recorded once.",
      "choices": [
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:ledger-read",
      "title": "The margin that remained",
      "text": "In the original ledger, a narrow left margin reads: GIVEN AGAINST THE FLOOD; NO DEBT. A second hand has ruled a line through it, then carried the weight into six household accounts.\n\nThe records agree on the flour and disagree on the promise. You have enough to ask Orris for a public reckoning or a settlement that protects the household names.",
      "choices": [
        {
          "label": "Return to the accounts with Orris.",
          "action": "mill:orris-talk"
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:public-ending",
      "title": "An account in daylight",
      "text": "Orris hangs the corrected page where every cart must pass. The false debt is canceled. The collector’s mark and the household names remain visible together. Some will thank you; some will wish their hunger had stayed private.\n\nSedge leaves a little brass counterweight in your hand. Eight crowns, one standing, and fifteen experience are awarded once. Ashwick’s bell still waits for its own answer.",
      "choices": [
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:sealed-ending",
      "title": "The debt, without the spectacle",
      "text": "Orris cancels the six debts and seals the names beneath the witnesses’ signatures. The mill must answer for the wrong; the households may decide for themselves who hears their story.\n\nSedge leaves a little brass counterweight in your hand. Four crowns, two standing, and fifteen experience are awarded once. Ashwick’s bell still waits for its own answer.",
      "choices": [
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:archive-gate",
      "title": "Blue-cord archive gate",
      "text": "The gate keeps the flood-week original under lock. Borrow Orris’s key after hearing Sedge, spend twelve focus on Unlace, or slide the counterweight crate west. Each route releases this latch. Open the gate afterward.",
      "choices": [
        {
          "label": "Unlock with the blue-cord key.",
          "command": {
            "type": "verb",
            "target": "mill:archive-gate",
            "verb": "unlock"
          }
        },
        {
          "label": "Unlace this lock · {{millUnlaceCost}} focus.",
          "command": {
            "type": "action",
            "id": "mill:unlace-gate",
            "target": "mill:archive-gate"
          }
        },
        {
          "label": "Open the archive gate.",
          "command": {
            "type": "verb",
            "target": "mill:archive-gate",
            "verb": "open"
          }
        },
        {
          "label": "Close the archive gate.",
          "command": {
            "type": "verb",
            "target": "mill:archive-gate",
            "verb": "close"
          }
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:store-gate",
      "title": "Millhouse door",
      "text": "A dry room and a cooling millstone wait inside. The millhouse latch is separate from the blue-cord archive.",
      "choices": [
        {
          "label": "Open the millhouse door.",
          "command": {
            "type": "verb",
            "target": "mill:store-gate",
            "verb": "open"
          }
        },
        {
          "label": "Close the millhouse door.",
          "command": {
            "type": "verb",
            "target": "mill:store-gate",
            "verb": "close"
          }
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:counterweight-talk",
      "title": "A rope remembers its work",
      "text": "The crate rests on a smooth runner. Its rope climbs to the archive catch. Slide it to the open space on the west side of the yard; no tool or magic is needed.",
      "choices": [
        {
          "label": "Slide the counterweight west; release the archive lock.",
          "command": {
            "type": "verb",
            "target": "mill:counterweight-crate",
            "verb": "move",
            "destination": {
              "x": 328,
              "y": 264
            }
          }
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:spare-crate-talk",
      "title": "Yesterday’s delivery",
      "text": "This crate is empty. It has no rope and no secret purpose, but it is yours to move out of the way.",
      "choices": [
        {
          "label": "Move the empty crate beside the awning.",
          "command": {
            "type": "verb",
            "target": "mill:delivery-crate",
            "verb": "move",
            "destination": {
              "x": 104,
              "y": 264
            }
          }
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:bell-talk",
      "title": "The little night bell",
      "text": "A single stroke calls the counting warden to attention. A sentence can release it, if someone remembers the end of the shift.",
      "choices": [
        {
          "label": "“The last sack is home.” End the vigil peacefully.",
          "action": "mill:quiet-warden",
          "conditions": {
            "op": "flag",
            "key": "mill:testimony",
            "value": true,
            "reason": "Hear Sedge’s flood-week memory first."
          }
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:quiet-response",
      "title": "The last sack is home",
      "text": "The warden opens its empty hand. Flour falls like pale rain. It will keep the archive company now, rather than keep people out.\n\nThe encounter reward is recorded once whether you ended the vigil with a phrase or a fight.",
      "choices": [
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:pan-talk",
      "title": "The iron pan",
      "text": "Two handfuls of oats make a salt-crust cake. Gather free oats from the travelers’ awning whenever your supplies run low. Eating a cake restores eighteen vitality.",
      "choices": [
        {
          "label": "Bake at this pan.",
          "panel": {
            "name": "crafting",
            "params": {
              "station": "mill:iron-pan"
            }
          }
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    },
    {
      "id": "mill:rest-talk",
      "title": "A meal beneath the awning",
      "text": "There is water enough for every traveler. Recover here when hurt or out of focus; discoveries, doors, defeated enemies, and accounts remain as you left them.\n\nOptional meal clock: {{millMealMode}}. Hunger marks: {{millHunger}}. Enable it for a ten-minute trial: the counter rises once every twenty seconds spent at the mill. It causes no damage and stops counting in Ashwick. An oatcake resets the count. Recovery clears timed statuses, so enable the clock again afterward if desired.",
      "choices": [
        {
          "label": "Recover vitality and focus at the safe towpath.",
          "command": {
            "type": "recover"
          }
        },
        {
          "label": "Try the optional mill meal clock.",
          "action": "mill:meal-clock-on"
        },
        {
          "label": "Turn the optional meal clock off.",
          "action": "mill:meal-clock-off"
        },
        {
          "label": "Leave the matter here.",
          "action": "close"
        }
      ]
    }
  ],
  "quests": [
    {
      "id": "mill:accounts",
      "title": "The Mill Ledger",
      "initialState": "active",
      "visibleWhen": {
        "op": "any",
        "conditions": [
          {
            "op": "flag",
            "key": "mill:visited",
            "value": true
          },
          {
            "op": "region",
            "id": "mill:ledger"
          }
        ]
      },
      "failurePolicy": "No irreversible resource failure: oats renew, recovery is free, the archive counterweight requires no consumable, and either account resolution completes this independent quest.",
      "objectives": [
        {
          "id": "docket",
          "title": "Copy the official total",
          "group": "evidence",
          "condition": {
            "op": "flag",
            "key": "mill:docketRead",
            "value": true
          },
          "text": "Read the weighbridge docket beside the travelers’ awning.",
          "completedText": "The docket turns six relief sacks into six debts."
        },
        {
          "id": "witness",
          "title": "Hear the runner’s account",
          "group": "evidence",
          "condition": {
            "op": "flag",
            "key": "mill:testimony",
            "value": true
          },
          "text": "Ask Sedge about the flood-week deliveries.",
          "completedText": "Sedge remembers relief flour delivered without a charge."
        },
        {
          "id": "original",
          "title": "Read the original ledger",
          "group": "evidence",
          "condition": {
            "op": "flag",
            "key": "mill:ledgerRead",
            "value": true
          },
          "text": "Enter the blue-cord archive, take its ledger leaf, and read it with Orris.",
          "completedText": "The original margin proves the sacks were gifts."
        },
        {
          "id": "settlement",
          "title": "Choose who carries the truth",
          "condition": {
            "op": "quest",
            "quest": "mill:accounts",
            "state": "complete"
          },
          "text": "With all three accounts compared, ask Orris for publication or a sealed settlement.",
          "completedText": {
            "cases": [
              {
                "when": {
                  "op": "flag",
                  "key": "mill:publicAccount",
                  "value": true
                },
                "text": "The full corrected account hangs in daylight."
              }
            ],
            "default": "The debts are canceled and the household names are sealed."
          }
        }
      ]
    }
  ],
  "recipes": [
    {
      "id": "mill:salt-cake",
      "name": "Salt-crust oatcake",
      "description": "Two handfuls of renewable oats, a pinch of river salt, and the iron pan.",
      "station": "mill:pan",
      "ingredients": {
        "mill:oats": 2
      },
      "outputs": {
        "mill:oatcake": 1
      }
    }
  ],
  "vendors": [
    {
      "id": "mill:orris-stall",
      "name": "Orris’s fair measure",
      "entity": "mill:orris",
      "stock": {
        "mill:oats": {
          "count": 6,
          "price": 1,
          "sellPrice": 0
        },
        "mill:oatcake": {
          "count": 4,
          "price": 3,
          "sellPrice": 1
        },
        "mill:meal-pouch": {
          "count": 2,
          "price": 5,
          "sellPrice": 2
        }
      },
      "buyback": true,
      "restockSeconds": 120
    }
  ],
  "abilities": [
    {
      "id": "mill:unlace",
      "name": "Unlace",
      "description": "Release a locked object for twelve focus. The object must still be opened afterward.",
      "target": "object",
      "range": 48,
      "requiresLearned": false,
      "costs": {
        "mana": 12
      },
      "conditions": {
        "op": "entity",
        "target": "$target",
        "key": "locked",
        "value": true,
        "reason": "Choose a locked object within reach."
      },
      "effects": [
        {
          "op": "entity",
          "target": "$target",
          "key": "locked",
          "value": false
        }
      ],
      "animation": "cast",
      "sfx": "powerup"
    },
    {
      "id": "mill:lay-dust",
      "name": "Lay the Dust",
      "description": "Learned at 20 experience. For six focus, soften one enemy’s blows and slow it for twelve seconds.",
      "target": "enemy",
      "range": 88,
      "requiresLearned": true,
      "costs": {
        "mana": 6
      },
      "effects": [
        {
          "op": "status",
          "status": "mill:dustbound",
          "target": "$target"
        }
      ],
      "animation": "cast",
      "sfx": "powerup"
    }
  ],
  "statuses": [
    {
      "id": "mill:dustbound",
      "name": "Dustbound",
      "description": "The mill’s flour settles heavily: damage −7 and speed −24 for twelve seconds.",
      "duration": 12,
      "stacking": "refresh",
      "modifiers": {
        "damage": -7,
        "speed": -24
      }
    },
    {
      "id": "mill:meal-clock",
      "name": "Optional mill meal clock",
      "description": "Opt-in hunger marks rise every twenty seconds only at the mill while enabled. Cakes reset the count. No damage; no Ashwick drain.",
      "duration": 600,
      "stacking": "refresh",
      "periodic": {
        "interval": 20,
        "effects": [
          {
            "op": "when",
            "condition": [
              {
                "op": "flag",
                "key": "mill:mealClock",
                "value": true
              },
              {
                "op": "region",
                "id": "mill:ledger"
              }
            ],
            "then": [
              {
                "op": "addStat",
                "key": "millHunger",
                "value": 1
              }
            ]
          }
        ]
      }
    }
  ],
  "encounters": [
    {
      "id": "mill:night-count",
      "regionId": "mill:ledger",
      "members": [
        "mill:warden"
      ],
      "activation": {
        "op": "region",
        "id": "mill:ledger"
      },
      "resolution": {
        "op": "flag",
        "key": "mill:shiftEnded",
        "value": true
      },
      "effects": [
        {
          "op": "flag",
          "key": "mill:vigilEnded",
          "value": true
        },
        {
          "op": "xp",
          "amount": 10
        }
      ]
    }
  ]
});

/* SOURCE: content/extension-demo/pack.js */
/* A separate, playable extension proof. This pack adds one optional remembrance
 * beside Ashwick's quay. It does not alter the original investigation or endings. */
(() => {
  'use strict';
  (globalThis.HBPacks ||= []).push({
    id:'inscription',version:'1.0.0',
    items:[{
      id:'inscription:remembrance',name:'A name remembered',icon:'book',weight:0,stackable:true,
      description:'A rubbing of the quay stone: “What the tide takes, let the living remember.” A keepsake, freely carried.'
    }],
    prefabs:[{
      id:'inscription:memory-stone',name:'The remembrance stone',type:'memorial',icon:'book',range:32,
      description:'Names once cut into this weathered quay stone have faded. Trace a remembrance with one sprig of silverleaf; its sap catches the light. The garden provides fresh sprigs.',
      verbs:['inspect','inscribe'],initialState:{inscribed:false},
      costs:{items:{'ashwick:herb':1}},
      inscription:{
        words:'What the tide takes, let the living remember.',
        message:'Silverleaf brightens the old letters. You keep a rubbing: “What the tide takes, let the living remember.”',
        effects:[{op:'item',item:'inscription:remembrance',count:1,owner:'$actor'}]
      },
      visual:{kind:'inscription:stone',size:.65},collider:{w:16,h:16},pick:{height:20,range:13}
    }],
    placements:[{id:'inscription:quay-stone',definition:'inscription:memory-stone',kind:'prefab',regionId:'ashwick:village',x:424,y:536,z:0}]
  });
})();

/* SOURCE: src/rpg/core.js */
/* Hollow Bell optional RPG toolkit. Pure data simulation; no renderer dependency. */
(function (root) {
  "use strict";
  const KINDS = [
    "items",
    "prefabs",
    "actors",
    "regions",
    "dialogues",
    "actions",
    "quests",
    "recipes",
    "vendors",
    "abilities",
    "statuses",
    "assets",
    "encounters",
  ];
  const CONDITION_OPS = [
    "all",
    "any",
    "not",
    "flag",
    "state",
    "canPay",
    "stat",
    "item",
    "party",
    "entity",
    "quest",
    "region",
    "learned",
    "countFlags",
    "objectives",
    "questComplete",
    "true",
    "false",
  ];
  const EFFECT_OPS = [
    "flag",
    "setStat",
    "addStat",
    "item",
    "gold",
    "reputation",
    "entity",
    "move",
    "quest",
    "learn",
    "party",
    "travel",
    "status",
    "damage",
    "heal",
    "xp",
    "ending",
    "dialogue",
    "event",
    "when",
    "craft",
    "gather",
  ];
  const VERB_OPS = [
    "inspect",
    "read",
    "open",
    "close",
    "lock",
    "unlock",
    "take",
    "drop",
    "give",
    "move",
    "use",
    "gather",
    "rest",
    "activate",
  ];
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const object = (value) =>
    value !== null && typeof value === "object" && !Array.isArray(value);
  const finite = (value) => typeof value === "number" && Number.isFinite(value);
  const fail = (message) => {
    throw new Error(message);
  };
  const safeKey = (key) =>
    typeof key === "string" &&
    !["__proto__", "prototype", "constructor"].includes(key);
  const merge = (a, b) => {
    for (const [key, value] of Object.entries(b || {})) {
      if (!safeKey(key)) fail("Unsafe property: " + key);
      a[key] =
        object(value) && object(a[key]) ? merge(a[key], value) : clone(value);
    }
    return a;
  };
  function createRegistry(
    packs = root.HBPacks || [],
    extensions = root.HBExtensions || {},
    options = {},
  ) {
    const maps = {},
      aliases = {},
      diagnostics = [],
      settings = {},
      initial = {},
      list = Array.isArray(packs) ? packs : [packs];
    for (const kind of KINDS) {
      maps[kind] = new Map();
      aliases[kind] = new Map();
    }
    const error = (path, message) =>
      diagnostics.push({ path, message, severity: "error" });
    const ext = {
      conditions: {},
      effects: {},
      verbs: {},
      behaviors: {},
      renderers: {},
    };
    for (const entry of Array.isArray(extensions) ? extensions : [extensions])
      for (const kind of Object.keys(ext))
        Object.assign(ext[kind], entry?.[kind] || {});
    const ids = new Set();
    list.forEach((pack, index) => {
      if (!object(pack) || typeof pack.id !== "string") {
        error(`packs[${index}]`, "Pack needs a string id.");
        return;
      }
      if (ids.has(pack.id)) error(pack.id, "Duplicate pack id.");
      ids.add(pack.id);
      merge(settings, pack.settings);
      merge(initial, pack.initial);
      for (const kind of KINDS) {
        if (pack[kind] != null && !Array.isArray(pack[kind])) {
          error(`${pack.id}.${kind}`, "Expected an array.");
          continue;
        }
        for (const [i, def] of (pack[kind] || []).entries()) {
          const path = `${pack.id}.${kind}[${i}]`;
          if (
            !object(def) ||
            typeof def.id !== "string" ||
            !def.id.includes(":")
          ) {
            error(
              path + ".id",
              "Definition needs a namespaced id, e.g. pack:name.",
            );
            continue;
          }
          if (maps[kind].has(def.id) || aliases[kind].has(def.id)) {
            error(path + ".id", "Duplicate definition " + def.id);
            continue;
          }
          maps[kind].set(def.id, def);
          for (const alias of def.aliases || []) {
            if (
              !safeKey(alias) ||
              maps[kind].has(alias) ||
              aliases[kind].has(alias)
            )
              error(path + ".aliases", "Duplicate/unsafe alias " + alias);
            else aliases[kind].set(alias, def.id);
          }
        }
      }
    });
    if (!maps.prefabs.has("rpg:ground-loot"))
      maps.prefabs.set("rpg:ground-loot", {
        id: "rpg:ground-loot",
        name: "Dropped supplies",
        description: "Supplies placed carefully on the ground.",
        verbs: ["inspect", "take", "give"],
        capacity: 9999,
        range: 36,
        visual: { kind: "prop", name: "crate", color: "#ad8955" },
        pick: { height: 8, range: 12 },
      });
    function walk(value, path) {
      if (!value || typeof value !== "object") return;
      if (
        value.op &&
        !CONDITION_OPS.includes(value.op) &&
        !EFFECT_OPS.includes(value.op) &&
        !ext.conditions[value.op] &&
        !ext.effects[value.op]
      )
        error(path + ".op", "Unknown operation " + value.op);
      if (Array.isArray(value))
        value.forEach((v, i) => walk(v, `${path}[${i}]`));
      else for (const [k, v] of Object.entries(value)) walk(v, path + "." + k);
    }
    list.forEach((p) => walk(p, p.id || "pack"));
    const registry = {
      packs: list,
      extensions: ext,
      settings,
      initial,
      kinds: KINDS,
      diagnostics,
      resolve(kind, id) {
        return aliases[kind]?.get(id) || id;
      },
      get(kind, id) {
        return maps[kind]?.get(this.resolve(kind, id));
      },
      require(kind, id) {
        const d = this.get(kind, id);
        if (!d) fail(`Unknown ${kind} reference: ${id}`);
        return d;
      },
      all(kind) {
        if (!maps[kind]) fail("Unknown definition kind " + kind);
        return [...maps[kind].values()];
      },
      itemKey(id) {
        const d = this.require("items", id);
        return d.aliases?.[0] || d.id;
      },
    };
    if (options.strict !== false && diagnostics.length) {
      const e = new Error(
        diagnostics.map((d) => `${d.path}: ${d.message}`).join("\n"),
      );
      e.diagnostics = diagnostics;
      throw e;
    }
    return registry;
  }
  function createState(registry) {
    const first = registry.all("regions")[0],
      initial = registry.initial;
    const state = merge(
      {
        version: 1,
        schemaVersion: 2,
        packVersions: {},
        flags: {},
        inventory: {},
        hp: 100,
        mana: 60,
        gold: 0,
        reputation: 0,
        ending: null,
        time: 0,
        player: { x: first?.spawn?.x || 0, y: first?.spawn?.y || 0 },
        enemies: [],
        regionId: first?.id || null,
        entities: {},
        party: [],
        quests: {},
        trackedQuest: null,
        statuses: [],
        equipment: {},
        containers: {},
        itemInstances: {},
        learned: [],
        xp: 0,
        level: 1,
        completedActions: {},
        vendors: {},
        encounters: {},
        rng: 123456789,
        sequence: 0,
      },
      initial,
    );
    state.schemaVersion = 2;
    ensureContent(registry, state);
    return state;
  }
  function ensureContent(registry, state) {
    state.packVersions ||= {};
    state.entities ||= {};
    state.containers ||= {};
    state.itemInstances ||= {};
    state.vendors ||= {};
    state.quests ||= {};
    state.trackedQuest ??= null;
    state.encounters ||= {};
    for (const pack of registry.packs)
      state.packVersions[pack.id] = pack.version || "1.0.0";
    const placements = registry
      .all("regions")
      .flatMap((region) =>
        (region.entities || []).map((e) => ({ ...e, regionId: region.id })),
      )
      .concat(registry.packs.flatMap((p) => p.placements || []));
    for (const placed of placements) {
      if (!placed.id || !safeKey(placed.id))
        fail("Placed entity needs a safe id.");
      if (state.entities[placed.id]) continue;
      const def =
        registry.get("actors", placed.definition) ||
        registry.get("prefabs", placed.definition);
      if (!def)
        fail(`Entity ${placed.id}: missing definition ${placed.definition}`);
      const kind = registry.get("actors", placed.definition)
        ? "actor"
        : "prefab";
      const e = merge(
        {
          id: placed.id,
          definition: def.id,
          kind,
          regionId: placed.regionId,
          x: placed.x || 0,
          y: placed.y || 0,
          z: placed.z || 0,
          state: clone(def.initialState || {}),
          inventory: clone(def.inventory || {}),
          equipment: {},
          hp: def.stats?.hp ?? def.stats?.maxHp ?? 100,
          mana: def.stats?.mana ?? def.stats?.maxMana ?? 0,
          owner: def.owner || null,
        },
        placed,
      );
      state.entities[e.id] = e;
    }
    for (const vendor of registry.all("vendors"))
      if (!state.vendors[vendor.id])
        state.vendors[vendor.id] = {
          stock: Object.fromEntries(
            Object.entries(vendor.stock || {}).map(([id, v]) => [
              registry.itemKey(id),
              typeof v === "number" ? v : v.count,
            ]),
          ),
          nextRestock: (state.time || 0) + (vendor.restockSeconds || 0),
        };
    for (const quest of registry.all("quests"))
      if (!state.quests[quest.id])
        state.quests[quest.id] = {
          state: quest.initialState || "active",
          rewarded: [],
        };
    for (const encounter of registry.all("encounters"))
      if (!state.encounters[encounter.id])
        state.encounters[encounter.id] = {
          active: false,
          resolved: false,
          cycle: 0,
          rewarded: false,
          nextRespawn: null,
        };
    const instantiateInventory = (inv, owner) => {
      for (const [id, n] of Object.entries(inv || {})) {
        const d = registry.get("items", id);
        if (d?.stackable === false && n > 0) {
          delete inv[id];
          for (let i = 0; i < n; i++) {
            const instance = `item:${++state.sequence}`;
            state.itemInstances[instance] = {
              id: instance,
              definition: d.id,
              owner,
              ...(d.container ? { contents: {} } : {}),
            };
            inv[instance] = 1;
          }
        }
      }
    };
    instantiateInventory(state.inventory, "player");
    for (const e of Object.values(state.entities))
      instantiateInventory(e.inventory, e.id);
    return state;
  }
  function createRuntime(registry, inputState, onChange = () => {}) {
    const state = inputState || createState(registry);
    ensureContent(registry, state);
    let adapter = {},
      running = false,
      activeDraft = null,
      activeEvents = null,
      activeContext = null,
      effectCount = 0,
      activeDialogue,
      failedDialogue;
    const history = [];
    let encounterClock = 0;
    const current = () => activeDraft || state;
    const resolve = (id, context = activeContext || {}) =>
      id === "$actor"
        ? context.actor || "player"
        : !id || id === "$target"
          ? context.target
          : id;
    const entity = (id, s = current()) =>
      id === "player" ? s.player : s.entities[id];
    const definition = (e) =>
      e &&
      registry.get(e.kind === "actor" ? "actors" : "prefabs", e.definition);
    const actorState = (id = "player", s = current()) =>
      id === "player" ? s : s.entities[id] || fail("Unknown actor " + id);
    const inventory = (owner = "player", s = current()) => {
      if (owner === "player") return s.inventory;
      if (s.itemInstances[owner])
        return (
          s.itemInstances[owner].contents ||
          (s.itemInstances[owner].contents = {})
        );
      if (s.entities[owner]) return s.entities[owner].inventory;
      if (s.containers[owner]) return s.containers[owner].inventory;
      fail("Unknown inventory owner " + owner);
    };
    const itemDef = (id) =>
      registry.get("items", current().itemInstances[id]?.definition || id);
    const itemKey = (id) =>
      current().itemInstances[id] ? id : registry.itemKey(id);
    const count = (id, owner = "player", s = current()) => {
      const inv = inventory(owner, s),
        d = registry.get("items", id);
      if (d?.stackable === false && !s.itemInstances[id])
        return Object.entries(inv).reduce(
          (n, [instance, qty]) =>
            n + (s.itemInstances[instance]?.definition === d.id ? qty : 0),
          0,
        );
      return Math.max(
        0,
        Number(inv[s.itemInstances[id] ? id : registry.itemKey(id)]) || 0,
      );
    };
    const baseStat = (key, actor = "player", s = current()) => {
      const a = actorState(actor, s);
      const d = actor === "player" ? registry.settings.player || {} : definition(a) || {};
      return Number(a[key] ?? d.stats?.[key] ??
        (key === "maxHp" ? d.stats?.hp : undefined) ??
        (key === "maxMana" ? d.stats?.mana : undefined) ??
        ({ maxHp: 100, maxMana: 60, damage: 23 }[key] || 0));
    };
    const stat = (key, actor = "player", s = current(), baseOverride) => {
      const a = actorState(actor, s), base = baseOverride ?? baseStat(key, actor, s);
      const eq = actor === "player" ? s.equipment : a.equipment || {};
      let bonus = Object.values(eq).reduce(
        (n, id) => n + (itemDef(id)?.equipment?.modifiers?.[key] || 0),
        0,
      );
      for (const status of s.statuses || [])
        if (status.target === actor)
          bonus +=
            (registry.get("statuses", status.id)?.modifiers?.[key] || 0) *
            status.stacks;
      return Number(base) + bonus;
    };
    function check(c, context = {}) {
      if (c == null || c === true) return true;
      if (c === false) return false;
      if (Array.isArray(c)) return c.every((v) => check(v, context));
      const s = current(),
        target = resolve(c.target, context),
        actor = resolve(c.actor || "$actor", context) || "player";
      switch (c.op) {
        case "true":
          return true;
        case "false":
          return false;
        case "all":
          return (c.conditions || []).every((v) => check(v, context));
        case "any":
          return (c.conditions || []).some((v) => check(v, context));
        case "not":
          return !check(c.condition, context);
        case "flag":
          return (s.flags[c.key] ?? false) === (c.value ?? true);
        case "state":
          return compare(s[c.key], c.compare || "eq", c.value);
        case "canPay": {
          const costs = resolveCosts(c.costs);
          return (
            ["mana", "gold", "hp"].every(
              (k) => !(costs[k] > 0) || (actorState(actor)[k] || 0) >= costs[k],
            ) &&
            Object.entries(costs.items || {}).every(
              ([id, n]) => count(id, actor) >= n,
            )
          );
        }
        case "stat": {
          const value = stat(c.key, actor);
          return compare(value, c.compare || "gte", c.value);
        }
        case "item":
          return (
            count(
              c.item,
              c.owner ? resolve(c.owner, context) : context.actor || "player",
            ) >= (c.count ?? 1)
          );
        case "party":
          return s.party.some(
            (p) => (p.id || p) === c.member && (!c.mode || p.mode === c.mode),
          );
        case "entity":
          return (
            (entity(target)?.state?.[c.key] ?? false) === (c.value ?? true)
          );
        case "quest":
          return (
            s.quests[registry.resolve("quests", c.quest)]?.state === c.state
          );
        case "region":
          return s.regionId === registry.resolve("regions", c.id);
        case "learned":
          return s.learned.includes(registry.resolve("abilities", c.ability));
        case "countFlags": {
          const n = (c.keys || []).filter((k) => s.flags[k]).length;
          return n >= (c.min || 0) && (c.max == null || n <= c.max);
        }
        case "objectives":
        case "questComplete": {
          const o =
            registry
              .require("quests", c.quest)
              .objectives?.filter((o) => !c.group || o.group === c.group) || [];
          const n = o.filter((o) => check(o.condition, context)).length;
          return c.op === "questComplete"
            ? o.length > 0 && n === o.length
            : n >= (c.min || 0);
        }
        default:
          if (registry.extensions.conditions[c.op])
            return !!registry.extensions.conditions[c.op](
              extensionContext(context),
              c,
            );
          fail("Unknown condition operation " + c.op);
      }
    }
    function compare(a, op, b) {
      const fn = {
        gte: (a, b) => a >= b,
        gt: (a, b) => a > b,
        lte: (a, b) => a <= b,
        lt: (a, b) => a < b,
        eq: (a, b) => a === b,
        ne: (a, b) => a !== b,
      }[op];
      if (!fn) fail("Unknown comparison " + op);
      return fn(a, b);
    }
    function explain(c, context = {}) {
      if (check(c, context)) return "";
      if (c?.reason) return c.reason;
      if (Array.isArray(c))
        return c
          .map((v) => explain(v, context))
          .filter(Boolean)
          .join(" ");
      if (c?.op === "all")
        return (c.conditions || [])
          .map((v) => explain(v, context))
          .filter(Boolean)
          .join(" ");
      if (c?.op === "any")
        return (c.conditions || [])
          .map((v) => explain(v, context))
          .filter(Boolean)
          .join(" Or: ");
      if (c?.op === "item")
        return `Requires ${c.count ?? 1} ${registry.get("items", c.item)?.name || c.item}.`;
      if (c?.op === "stat")
        return `Requires ${c.key} ${c.compare || "gte"} ${c.value}.`;
      if (c?.op === "learned") return "Learn this ability first.";
      return "Requirements have not been met.";
    }
    function emit(event) {
      if (!activeEvents) fail("Events require a transaction.");
      activeEvents.push(
        typeof event === "string" ? { kind: "story", message: event } : event,
      );
    }
    function extensionContext(context) {
      return {
        state: current(),
        registry,
        context,
        runtime: api,
        emit,
        check: (c) => check(c, context),
        apply: (e) => apply(e, context),
      };
    }
    function removeEmptyItem(owner, key, preserveInstance = false) {
      const s = current(),
        inv = inventory(owner);
      if ((inv[key] || 0) > 0) return;
      const eq =
        owner === "player" ? s.equipment : s.entities[owner]?.equipment;
      for (const slot of Object.keys(eq || {}))
        if (eq[slot] === key) delete eq[slot];
      const instance = s.itemInstances[key];
      if (instance && !preserveInstance) {
        if (Object.values(instance.contents || {}).some((n) => n > 0))
          fail("Empty the container first.");
        delete s.itemInstances[key];
      }
      // Stack zero counts are retained for legacy projections; unique identities must not dangle.
      if (instance) delete inv[key];
    }
    function addItem(
      id,
      amount,
      owner = "player",
      { preserveInstance = false } = {},
    ) {
      if (!Number.isInteger(amount)) fail("Item quantity must be an integer.");
      const def = itemDef(id);
      if (!def) fail("Unknown item " + id);
      const inv = inventory(owner),
        key = itemKey(id);
      if (
        def.stackable === false &&
        !current().itemInstances[id] &&
        amount < 0
      ) {
        const instances = Object.keys(inv).filter(
          (instance) =>
            current().itemInstances[instance]?.definition === def.id &&
            inv[instance] > 0,
        );
        if (instances.length < -amount)
          fail("Not enough " + (def.name || id) + ".");
        for (const instance of instances.slice(0, -amount))
          addItem(instance, -1, owner);
        return;
      }
      const next = (inv[key] || 0) + amount;
      if (next < 0) fail("Not enough " + (def.name || id) + ".");
      if (
        def.stackable === false &&
        !current().itemInstances[id] &&
        amount > 0
      ) {
        for (let i = 0; i < amount; i++) {
          const instance = `item:${++current().sequence}`;
          current().itemInstances[instance] = {
            id: instance,
            definition: def.id,
            owner,
            ...(def.container ? { contents: {} } : {}),
          };
          inv[instance] = 1;
        }
      } else {
        if (current().itemInstances[id] && next > 1)
          fail("Unique items cannot stack.");
        inv[key] = next;
        if (amount < 0 && next === 0)
          removeEmptyItem(owner, key, preserveInstance);
      }
      capacity(owner);
    }
    function itemWeight(id, seen = new Set()) {
      if (seen.has(id)) fail("Container ownership cycle.");
      const next = new Set(seen);
      next.add(id);
      const item = current().itemInstances[id],
        base = itemDef(id)?.weight ?? 1;
      return (
        base +
        Object.entries(item?.contents || {}).reduce(
          (n, [child, count]) => n + count * itemWeight(child, next),
          0,
        )
      );
    }
    function capacity(owner) {
      const s = current();
      let cursor = owner,
        depth = 0;
      while (cursor) {
        const e = entity(cursor),
          item = s.itemInstances[cursor],
          d = item ? registry.require("items", item.definition) : definition(e),
          cap =
            d?.container?.capacity ??
            d?.capacity ??
            registry.settings.inventoryCapacity ??
            Infinity;
        const used = Object.entries(inventory(cursor)).reduce(
          (n, [id, c]) => n + c * itemWeight(id),
          0,
        );
        if (used > cap) fail("That container cannot hold this weight.");
        cursor = item?.owner;
        if (++depth > 5) fail("Containers support at most four nested levels.");
      }
    }
    function destination(target, x, y, regionId) {
      const region = registry.require(
          "regions",
          regionId || current().regionId,
        ),
        tile = region.tileSize || 16;
      if (
        !finite(x) ||
        !finite(y) ||
        x < 0 ||
        y < 0 ||
        x >= region.width * tile ||
        y >= region.height * tile
      )
        fail("Destination lies outside the region.");
      if (
        (region.blocked || []).some(
          (t) => t.x === Math.floor(x / tile) && t.y === Math.floor(y / tile),
        )
      )
        fail("Destination is blocked.");
      if (
        adapter.canPlace &&
        adapter.canPlace(target, x, y, region.id, current()) === false
      )
        fail("Destination is blocked.");
    }
    function nearby(target, context = {}, range) {
      if (!target) fail("Choose a target.");
      const s = current(),
        a = entity(context.actor || "player"),
        b = entity(target);
      if (!b) fail("Unknown target " + target);
      if (target === "player" && (context.actor || "player") === "player")
        return;
      if (target !== "player" && b.regionId !== s.regionId)
        fail("That target is in another region.");
      if (
        adapter.canReach &&
        !adapter.canReach(
          context.actor || "player",
          target,
          range ?? definition(b)?.range ?? definition(b)?.pick?.range ?? 38,
          s,
        )
      )
        fail("Move closer to the target.");
      if (adapter.sight && !adapter.sight(context.actor || "player", target, s))
        fail("The target is out of sight.");
    }
    function resolveCosts(costs = {}) {
      if (costs.ability) {
        const source = registry.require("abilities", costs.ability).costs || {};
        if (source.ability) fail("Recursive ability cost reference.");
        return {
          ...source,
          ...costs,
          items: { ...(source.items || {}), ...(costs.items || {}) },
        };
      }
      return costs;
    }
    function pay(costs = {}, context = {}) {
      costs = resolveCosts(costs);
      const a = actorState(context.actor || "player");
      for (const key of ["mana", "gold", "hp"])
        if (costs[key] != null) {
          if (!finite(costs[key]) || costs[key] < 0)
            fail("Invalid " + key + " cost.");
          if ((a[key] || 0) < costs[key]) fail(`Not enough ${key}.`);
          a[key] -= costs[key];
        }
      for (const [id, n] of Object.entries(costs.items || {})) {
        if (!Number.isInteger(n) || n < 0) fail("Invalid item cost.");
        addItem(id, -n, context.actor || "player");
      }
    }
    function apply(effects, context = {}) {
      if (!activeDraft) fail("Effects require a transaction.");
      for (const e of Array.isArray(effects) ? effects : [effects]) {
        if (!e) continue;
        if (++effectCount > 512)
          fail("Effect limit exceeded; possible recursive extension.");
        const s = current(),
          target = resolve(e.target, context),
          actor = resolve(e.actor || "$actor", context) || "player";
        switch (e.op) {
          case "flag":
            if (!safeKey(e.key)) fail("Unsafe flag key");
            s.flags[e.key] =
              e.timeOffset != null ? s.time + e.timeOffset : (e.value ?? true);
            break;
          case "setStat":
          case "addStat": {
            const a = actorState(actor);
            if (!finite(e.value) || !safeKey(e.key))
              fail("Invalid stat effect.");
            a[e.key] =
              e.op === "setStat" ? e.value : baseStat(e.key, actor) + e.value;
            if (["hp", "mana", "gold", "xp"].includes(e.key) && a[e.key] < 0)
              fail("Stat cannot be negative.");
            break;
          }
          case "item":
            addItem(
              e.item,
              e.count ?? 1,
              e.owner ? resolve(e.owner, context) : context.actor || "player",
            );
            break;
          case "gold":
          case "reputation":
            if (!finite(e.amount)) fail("Invalid amount.");
            s[e.op] += e.amount;
            if (e.op === "gold" && s.gold < 0) fail("Not enough gold.");
            break;
          case "entity": {
            const t = entity(target);
            if (!t) fail("Unknown entity " + target);
            if (!safeKey(e.key)) fail("Unsafe entity field.");
            t.state[e.key] = clone(e.value);
            emit({ kind: "entity", target });
            break;
          }
          case "move": {
            const t = entity(target);
            if (!t) fail("Unknown entity " + target);
            destination(target, e.x, e.y, e.regionId || t.regionId);
            t.x = e.x;
            t.y = e.y;
            if (e.regionId)
              t.regionId = registry.resolve("regions", e.regionId);
            emit({ kind: "move", target });
            break;
          }
          case "quest": {
            const id = registry.require("quests", e.quest).id;
            s.quests[id] ||= { state: "active", rewarded: [] };
            s.quests[id].state = e.state;
            break;
          }
          case "learn": {
            const id = registry.require("abilities", e.ability).id;
            if (!s.learned.includes(id)) s.learned.push(id);
            break;
          }
          case "party":
            party(e.member, e.mode || "recruit");
            break;
          case "travel":
            travel(e.region, e.spawn);
            break;
          case "status":
            status(e.status, target || actor, e.duration);
            break;
          case "damage":
            damage(target || actor, e.amount, context.actor);
            break;
          case "heal": {
            const t = actorState(target || actor);
            if (!finite(e.amount) || e.amount < 0) fail("Invalid healing.");
            t.hp = Math.min(stat("maxHp", target || actor), t.hp + e.amount);
            break;
          }
          case "xp":
            grantXP(e.amount, actor);
            break;
          case "ending":
            if (!s.ending) s.ending = e.value;
            break;
          case "dialogue":
            registry.require("dialogues", e.id);
            activeDialogue = e.id;
            break;
          case "event":
            emit({
              message: e.message || "",
              kind: e.kind || "story",
              ...(e.data || {}),
            });
            break;
          case "when":
            apply(check(e.condition, context) ? e.then : e.else, context);
            break;
          case "craft":
            craft(
              {
                recipe: e.recipe,
                station: resolve(e.station, context) || context.target,
              },
              context,
            );
            break;
          case "gather":
            verb({ target: target, verb: "gather" }, { ...context, target });
            break;
          default:
            if (registry.extensions.effects[e.op])
              registry.extensions.effects[e.op](extensionContext(context), e);
            else fail("Unknown effect operation " + e.op);
        }
      }
    }
    function party(member, mode) {
      const s = current(),
        e = s.entities[member],
        d = definition(e);
      if (!e || !d?.companion) fail("This actor cannot join the party.");
      const existing = s.party.find((p) => p.id === member);
      if (mode === "recruit") {
        if (existing) return;
        if (s.party.length >= (registry.settings.partyLimit || 3))
          fail("The party is full.");
        s.party.push({ id: member, mode: "follow" });
      } else if (mode === "dismiss")
        s.party = s.party.filter((p) => p.id !== member);
      else if (["follow", "wait", "assist", "defensive"].includes(mode)) {
        if (!existing) fail("Recruit this companion first.");
        if (mode === "assist" || mode === "defensive") existing.stance = mode;
        else existing.mode = mode;
      } else fail("Unknown party mode " + mode);
      for (const pack of registry.packs)
        for (const rule of pack.legacy?.party || [])
          if (rule.member === member)
            s.flags[rule.flag] = s.party.some((p) => p.id === member);
      emit({ kind: "party", target: member, mode });
    }
    function travel(regionId, spawnName) {
      const s = current(),
        r = registry.require("regions", regionId),
        spawn =
          typeof spawnName === "object"
            ? spawnName
            : r.spawns?.[spawnName] || (!spawnName ? r.spawn : null);
      if (!spawn) fail("Unknown destination spawn " + spawnName);
      destination("player", spawn.x, spawn.y, r.id);
      const from = s.regionId;
      s.regionId = r.id;
      s.player = { ...s.player, x: spawn.x, y: spawn.y };
      for (const [i, p] of s.party.entries())
        if (p.mode !== "wait") {
          const e = s.entities[p.id];
          if (e) {
            e.regionId = r.id;
            e.x = spawn.x + (i % 2 ? 8 : -8);
            e.y = spawn.y + 8;
            try {
              destination(e.id, e.x, e.y, r.id);
            } catch {
              e.x = spawn.x;
              e.y = spawn.y;
            }
          }
        }
      emit({ kind: "travel", from, regionId: r.id, spawn: spawnName });
    }
    function status(id, target, duration) {
      const s = current(),
        d = registry.require("statuses", id);
      actorState(target);
      const existing = s.statuses.find(
          (v) => v.id === d.id && v.target === target,
        ),
        expiresAt = s.time + (duration ?? d.duration ?? 10);
      if (existing) {
        if (d.stacking === "reject") fail("This effect is already active.");
        existing.expiresAt = expiresAt;
        if (d.stacking === "stack")
          existing.stacks = Math.min(d.maxStacks || 10, existing.stacks + 1);
      } else
        s.statuses.push({
          id: d.id,
          target,
          expiresAt,
          stacks: 1,
          nextTick: d.periodic ? s.time + d.periodic.interval : null,
        });
    }
    function damage(target, amount, source = "player") {
      if (!finite(amount) || amount < 0) fail("Invalid damage.");
      const s = current(),
        a = actorState(target),
        wasAlive = a.hp > 0;
      a.hp = Math.max(0, a.hp - Math.max(0, amount - stat("armor", target)));
      emit({ kind: "damage", target, amount, source });
      if (wasAlive && a.hp === 0 && target !== "player") {
        a.state.dead = true;
        const d = definition(a);
        if (!a.state.lootGranted) {
          for (const [id, n] of Object.entries(d?.loot || {})) addItem(id, n);
          if (d?.xpReward) grantXP(d.xpReward);
          a.state.lootGranted = true;
        }
        emit({ kind: "death", target });
      }
    }
    function grantXP(amount, actor = "player") {
      if (!finite(amount) || amount < 0) fail("Invalid experience.");
      const a = actorState(actor),
        rules = registry.settings.progression || {};
      a.xp = (a.xp || 0) + amount;
      a.level ||= 1;
      for (const step of rules.levels || [])
        if (a.xp >= step.xp && a.level < step.level) {
          a.level = step.level;
          apply(step.effects || [], { actor });
          emit({ kind: "level", actor, level: a.level });
        }
    }
    function ownership(ownerEntity, context) {
      const s = current(),
        e = s.entities[inventoryRoot(ownerEntity)];
      if (!e?.owner || e.owner === "player" || e.owner === context.actor)
        return;
      const rule = definition(e)?.theft || registry.settings.theft || {},
        witnesses = Object.values(s.entities).filter(
          (a) =>
            a.kind === "actor" &&
            a.hp > 0 &&
            a.regionId === e.regionId &&
            a.id !== context.actor &&
            Math.hypot(a.x - e.x, a.y - e.y) <= (rule.witnessRange || 80) &&
            (!adapter.sight || adapter.sight(a.id, e.id, s)),
        );
      if (rule.forbidden) fail("This belongs to someone else.");
      if (witnesses.length) {
        s.reputation += rule.reputation ?? -1;
        apply(rule.effects || [], { ...context, target: e.id });
        emit({
          kind: "theft",
          target: e.id,
          witnesses: witnesses.map((a) => a.id),
          message: rule.message || "Someone witnessed the theft.",
        });
      } else
        emit({
          kind: "theft",
          target: e.id,
          witnesses: [],
          message: "You took something that was not yours.",
        });
    }
    function inventoryRoot(id) {
      const s = current();
      let root = id,
        depth = 0;
      while (s.itemInstances[root]) {
        root = s.itemInstances[root].owner;
        if (++depth > 4) fail("Containers support at most four nested levels.");
      }
      return root;
    }
    function containsProtected(id, seen = new Set()) {
      if (seen.has(id)) fail("Container ownership cycle.");
      const next = new Set(seen);
      next.add(id);
      if (itemDef(id)?.protected) return true;
      return Object.entries(current().itemInstances[id]?.contents || {}).some(
        ([child, n]) => n > 0 && containsProtected(child, next),
      );
    }
    function inventoryAccess(id, context) {
      const root = inventoryRoot(id);
      if (root === "player") return;
      nearby(root, context);
      const e = entity(root),
        d = definition(e);
      if (e?.state.locked) fail("It is locked.");
      if (
        (Array.isArray(d?.verbs) ? d.verbs.includes("open") : d?.verbs?.open) &&
        e.state.open !== true
      )
        fail("Open the container first.");
    }
    function transfer(command, context) {
      const s = current(),
        from = command.from || "player",
        to = command.to || "player",
        id = command.item,
        n = command.count ?? 1,
        d = itemDef(id);
      if (!Number.isInteger(n) || n < 1)
        fail("Transfer quantity must be positive.");
      if (d?.stackable === false && !s.itemInstances[id])
        fail("Choose the unique item instance.");
      if (from === to) fail("Choose a different destination.");
      if (!d) fail("Unknown item " + id);
      const fromRoot = inventoryRoot(from),
        toRoot = inventoryRoot(to);
      const partyOwner = (owner) =>
        owner === "player" || s.party.some((p) => p.id === owner);
      if (containsProtected(id) && partyOwner(fromRoot) && !partyOwner(toRoot))
        fail("This quest item must stay with the party.");
      inventoryAccess(from, context);
      inventoryAccess(to, context);
      if (s.itemInstances[id]) {
        let ancestor = to,
          depth = 0;
        while (s.itemInstances[ancestor]) {
          if (ancestor === id) fail("A container cannot contain itself.");
          ancestor = s.itemInstances[ancestor].owner;
          if (++depth > 4)
            fail("Containers support at most four nested levels.");
        }
        const childDepth = (instance, seen = new Set()) => {
          if (seen.has(instance)) fail("Container ownership cycle.");
          const next = new Set(seen);
          next.add(instance);
          const contents = s.itemInstances[instance]?.contents;
          if (!contents) return 0;
          return (
            1 +
            Math.max(
              0,
              ...Object.keys(contents)
                .filter(
                  (key) => contents[key] > 0 && s.itemInstances[key]?.contents,
                )
                .map((child) => childDepth(child, next)),
            )
          );
        };
        if (depth + childDepth(id) > 4)
          fail("Containers support at most four nested levels.");
      }
      addItem(id, -n, from, { preserveInstance: true });
      addItem(id, n, to);
      if (s.itemInstances[id]) s.itemInstances[id].owner = to;
      ownership(from, context);
      emit({ kind: "transfer", from, to, item: id, count: n });
    }
    function drop(command, context) {
      const s = current(),
        actor = context.actor || "player",
        a = entity(actor),
        regionId = actor === "player" ? s.regionId : a.regionId;
      if (!a) fail("Unknown actor.");
      let spot;
      const options =
        command.x != null || command.y != null
          ? [{ x: command.x, y: command.y }]
          : [
              { x: a.x + 16, y: a.y },
              { x: a.x - 16, y: a.y },
              { x: a.x, y: a.y + 16 },
              { x: a.x, y: a.y - 16 },
              { x: a.x, y: a.y },
            ];
      for (const p of options) {
        if (
          !finite(p.x) ||
          !finite(p.y) ||
          Math.hypot(p.x - a.x, p.y - a.y) > 40
        )
          continue;
        try {
          destination("player", p.x, p.y, regionId);
          spot = p;
          break;
        } catch {}
      }
      if (!spot) fail("There is no safe nearby place to drop that item.");
      const id = `drop:${++s.sequence}`;
      s.entities[id] = {
        id,
        definition: "rpg:ground-loot",
        kind: "prefab",
        regionId,
        ...spot,
        z: 0,
        state: { open: true },
        inventory: {},
        equipment: {},
        hp: 1,
        mana: 0,
        owner: null,
      };
      transfer(
        { from: actor, to: id, item: command.item, count: command.count ?? 1 },
        context,
      );
      emit({
        kind: "drop",
        target: id,
        message: "Supplies placed on the ground.",
      });
    }
    function equip(command) {
      const actor = command.actor || "player",
        a = actorState(actor),
        eq = actor === "player" ? current().equipment : a.equipment,
        def = itemDef(command.item);
      if (command.type === "unequip") {
        const slot = command.slot;
        if (!eq[slot]) fail("That slot is empty.");
        delete eq[slot];
        return;
      }
      if (!def?.equipment) fail("This item cannot be equipped.");
      if (count(command.item, actor) < 1) fail("You do not carry that item.");
      if (!check(def.equipment.conditions, { actor }))
        fail(explain(def.equipment.conditions, { actor }));
      const slot = command.slot || def.equipment.slot;
      if (slot !== def.equipment.slot) fail("Wrong equipment slot.");
      if (!safeKey(slot) || !slot) fail("Invalid equipment slot.");
      eq[slot] = itemKey(command.item);
    }
    function craft(command, context) {
      const r = registry.require("recipes", command.recipe);
      if (!check(r.conditions, context)) fail(explain(r.conditions, context));
      if (r.station) {
        nearby(command.station || command.target, context);
        if (
          entity(command.station || command.target)?.definition !==
          registry.resolve("prefabs", r.station)
        )
          fail("Use the correct crafting station.");
      }
      pay({ items: r.ingredients }, context);
      for (const [id, n] of Object.entries(r.outputs || {}))
        addItem(id, n, context.actor || "player");
      emit({
        kind: "craft",
        recipe: r.id,
        message: r.message || `${r.name || "Recipe"} crafted.`,
      });
    }
    function trade(command, context) {
      const s = current(),
        d = registry.require("vendors", command.vendor),
        v = s.vendors[d.id],
        key = registry.itemKey(itemDef(command.item)?.id || command.item),
        offer = Object.entries(d.stock || {}).find(
          ([id]) => registry.itemKey(id) === key,
        )?.[1],
        n = command.count ?? 1;
      if (d.entity) nearby(d.entity, context);
      if (!Number.isInteger(n) || n < 1)
        fail("Purchase quantity must be positive.");
      if (!offer) fail("This vendor does not trade that item.");
      if (command.type === "buy") {
        if ((v.stock[key] || 0) < n) fail("Not enough stock.");
        pay({ gold: offer.price * n }, context);
        addItem(key, n, context.actor || "player");
        v.stock[key] -= n;
      } else {
        if (!d.buyback) fail("This vendor does not buy items.");
        if (itemDef(key).protected) fail("Quest items cannot be sold.");
        addItem(
          current().itemInstances[command.item] ? command.item : key,
          -n,
          context.actor || "player",
        );
        s.gold += (offer.sellPrice ?? Math.floor(offer.price / 2)) * n;
        v.stock[key] = (v.stock[key] || 0) + n;
      }
      emit({ kind: "trade", vendor: d.id, item: key, count: n });
    }
    function validateTarget(rule, command, context) {
      const actor = context.actor || "player";
      const target =
        rule.target === "self"
          ? actor
          : rule.target === "none"
            ? null
            : command.target || null;
      if (!["self", "none", undefined].includes(rule.target)) {
        nearby(target, context, rule.range);
        const t = entity(target);
        if (
          (rule.target === "actor" || rule.target === "enemy") &&
          target !== "player" &&
          t.kind !== "actor"
        )
          fail("Choose an actor.");
        if (rule.target === "object" && t.kind !== "prefab")
          fail("Choose an object.");
        if (t.hp <= 0) fail("That actor is already defeated.");
        if (rule.target === "enemy") {
          const attackerTeam =
            actor === "player" ? "player" : definition(entity(actor))?.team;
          const hostile =
            target === "player"
              ? false
              : ["hostile", "enemy"].includes(definition(t)?.team);
          if (
            attackerTeam === "player"
              ? !hostile
              : target !== "player" && definition(t)?.team !== "player"
          )
            fail("Choose a hostile target.");
        }
      }
      return target;
    }
    function useItem(command, context, onObject = false) {
      const item = itemDef(command.item);
      if (!item?.use) fail("That item cannot be used.");
      const rules = {
        ...item.use,
        target: item.use.target ?? (onObject ? "any" : "self"),
      };
      const target = validateTarget(rules, command, context),
        ctx = { ...context, target };
      if (!check(item.use.conditions, ctx))
        fail(explain(item.use.conditions, ctx));
      if (count(command.item, ctx.actor || "player") < 1)
        fail("You do not carry that item.");
      pay(
        { items: { [command.item]: item.use.consume === false ? 0 : 1 } },
        ctx,
      );
      apply(item.use.effects, ctx);
    }
    function cast(command, context) {
      const d = registry.require("abilities", command.ability),
        s = current();
      if (d.requiresLearned && !s.learned.includes(d.id))
        fail("Learn this ability first.");
      const target = validateTarget(d, command, context);
      const ctx = { ...context, target };
      if (!check(d.conditions, ctx)) fail(explain(d.conditions, ctx));
      pay(d.costs, ctx);
      apply(d.effects || [], ctx);
      emit({
        kind: "cast",
        actor: context.actor || "player",
        ability: d.id,
        target,
        animation: d.animation,
        sfx: d.sfx,
        message: d.message || `${d.name || d.id}.`,
      });
    }
    function verb(command, context) {
      const s = current(),
        t = entity(command.target),
        d = definition(t),
        name = command.verb;
      nearby(command.target, context);
      const v = Array.isArray(d?.verbs)
        ? d.verbs.includes(name)
          ? {}
          : null
        : d?.verbs?.[name];
      if (!v && !registry.extensions.verbs[name])
        fail(`This object does not support ${name}.`);
      if (v?.conditions && !check(v.conditions, context))
        fail(explain(v.conditions, context));
      if (v?.effects) {
        apply(v.effects, context);
        return;
      }
      switch (name) {
        case "inspect":
        case "read":
          emit({
            kind: "inspect",
            message: d.description || d.name || t.id,
            target: t.id,
          });
          break;
        case "open":
          if (t.state.locked) fail("It is locked.");
          t.state.open = true;
          break;
        case "close":
          t.state.open = false;
          break;
        case "lock":
          if (t.state.open) fail("Close it before locking.");
          if (d.key && count(d.key) < 1) fail("Requires the matching key.");
          t.state.locked = true;
          break;
        case "unlock":
          if (!t.state.locked) return;
          if (!d.key || count(d.key) < 1) fail("Requires the matching key.");
          t.state.locked = false;
          break;
        case "take":
          transfer(
            {
              ...command,
              type: "transfer",
              from: t.id,
              to: command.to || "player",
            },
            context,
          );
          break;
        case "give":
        case "drop":
          transfer(
            {
              ...command,
              type: "transfer",
              from: command.from || "player",
              to: t.id,
            },
            context,
          );
          break;
        case "move": {
          const p = command.destination;
          if (!p) fail("Choose a destination.");
          const grid = d.move?.grid || 16,
            limit = d.move?.range || grid * 2;
          let x = t.x + Math.round((p.x - t.x) / grid) * grid,
            y = t.y + Math.round((p.y - t.y) / grid) * grid;
          if (Math.hypot(x - t.x, y - t.y) > limit) {
            if (Math.hypot(p.x - t.x, p.y - t.y) > limit)
              fail("Move this object one step at a time.");
            // Rounding near a circular range boundary can move an otherwise valid
            // request outside that boundary. Pick the nearest valid grid neighbor.
            const candidates = [];
            for (const dx of [-1, 0, 1])
              for (const dy of [-1, 0, 1]) {
                const candidate = { x: x + dx * grid, y: y + dy * grid };
                candidate.distance = Math.hypot(
                  candidate.x - t.x,
                  candidate.y - t.y,
                );
                candidate.error = Math.hypot(
                  candidate.x - p.x,
                  candidate.y - p.y,
                );
                if (candidate.distance <= limit) candidates.push(candidate);
              }
            candidates.sort(
              (a, b) => a.error - b.error || a.distance - b.distance,
            );
            if (!candidates.length)
              fail("Move this object one step at a time.");
            ({ x, y } = candidates[0]);
          }
          destination(t.id, x, y, t.regionId);
          if (t.x !== x || t.y !== y) t.state.moved = true;
          t.x = x;
          t.y = y;
          apply(d.onMove || [], context);
          emit({ kind: "move", target: t.id });
          break;
        }
        case "use":
          if (!command.item) fail("Choose an item.");
          useItem(command, context, true);
          break;
        case "gather": {
          const g = d.gather;
          if (!g) fail("No gathering recipe.");
          const n = Math.min(g.count || 1, (g.cap ?? Infinity) - count(g.item));
          if (n < 1) fail("You already carry enough.");
          addItem(g.item, n);
          break;
        }
        case "rest": {
          const r = d.rest || {};
          if (r.hp !== false) s.hp = r.hp ?? stat("maxHp");
          if (r.mana !== false) s.mana = r.mana ?? stat("maxMana");
          advance(r.seconds || 0);
          break;
        }
        case "activate":
          apply(d.onActivate || [], context);
          break;
        default:
          registry.extensions.verbs[name](extensionContext(context), command);
      }
      emit({ kind: "entity", target: t.id, verb: name });
    }
    function action(command, context) {
      const s = current(),
        base = registry.require("actions", command.id),
        branch = base.branches?.find((b) => check(b.when, context)),
        d = branch ? { ...base, ...branch } : base;
      failedDialogue = registry.get("dialogues", d.failure)
        ? d.failure
        : undefined;
      if (base.branches && !branch) fail("No action branch is available.");
      if (d.once && s.completedActions[base.id]) {
        if (d.repeatDialogue) activeDialogue = d.repeatDialogue;
        return;
      }
      if (d.target && command.target && d.target !== command.target)
        fail("Use this action at " + (definition(entity(d.target))?.name || d.target) + ".");
      if (d.target || command.target) {
        context = { ...context, target: d.target || command.target };
        if (d.requireRange !== false) nearby(context.target, context, d.range);
      }
      if (!check(d.conditions, context))
        fail(
          !failedDialogue && typeof d.failure === "string"
            ? d.failure
            : explain(d.conditions, context),
        );
      pay(d.costs, context);
      apply(d.effects || [], context);
      if (d.once) s.completedActions[base.id] = true;
      if (d.dialogue) activeDialogue = d.dialogue;
      if (d.message) emit({ kind: d.kind || "story", message: d.message });
    }
    function advance(dt) {
      if (!finite(dt) || dt < 0 || dt > 86400 * 365)
        fail("Invalid time advance.");
      const s = current();
      s.time += dt;
      for (const st of [...s.statuses]) {
        const d = registry.require("statuses", st.id);
        if (d.periodic) {
          let ticks = 0;
          while (st.nextTick <= s.time && st.nextTick <= st.expiresAt) {
            apply(d.periodic.effects || [], {
              actor: st.target,
              target: st.target,
            });
            st.nextTick += d.periodic.interval;
            if (++ticks > 256)
              fail("Too many periodic ticks; advance in smaller steps.");
          }
        }
      }
      s.statuses = s.statuses.filter((st) => st.expiresAt > s.time);
      for (const d of registry.all("vendors"))
        if (d.restockSeconds > 0) {
          const v = s.vendors[d.id];
          if (v.nextRestock <= s.time) {
            for (const [id, offer] of Object.entries(d.stock || {}))
              v.stock[registry.itemKey(id)] =
                typeof offer === "number" ? offer : offer.count;
            v.nextRestock +=
              Math.ceil((s.time - v.nextRestock + 0.0001) / d.restockSeconds) *
              d.restockSeconds;
          }
        }
    }
    function schedule(id) {
      const s = current(),
        e = entity(id),
        d = definition(e);
      if (!e || !d) return null;
      if (s.party.some((p) => p.id === id) || s.conversation === id)
        return null;
      const hour = s.time % (registry.settings.dayLength || 240),
        entry = d.schedule?.find((a) =>
          a.start <= a.end
            ? hour >= a.start && hour < a.end
            : hour >= a.start || hour < a.end,
        );
      if (!entry) return null;
      const r = registry.get("regions", entry.regionId || e.regionId),
        dest = r?.anchors?.[entry.anchor] || entry.destination;
      if (!dest) return { activity: entry.activity, unreachable: true };
      return {
        ...dest,
        regionId: r.id,
        activity: entry.activity,
        anchor: entry.anchor,
      };
    }
    function encounterFor(id) {
      return registry
        .all("encounters")
        .find((d) => (d.members || []).includes(id));
    }
    function updateEncounters() {
      const s = current();
      for (const d of registry.all("encounters")) {
        const e = s.encounters[d.id];
        if (!e) continue;
        if (e.resolved && d.respawnSeconds > 0 && e.nextRespawn <= s.time) {
          for (const id of d.members || []) {
            const actor = s.entities[id];
            if (actor) {
              actor.hp = stat("maxHp", id);
              actor.state.dead = false;
            }
          }
          e.active = false;
          e.resolved = false;
          e.cycle++;
          e.nextRespawn = null;
          emit({ kind: "encounter", id: d.id, state: "respawned" });
        }
        if (
          !e.active &&
          !e.resolved &&
          (!d.regionId || d.regionId === s.regionId) &&
          check(d.activation)
        ) {
          e.active = true;
          emit({ kind: "encounter", id: d.id, state: "active" });
        }
        const defeated =
          (d.members || []).length > 0 &&
          (d.members || []).every((id) => s.entities[id]?.hp <= 0);
        if (
          e.active &&
          !e.resolved &&
          (defeated || (d.resolution && check(d.resolution)))
        ) {
          e.resolved = true;
          e.active = false;
          e.nextRespawn =
            d.respawnSeconds > 0 ? s.time + d.respawnSeconds : null;
          if (!e.rewarded) {
            e.rewarded = true;
            apply(d.effects || [], {});
          }
          emit({
            kind: "encounter",
            id: d.id,
            state: "resolved",
            peaceful: !defeated,
          });
        }
      }
    }
    function updateQuests() {
      const s = current();
      for (const q of registry.all("quests")) {
        const record = s.quests[q.id];
        if (
          q.completionCondition &&
          record.state !== "complete" &&
          check(q.completionCondition)
        ) {
          record.state = "complete";
          if (!record.rewarded.includes("completion")) {
            record.rewarded.push("completion");
            apply(q.completionEffects || [], {});
          }
        }
        for (const transition of q.transitions || [])
          if (record.state === transition.from && check(transition.condition)) {
            record.state = transition.to;
            const key = transition.id || `${transition.from}:${transition.to}`;
            if (!record.rewarded.includes(key)) {
              record.rewarded.push(key);
              apply(transition.effects || [], {});
            }
            break;
          }
      }
      if (s.trackedQuest) {
        const tracked = registry.get("quests", s.trackedQuest);
        const record = s.quests[s.trackedQuest];
        if (!tracked || !check(tracked.visibleWhen) || record?.state === "complete" || record?.rewarded.includes("completion"))
          s.trackedQuest = null;
      }
    }
    function transact(work, context = {}, commandLabel) {
      if (running)
        return {
          ok: false,
          message: "A command cannot recursively start another command.",
          events: [],
        };
      running = true;
      activeDraft = clone(state);
      activeEvents = [];
      activeContext = context;
      activeDialogue = undefined;
      failedDialogue = undefined;
      effectCount = 0;
      let result;
      try {
        work();
        for (const pack of registry.packs)
          for (const projection of pack.stateProjections || []) {
            const value = check(projection.condition);
            if (value || projection.flag in activeDraft.flags)
              activeDraft.flags[projection.flag] = value;
          }
        updateQuests();
        updateEncounters();
        for (const key of Object.keys(state))
          if (!(key in activeDraft)) delete state[key];
        Object.assign(state, activeDraft);
        result = {
          ok: true,
          message: activeEvents.findLast((e) => e.message)?.message || "",
          events: activeEvents,
          ...(activeDialogue ? { dialogue: activeDialogue } : {}),
        };
      } catch (error) {
        result = {
          ok: false,
          message: error.message,
          events: [],
          ...(failedDialogue ? { dialogue: failedDialogue } : {}),
        };
      }
      activeDraft = null;
      activeEvents = null;
      activeContext = null;
      running = false;
      history.push({
        time: state.time,
        command: commandLabel || "effects",
        ...clone(result),
      });
      if (history.length > 100) history.shift();
      if (result.ok)
        onChange({
          ...result,
          kind: result.events.findLast((e) => e.kind)?.kind || "change",
        });
      return result;
    }
    function command(c) {
      if (!object(c) || typeof c.type !== "string")
        return { ok: false, message: "Command needs a type.", events: [] };
      const context = { actor: c.actor || "player", target: c.target };
      return transact(
        () => {
          switch (c.type) {
            case "trackQuest": {
              if (c.quest !== null) {
                const q = registry.require("quests", c.quest);
                if (!check(q.visibleWhen)) fail("Discover this quest first.");
                const record = current().quests[q.id];
                if (record.state === "complete" || record.rewarded.includes("completion"))
                  fail("This quest is already complete.");
                current().trackedQuest = q.id;
              } else current().trackedQuest = null;
              emit({ kind: "journal", message: c.quest ? "Quest tracked in the field guide." : "Main story guidance restored." });
              break;
            }
            case "action":
              action(c, context);
              break;
            case "effects":
              apply(c.effects, context);
              break;
            case "transfer":
              transfer(c, context);
              break;
            case "drop":
              drop(c, context);
              break;
            case "equip":
            case "unequip":
              equip(c);
              break;
            case "craft":
              craft(c, context);
              break;
            case "buy":
            case "sell":
              trade(c, context);
              break;
            case "verb":
              verb(c, context);
              break;
            case "cast":
              cast(c, context);
              break;
            case "party":
              if (c.mode === "recruit") nearby(c.member, context);
              party(c.member, c.mode);
              break;
            case "travel": {
              let exit;
              for (const region of registry.all("regions"))
                if (region.id === current().regionId)
                  exit = (region.exits || []).find(
                    (e) => e.id === c.target || e.entity === c.target,
                  );
              if (!exit) fail("Unknown exit " + c.target);
              nearby(exit.entity || exit.id, context);
              if (!check(exit.conditions, context))
                fail(explain(exit.conditions, context));
              travel(exit.targetRegion, exit.spawn);
              break;
            }
            case "attack": {
              nearby(
                c.target,
                context,
                c.range || stat("range", context.actor) || 30,
              );
              const t = entity(c.target);
              if (!t || t.kind !== "actor") fail("Choose an actor.");
              if (
                !["hostile", "enemy"].includes(definition(t)?.team) &&
                context.actor === "player"
              )
                fail("This actor is not hostile.");
              if (
                check(
                  definition(t)?.peaceWhen === undefined
                    ? false
                    : definition(t).peaceWhen,
                  context,
                )
              )
                fail("This encounter is resolved peacefully.");
              damage(
                c.target,
                c.amount ?? stat("damage", context.actor),
                context.actor,
              );
              break;
            }
            case "damage":
              damage(c.target, c.amount, c.actor);
              break;
            case "recover": {
              const s = current(),
                r = registry.require("regions", s.regionId),
                p = r.recovery || r.spawn;
              s.hp = stat("maxHp");
              s.mana = stat("maxMana");
              s.player = { ...s.player, ...p };
              s.statuses = s.statuses.filter((st) => st.target !== "player");
              emit({ kind: "recover", message: "You wake somewhere safe." });
              break;
            }
            case "useItem":
              useItem(c, context);
              break;
            case "advance":
              advance(c.seconds);
              break;
            case "sync":
              sync(c);
              emit({
                kind: "sync",
                targets: [
                  ...(c.player ? ["player"] : []),
                  ...(c.entities || []).map((e) => e.id),
                ],
              });
              break;
            default:
              fail("Unknown command " + c.type);
          }
        },
        context,
        c,
      );
    }
    function sync(changes) {
      const s = current();
      if (changes.player)
        for (const k of ["x", "y", "z"])
          if (changes.player[k] != null) {
            if (!finite(changes.player[k])) fail("Invalid player position");
            s.player[k] = changes.player[k];
          }
      for (const data of changes.entities || []) {
        const e = s.entities[data.id];
        if (!e) continue;
        for (const k of ["x", "y", "z", "hp", "mana"])
          if (data[k] != null) {
            if (!finite(data[k])) fail("Invalid entity value");
            e[k] = data[k];
          }
      }
      if (changes.enemies) s.enemies = clone(changes.enemies);
    }
    function costReason(costs = {}, actor = "player") {
      costs = resolveCosts(costs);
      const a = actorState(actor);
      for (const key of ["mana", "gold", "hp"])
        if ((costs[key] || 0) > (a[key] || 0)) return `Not enough ${key}.`;
      for (const [id, n] of Object.entries(costs.items || {}))
        if (count(id, actor) < n)
          return `Requires ${n} ${registry.get("items", id)?.name || id}.`;
      return "";
    }
    function accessReason(id) {
      try {
        if (current().itemInstances[id]) inventoryAccess(id, {});
        else nearby(id, {});
        return "";
      } catch (e) {
        return e.message;
      }
    }
    function view(type, options = {}) {
      const s = current(),
        owner =
          options.owner ||
          options.id ||
          options.actor ||
          options.target ||
          "player";
      const entries = () =>
        Object.entries(inventory(owner))
          .filter(([, n]) => n > 0)
          .map(([id, n]) => {
            const d = itemDef(id);
            return {
              id,
              item: id,
              count: n,
              name: d?.name || id,
              description: d?.description || "",
              icon: d?.icon || "◇",
              equipment: d?.equipment,
              protected: !!d?.protected,
              dropReason: d?.protected
                ? "This quest item must stay with the party."
                : "",
              usable: !!(d?.use || d?.useAction),
              openTarget: s.itemInstances[id]?.contents ? id : undefined,
              dropCommand: { type: "drop", actor: owner, item: id, count: 1 },
              giveTargets: current()
                .party.filter((p) => !accessReason(p.id))
                .map((p) => ({
                  id: p.id,
                  name: definition(entity(p.id))?.name || p.id,
                  command: {
                    type: "transfer",
                    from: owner,
                    to: p.id,
                    item: id,
                    count: 1,
                  },
                })),
              command: d?.useAction
                ? { type: "action", id: d.useAction, actor: owner }
                : { type: "useItem", item: id, actor: owner },
            };
          });
      switch (type) {
        case "inventory":
        case "container": {
          const destination = options.destination || "player";
          const items = entries().map((e) =>
              type === "container" ? { ...e, command: undefined } : e,
            ),
            playerItems =
              owner === destination
                ? []
                : view("inventory", { owner: destination }).items.map((e) => ({
                    ...e,
                    command: undefined,
                  }));
          const name =
            owner === "player"
              ? "Satchel"
              : definition(entity(owner))?.name ||
                itemDef(owner)?.name ||
                owner;
          const access = owner === "player" ? "" : accessReason(owner),
            e = entity(owner),
            d = definition(e);
          const available = Object.values(s.entities).filter(
            (e) =>
              e.regionId === s.regionId &&
              ((e.kind === "actor" && s.party.some((p) => p.id === e.id)) ||
                definition(e)?.capacity != null) &&
              !accessReason(e.id),
          );
          return {
            id: owner,
            name,
            title: name,
            owner,
            ownerLabel: e?.owner || d?.owner || "",
            destination,
            description: d?.description || "",
            playerId: "player",
            capacity: d?.capacity || itemDef(owner)?.container?.capacity,
            used: items.reduce(
              (n, e) => n + e.count * (itemDef(e.id)?.weight ?? 1),
              0,
            ),
            items: items.map((e) => ({
              ...e,
              takeReason:
                access ||
                (d?.initialState?.locked && s.entities[owner]?.state.locked
                  ? "It is locked."
                  : ""),
            })),
            playerItems: playerItems.map((e) => ({
              ...e,
              putReason:
                access ||
                (itemDef(e.id)?.protected &&
                !s.party.some((p) => p.id === owner)
                  ? "This quest item must stay with the party."
                  : ""),
            })),
            destinations: [
              { id: "player", name: "Satchel" },
              ...available.map((e) => ({
                id: e.id,
                name: definition(e)?.name || e.id,
              })),
            ].filter((d) => d.id !== owner),
            entries: items,
            player: playerItems,
            recipients: s.party
              .filter((p) => p.id !== owner)
              .map((p) => ({
                id: p.id,
                name: definition(entity(p.id))?.name || p.id,
                reason: accessReason(p.id),
              })),
            params: { id: owner, destination },
          };
        }
        case "equipment": {
          const eq =
              owner === "player" ? s.equipment : entity(owner)?.equipment || {},
            items = entries()
              .filter((e) => e.equipment)
              .map((e) => ({
                ...e,
                slot: e.equipment.slot,
                modifiers: e.equipment.modifiers,
                reason: explain(e.equipment.conditions, { actor: owner }),
                command: { type: "equip", actor: owner, item: e.id },
              }));
          return {
            title: "Equipment",
            name:
              owner === "player"
                ? "Your equipment"
                : definition(entity(owner))?.name,
            actor: owner,
            slots: [
              ...new Set([
                ...(registry.settings.equipmentSlots || [
                  "hand",
                  "body",
                  "charm",
                ]),
                ...Object.keys(eq),
                ...items.map((item) => item.slot),
              ]),
            ].map((slot) => ({
              id: slot,
              slot,
              name: slot,
              item: eq[slot]
                ? { id: eq[slot], name: itemDef(eq[slot])?.name || eq[slot] }
                : null,
              command: { type: "unequip", actor: owner, slot },
            })),
            items,
            entries: items,
            stats: Object.fromEntries(
              ["maxHp", "maxMana", "damage", "armor"].map((k) => [
                k,
                stat(k, owner),
              ]),
            ),
            params: { actor: owner },
          };
        }
        case "crafting": {
          const station = options.station || options.target,
            recipes = registry.all("recipes").map((d) => {
              const ingredients = Object.entries(d.ingredients || {}).map(
                ([id, n]) => ({
                  id,
                  name: registry.get("items", id)?.name || id,
                  count: n,
                  have: count(id),
                }),
              );
              const reason =
                explain(d.conditions) ||
                costReason({ items: d.ingredients }) ||
                (d.station
                  ? !station
                    ? "Choose a crafting station."
                    : entity(station)?.definition !==
                        registry.resolve("prefabs", d.station)
                      ? "Use the correct crafting station."
                      : accessReason(station)
                  : "");
              return {
                id: d.id,
                name: d.name,
                description: d.description || "",
                ingredients,
                outputs: Object.entries(d.outputs || {}).map(([id, n]) => ({
                  id,
                  name: registry.get("items", id)?.name || id,
                  count: n,
                })),
                reason,
                disabledReason: reason,
                command: { type: "craft", recipe: d.id, station },
              };
            });
          return {
            title: "Crafting",
            name: "Recipes",
            station,
            recipes,
            entries: recipes,
            params: { station },
          };
        }
        case "trading": {
          const d = registry.get("vendors", options.vendor),
            access = d?.entity ? accessReason(d.entity) : "",
            stock = Object.entries(d?.stock || {}).map(([id, o]) => ({
              id,
              item: id,
              name: registry.get("items", id)?.name || id,
              description: registry.get("items", id)?.description || "",
              icon: registry.get("items", id)?.icon || "◇",
              count: s.vendors[d.id].stock[registry.itemKey(id)],
              carried: count(id),
              price: o.price,
              reason:
                access ||
                (s.vendors[d.id].stock[registry.itemKey(id)] < 1
                  ? "Out of stock."
                  : s.gold < o.price
                    ? "Not enough crowns."
                    : ""),
              sellPrice: o.sellPrice ?? Math.floor(o.price / 2),
              canSell: d.buyback,
              buy: { type: "buy", vendor: d.id, item: id, count: 1 },
              sell: { type: "sell", vendor: d.id, item: id, count: 1 },
            }));
          const playerItems = stock
            .filter((e) => e.carried > 0)
            .map((e) => ({
              ...e,
              count: e.carried,
              price: e.sellPrice,
              reason:
                access ||
                (!d.buyback
                  ? "This vendor does not buy items."
                  : itemDef(e.id)?.protected
                    ? "Quest items cannot be sold."
                    : ""),
            }));
          return {
            title: d?.name || "Trading",
            name: d?.name || "Trading",
            gold: s.gold,
            vendor: d?.id,
            stock,
            playerItems,
            entries: stock,
            params: { vendor: d?.id },
          };
        }
        case "party": {
          const members = s.party.map((p) => ({
            id: p.id,
            name: definition(entity(p.id))?.name || p.id,
            portrait: definition(entity(p.id))?.portrait,
            mode: p.mode,
            stance: p.stance || "assist",
            hp: entity(p.id)?.hp,
            maxHp: stat("maxHp", p.id),
            description: definition(entity(p.id))?.description || "",
            commands: ["follow", "wait", "dismiss", "assist", "defensive"].map(
              (mode) => ({
                label: mode,
                command: { type: "party", member: p.id, mode },
              }),
            ),
          }));
          const candidates = Object.values(s.entities)
            .filter(
              (e) =>
                definition(e)?.companion && !s.party.some((p) => p.id === e.id),
            )
            .map((e) => ({
              id: e.id,
              name: definition(e)?.name || e.id,
              reason:
                accessReason(e.id) ||
                (s.party.length >= (registry.settings.partyLimit || 3)
                  ? "The party is full."
                  : ""),
            }));
          return {
            title: "Companions",
            limit: registry.settings.partyLimit || 3,
            members,
            candidates,
            entries: members,
          };
        }
        case "progression": {
          const next = (registry.settings.progression?.levels || []).find(
            (l) => l.level > s.level,
          );
          return {
            title: "Experience",
            level: s.level,
            xp: s.xp,
            next,
            nextLevelXp: next?.xp,
            stats: Object.fromEntries(
              ["maxHp", "maxMana", "damage", "armor"].map((k) => [k, stat(k)]),
            ),
            learned: s.learned.map((id) => registry.get("abilities", id)),
            unlocks: registry.all("abilities").map((d) => ({
              name: d.name,
              description: d.description,
              learned: !d.requiresLearned || s.learned.includes(d.id),
              level: (registry.settings.progression?.levels || []).find((l) =>
                (l.effects || []).some(
                  (e) => e.op === "learn" && e.ability === d.id,
                ),
              )?.level,
            })),
            statuses: s.statuses
              .filter((st) => st.target === "player")
              .map((st) => ({
                name: registry.get("statuses", st.id)?.name || st.id,
                remaining: Math.max(0, st.expiresAt - s.time),
                description: registry.get("statuses", st.id)?.description || "",
              })),
          };
        }
        case "abilities":
          return {
            title: "Spellbook",
            entries: registry.all("abilities").map((d) => ({
              ...d,
              disabledReason:
                d.requiresLearned && !s.learned.includes(d.id)
                  ? "Not learned"
                  : explain(d.conditions),
              command: {
                type: "cast",
                ability: d.id,
                target: options.target,
              },
            })),
          };
        case "entities":
          return {
            title: "World",
            entries: Object.values(s.entities)
              .filter(
                (e) => !options.regionId || e.regionId === options.regionId,
              )
              .map((e) => ({ ...e, name: definition(e)?.name || e.id })),
          };
        case "quests":
          return {
            title: "Journal",
            entries: registry.all("quests").map((q) => ({
              ...q,
              state: s.quests[q.id]?.state,
              objectives: (q.objectives || []).map((o) => ({
                ...o,
                done: check(o.condition),
              })),
            })),
          };
        default:
          fail("Unknown view " + type);
      }
    }
    const api = {
      state,
      registry,
      command,
      check,
      explain,
      entity,
      definition,
      stat,
      maxStat: stat,
      modifiedStat: (key, actor, base) => {
        if (!finite(base)) fail("Modified stat base must be finite.");
        return stat(key, actor || "player", current(), base);
      },
      count,
      inventory,
      view,
      history,
      effects: (effects, context = {}) =>
        transact(() => apply(effects, context), context),
      tick: (dt, options = {}) => {
        if (options.paused || options.dialogue) return { ok: true, events: [] };
        if (!finite(dt) || dt < 0)
          return { ok: false, message: "Invalid frame time.", events: [] };
        const next = state.time + dt,
          due =
            state.statuses.some(
              (st) =>
                st.expiresAt <= next ||
                (st.nextTick != null && st.nextTick <= next),
            ) ||
            registry
              .all("vendors")
              .some(
                (d) =>
                  d.restockSeconds > 0 &&
                  state.vendors[d.id].nextRestock <= next,
              );
        encounterClock += dt;
        if (
          due ||
          (registry.all("encounters").length > 0 && encounterClock >= 0.5)
        ) {
          encounterClock = 0;
          return transact(() => advance(dt), {}, "tick");
        }
        state.time = next;
        return { ok: true, events: [] };
      },
      advance: (seconds) => command({ type: "advance", seconds }),
      schedule,
      encounterFor,
      isHostileActive: (id) => {
        const d = encounterFor(id);
        return !d || !!state.encounters[d.id]?.active;
      },
      behavior: (id, dt) => {
        const e = entity(id),
          d = definition(e),
          spec = d?.behavior;
        if (!spec) return null;
        const key = typeof spec === "string" ? spec : spec.id,
          handler = registry.extensions.behaviors[key];
        if (!handler) fail("Unknown actor behavior " + key);
        return handler(
          { state, entity: e, definition: d, registry, runtime: api, dt },
          typeof spec === "string" ? {} : spec,
        );
      },
      damage: (target, amount, actor) =>
        command({ type: "damage", target, amount, actor }),
      setAdapter: (value) => {
        adapter = value || {};
      },
      sync: (changes) => {
        sync(changes);
      },
      syncPosition: (id, x, y, z) => {
        if (!finite(x) || !finite(y)) return false;
        const e = entity(id, state);
        if (!e) return false;
        e.x = x;
        e.y = y;
        if (finite(z)) e.z = z;
        return true;
      },
      random: () => {
        state.rng = (1664525 * state.rng + 1013904223) >>> 0;
        return state.rng / 4294967296;
      },
    };
    return api;
  }
  root.HBRPG = {
    createRegistry,
    createState,
    createRuntime,
    ensureContent,
    kinds: KINDS,
    conditionOps: CONDITION_OPS,
    effectOps: EFFECT_OPS,
    verbOps: VERB_OPS,
    validatePacks: (packs, ext) =>
      createRegistry(packs, ext, { strict: false }).diagnostics,
    clone,
  };
})(globalThis);

/* SOURCE: src/rpg/persistence.js */
/* Versioned save envelope and recoverable browser storage. Raw legacy data is retained. */
(function (root) {
  "use strict";
  const SCHEMA_VERSION = 2;
  const plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const error = (path, message) => ({ path, message });
  function contentCompatibility(state, registry) {
    const diagnostics = [];
    for (const [id, saved] of Object.entries(state.packVersions || {})) {
      const pack = registry.packs.find((p) => p.id === id),
        path = "packVersions." + id;
      if (!pack) {
        diagnostics.push(
          error(
            path,
            "Content pack " +
              id +
              " is unavailable. Restore the required pack before loading this save.",
          ),
        );
        continue;
      }
      const current = pack.version || "1.0.0";
      if (typeof saved !== "string") {
        diagnostics.push(error(path, "Expected a content version string."));
        continue;
      }
      if (saved === current) continue;
      const parse = (value) =>
        /^\d+(?:\.\d+){0,2}$/.test(value) ? value.split(".").map(Number) : null;
      const before = parse(saved),
        now = parse(current);
      if (!before || !now) {
        diagnostics.push(
          error(
            path,
            "Cannot compare content versions " +
              saved +
              " and " +
              current +
              "; restore matching content or supply an explicit migration.",
          ),
        );
        continue;
      }
      let order = 0;
      for (let i = 0; i < 3 && !order; i++)
        order = Math.sign((before[i] || 0) - (now[i] || 0));
      if (order > 0)
        diagnostics.push(
          error(
            path,
            "Save requires newer content " +
              id +
              " " +
              saved +
              "; installed version is " +
              current +
              ". Update the game; the save has been retained.",
          ),
        );
    }
    return diagnostics;
  }
  function validate(state, registry, { legacy = false } = {}) {
    const errors = [];
    if (!plain(state)) return [error("$", "Save must be an object.")];
    const need = (ok, path, message) => {
      if (!ok) errors.push(error(path, message));
    };
    need(
      legacy ? state.version === 1 : state.schemaVersion === SCHEMA_VERSION,
      legacy ? "version" : "schemaVersion",
      "Unsupported save version.",
    );
    for (const key of ["flags", "inventory", "player"])
      need(plain(state[key]), key, "Expected an object.");
    for (const key of ["hp", "mana", "gold", "reputation", "time"])
      need(finite(state[key]), key, "Expected a finite number.");
    for (const key of ["hp", "mana", "gold", "time"])
      need(state[key] >= 0, key, "Expected a nonnegative number.");
    need(
      state.ending === null || typeof state.ending === "string",
      "ending",
      "Expected null or string.",
    );
    const dict = (v, path) => {
      if (!plain(v)) {
        errors.push(error(path, "Expected an inventory object."));
        return;
      }
      for (const [k, n] of Object.entries(v)) {
        need(
          !["__proto__", "constructor", "prototype"].includes(k),
          path + "." + k,
          "Unsafe inventory key.",
        );
        need(
          Number.isInteger(n) && n >= 0,
          path + "." + k,
          "Expected a nonnegative integer count.",
        );
      }
    };
    if (plain(state.inventory)) dict(state.inventory, "inventory");
    if (plain(state.flags))
      for (const [k, v] of Object.entries(state.flags))
        need(
          (typeof v === "boolean" ||
            typeof v === "string" ||
            finite(v) ||
            v === null) &&
            !["__proto__", "constructor", "prototype"].includes(k),
          "flags." + k,
          "Expected a scalar flag.",
        );
    if (plain(state.player))
      for (const key of ["x", "y"])
        need(
          finite(state.player[key]),
          "player." + key,
          "Expected finite world coordinate.",
        );
    need(Array.isArray(state.enemies), "enemies", "Expected an array.");
    for (const [i, e] of (Array.isArray(state.enemies)
      ? state.enemies
      : []
    ).entries())
      need(
        plain(e) && typeof e.id === "string" && finite(e.hp) && e.hp >= 0,
        `enemies[${i}]`,
        "Expected id and nonnegative HP.",
      );
    if (legacy) return errors;
    for (const key of [
      "packVersions",
      "entities",
      "quests",
      "equipment",
      "containers",
      "itemInstances",
      "completedActions",
      "vendors",
    ])
      need(plain(state[key]), key, "Expected an object.");
    for (const key of ["party", "statuses", "learned"])
      need(Array.isArray(state[key]), key, "Expected an array.");
    for (const key of ["xp", "level", "sequence", "rng"])
      need(
        finite(state[key]) && state[key] >= 0,
        key,
        "Expected a nonnegative number.",
      );
    need(
      typeof state.regionId === "string" &&
        !!registry.get("regions", state.regionId),
      "regionId",
      "Region definition is unavailable. Restore the required content pack.",
    );
    const inventoryRefs = (inv, path) => {
      dict(inv, path);
      for (const id of Object.keys(inv || {}))
        need(
          !!registry.get("items", id) || !!state.itemInstances?.[id],
          path + "." + id,
          "Item definition is unavailable. Restore or migrate the missing content.",
        );
    };
    inventoryRefs(state.inventory || {}, "inventory");
    errors.push(...contentCompatibility(state, registry));
    const inBounds = (position, regionId) => {
      const region = registry.get("regions", regionId),
        tile = region?.tileSize || 16;
      return (
        !!region &&
        finite(position?.x) &&
        finite(position?.y) &&
        position.x >= 0 &&
        position.y >= 0 &&
        position.x < region.width * tile &&
        position.y < region.height * tile
      );
    };
    need(
      inBounds(state.player, state.regionId),
      "player",
      "Player position lies outside the saved region.",
    );
    for (const [id, e] of Object.entries(state.entities || {})) {
      const path = "entities." + id;
      need(plain(e), path, "Expected entity object.");
      if (!plain(e)) continue;
      need(e.id === id, path + ".id", "Instance id does not match key.");
      need(
        ["actor", "prefab"].includes(e.kind),
        path + ".kind",
        "Expected actor or prefab.",
      );
      need(
        !!registry.get(e.kind === "actor" ? "actors" : "prefabs", e.definition),
        path + ".definition",
        "Definition is unavailable. Restore or migrate the required pack.",
      );
      need(
        !!registry.get("regions", e.regionId),
        path + ".regionId",
        "Unknown entity region.",
      );
      for (const key of ["x", "y", "z", "hp", "mana"])
        need(finite(e[key]), path + "." + key, "Expected a finite number.");
      need(
        inBounds(e, e.regionId),
        path,
        "Entity position lies outside its saved region.",
      );
      need(plain(e.state), path + ".state", "Expected an object.");
      inventoryRefs(e.inventory || {}, path + ".inventory");
      need(plain(e.equipment), path + ".equipment", "Expected an object.");
    }
    const members = new Set();
    for (const [i, p] of (Array.isArray(state.party)
      ? state.party
      : []
    ).entries()) {
      const ok =
        plain(p) &&
        typeof p.id === "string" &&
        !!state.entities?.[p.id] &&
        ["follow", "wait"].includes(p.mode);
      need(ok, `party[${i}]`, "Expected existing member and follow/wait mode.");
      if (ok) {
        need(!members.has(p.id), `party[${i}]`, "Duplicate party member.");
        members.add(p.id);
      }
    }
    for (const [i, s] of (Array.isArray(state.statuses)
      ? state.statuses
      : []
    ).entries()) {
      const ok =
        plain(s) &&
        !!registry.get("statuses", s.id) &&
        (s.target === "player" || !!state.entities?.[s.target]) &&
        finite(s.expiresAt) &&
        Number.isInteger(s.stacks) &&
        s.stacks > 0;
      need(
        ok,
        `statuses[${i}]`,
        "Invalid status, target, expiry or stack count.",
      );
      if (ok) {
        const definition = registry.get("statuses", s.id);
        need(
          s.expiresAt >= state.time,
          `statuses[${i}].expiresAt`,
          "Expired statuses must be removed before saving.",
        );
        if (definition.periodic)
          need(
            finite(s.nextTick) &&
              s.nextTick > state.time &&
              s.nextTick <= state.time + definition.periodic.interval + 1e-6,
            `statuses[${i}].nextTick`,
            "Periodic status needs its next finite tick after the saved clock, within one interval.",
          );
        else
          need(
            s.nextTick === null || s.nextTick === undefined,
            `statuses[${i}].nextTick`,
            "Nonperiodic statuses do not have a tick clock.",
          );
      }
    }
    need(
      state.trackedQuest === undefined || state.trackedQuest === null ||
        (typeof state.trackedQuest === "string" && !!registry.get("quests", state.trackedQuest)),
      "trackedQuest",
      "Tracked quest must be null or a known quest ID.",
    );
    for (const [id, q] of Object.entries(state.quests || {}))
      need(
        !!registry.get("quests", id) &&
          plain(q) &&
          typeof q.state === "string" &&
          Array.isArray(q.rewarded),
        "quests." + id,
        "Unknown quest or malformed quest state.",
      );
    for (const [id, item] of Object.entries(state.itemInstances || {})) {
      const path = "itemInstances." + id;
      need(
        plain(item) &&
          item.id === id &&
          !!registry.get("items", item.definition) &&
          typeof item.owner === "string",
        path,
        "Invalid item instance.",
      );
      if (item?.contents) inventoryRefs(item.contents, path + ".contents");
      let at = id,
        seen = new Set();
      while (state.itemInstances?.[at]) {
        if (seen.has(at)) {
          errors.push(error(path, "Container ownership cycle."));
          break;
        }
        seen.add(at);
        at = state.itemInstances[at].owner;
        if (seen.size > 5) {
          errors.push(error(path, "Container nesting exceeds four levels."));
          break;
        }
      }
    }
    for (const id of Array.isArray(state.learned) ? state.learned : [])
      need(
        typeof id === "string" && !!registry.get("abilities", id),
        "learned",
        "Unknown learned ability.",
      );

    if (state.encounters != null) {
      need(plain(state.encounters), "encounters", "Expected an object.");
      for (const [id, e] of Object.entries(state.encounters || {}))
        need(
          !!registry.get("encounters", id) &&
            plain(e) &&
            typeof e.active === "boolean" &&
            typeof e.resolved === "boolean" &&
            Number.isInteger(e.cycle) &&
            e.cycle >= 0 &&
            typeof e.rewarded === "boolean" &&
            (e.nextRespawn === null || finite(e.nextRespawn)),
          "encounters." + id,
          "Invalid encounter lifecycle or missing definition.",
        );
    }
    const equipment = (slots, owner, path) => {
      if (!plain(slots)) return;
      for (const [slot, id] of Object.entries(slots)) {
        const inv =
          owner === "player"
            ? state.inventory
            : state.entities?.[owner]?.inventory;
        const d = registry.get(
          "items",
          state.itemInstances?.[id]?.definition || id,
        );
        need(
          typeof id === "string" &&
            !!d?.equipment &&
            d.equipment.slot === slot &&
            (inv?.[id] || 0) > 0,
          path + "." + slot,
          "Equipped item must be carried and match its slot.",
        );
      }
    };
    equipment(state.equipment, "player", "equipment");
    for (const [id, e] of Object.entries(state.entities || {}))
      if (plain(e)) equipment(e.equipment, id, "entities." + id + ".equipment");
    for (const [id, v] of Object.entries(state.vendors || {})) {
      need(
        !!registry.get("vendors", id) &&
          plain(v) &&
          plain(v.stock) &&
          finite(v.nextRestock),
        "vendors." + id,
        "Invalid vendor stock or clock.",
      );
      if (plain(v?.stock)) dict(v.stock, "vendors." + id + ".stock");
    }
    for (const [id, item] of Object.entries(state.itemInstances || {}))
      if (plain(item)) {
        const inv =
          item.owner === "player"
            ? state.inventory
            : state.entities?.[item.owner]?.inventory ||
              state.itemInstances?.[item.owner]?.contents;
        need(
          (inv?.[id] || 0) === 1,
          "itemInstances." + id + ".owner",
          "Unique item must occur once in its owning inventory.",
        );
      }
    return errors;
  }
  function migrate(value, registry) {
    const wrapped = plain(value) && plain(value.state) ? value.state : value;
    if (!plain(wrapped)) throw new Error("Save must be an object.");
    if (wrapped.schemaVersion && wrapped.schemaVersion > SCHEMA_VERSION)
      throw new Error(
        "This save was created by a newer toolkit. Keep it until the game is updated.",
      );
    if (wrapped.schemaVersion === SCHEMA_VERSION) {
      const s = clone(wrapped);
      const compatibility = contentCompatibility(s, registry);
      if (compatibility.length)
        throw Object.assign(
          new Error(
            compatibility.map((d) => d.path + ": " + d.message).join("\n"),
          ),
          { diagnostics: compatibility },
        );
      for (const [id, e] of Object.entries(s.entities || {})) {
        if (e?.definition)
          e.definition = registry.resolve(
            e.kind === "actor" ? "actors" : "prefabs",
            e.definition,
          );
        if (e?.regionId) e.regionId = registry.resolve("regions", e.regionId);
      }
      s.regionId = registry.resolve("regions", s.regionId);
      // Aliases deliberately cover renamed definition IDs; removed referenced definitions remain a clear error.
      const renameInventory = (inv) => {
        for (const id of Object.keys(inv || {})) {
          const def = registry.get("items", id);
          if (def) {
            const key = registry.itemKey(def.id);
            if (key !== id) {
              inv[key] = (inv[key] || 0) + inv[id];
              delete inv[id];
            }
          }
        }
      };
      renameInventory(s.inventory);
      for (const e of Object.values(s.entities || {}))
        renameInventory(e.inventory);
      for (const item of Object.values(s.itemInstances || {})) {
        item.definition = registry.resolve("items", item.definition);
        renameInventory(item.contents);
      }
      const renameKeys = (dict, kind) => {
        for (const id of Object.keys(dict || {})) {
          const next = registry.resolve(kind, id);
          if (next !== id) {
            if (dict[next])
              throw new Error("Ambiguous renamed " + kind + " reference " + id);
            dict[next] = dict[id];
            delete dict[id];
          }
        }
      };
      renameKeys(s.quests, "quests");
      if (typeof s.trackedQuest === "string")
        s.trackedQuest = registry.resolve("quests", s.trackedQuest);
      renameKeys(s.vendors, "vendors");
      renameKeys(s.encounters, "encounters");
      renameKeys(s.completedActions, "actions");
      if (Array.isArray(s.learned))
        s.learned = s.learned.map((id) => registry.resolve("abilities", id));
      if (Array.isArray(s.statuses))
        for (const st of s.statuses)
          if (st?.id) st.id = registry.resolve("statuses", st.id);
      const renameEquipment = (eq) => {
        for (const slot of Object.keys(eq || {})) {
          const def = registry.get("items", eq[slot]);
          if (def) eq[slot] = registry.itemKey(def.id);
        }
      };
      renameEquipment(s.equipment);
      for (const e of Object.values(s.entities || {}))
        renameEquipment(e.equipment);
      const diagnostics = validate(s, registry);
      if (diagnostics.length)
        throw Object.assign(
          new Error(
            diagnostics.map((d) => `${d.path}: ${d.message}`).join("\n"),
          ),
          { diagnostics },
        );
      root.HBRPG.ensureContent(registry, s);
      return s;
    }
    const diagnostics = validate(wrapped, registry, { legacy: true });
    if (diagnostics.length)
      throw Object.assign(
        new Error(diagnostics.map((d) => `${d.path}: ${d.message}`).join("\n")),
        { diagnostics },
      );
    const s = root.HBRPG.createState(registry);
    for (const key of [
      "version",
      "flags",
      "inventory",
      "hp",
      "mana",
      "gold",
      "reputation",
      "ending",
      "time",
      "player",
      "enemies",
    ])
      s[key] = clone(wrapped[key]);
    for (const pack of registry.packs) {
      const l = pack.legacy || {};
      if (l.regionId) s.regionId = registry.resolve("regions", l.regionId);
      for (const [old, id] of Object.entries(l.itemAliases || {}))
        if (s.inventory[old] != null && old !== id) {
          s.inventory[id] = (s.inventory[id] || 0) + s.inventory[old];
          delete s.inventory[old];
        }
      for (const rule of l.entityStates || [])
        if (s.flags[rule.flag]) {
          const e = s.entities[rule.entity];
          if (!e)
            throw new Error("Legacy mapping has missing entity " + rule.entity);
          e.state[rule.key] = rule.value ?? true;
          if (rule.transform) Object.assign(e, rule.transform);
        }
      for (const rule of l.party || [])
        if (s.flags[rule.flag] && !s.party.some((p) => p.id === rule.member))
          s.party.push({ id: rule.member, mode: "follow" });
      for (const old of s.enemies) {
        const e = s.entities[l.enemyIds?.[old.id] || old.id];
        if (e) {
          e.hp = old.hp;
          if (old.hp === 0) {
            e.state.dead = true;
            e.state.lootGranted = true;
          }
        }
      }
      for (const status of l.statuses || [])
        if (
          finite(s.flags[status.untilFlag]) &&
          s.flags[status.untilFlag] > s.time
        )
          s.statuses.push({
            id: registry.require("statuses", status.status).id,
            target: status.target || "player",
            expiresAt: s.flags[status.untilFlag],
            stacks: 1,
            nextTick: null,
          });
    }
    const next = validate(s, registry);
    if (next.length)
      throw Object.assign(
        new Error(next.map((d) => `${d.path}: ${d.message}`).join("\n")),
        { diagnostics: next },
      );
    return s;
  }
  function create({
    registry,
    storage = root.localStorage,
    key = "hollow-bell:save:v2",
    legacyKey = "hollow-bell:save:v1",
  } = {}) {
    const backupKey = key + ":backup",
      legacyBackupKey = key + ":legacy-backup";
    const read = (k) => (k ? storage.getItem(k) : null);
    const serialise = (state) =>
      JSON.stringify({
        format: "hollow-bell-rpg",
        schemaVersion: SCHEMA_VERSION,
        savedAt: new Date().toISOString(),
        state,
      });
    function save(state) {
      try {
        const diagnostics = validate(state, registry);
        if (diagnostics.length)
          return {
            ok: false,
            message:
              "Cannot save: " +
              diagnostics[0].path +
              " " +
              diagnostics[0].message,
            diagnostics,
          };
        const raw = serialise(state),
          old = read(key);
        if (old) {
          try {
            const previous = JSON.parse(old);
            if (
              JSON.stringify(previous.state || previous) ===
              JSON.stringify(state)
            )
              return {
                ok: true,
                unchanged: true,
                message: "Journey is already saved on this device.",
              };
          } catch {
            /* Preserve original unreadable bytes as the backup on an explicit replacement. */
          }
          storage.setItem(backupKey, old);
        }
        storage.setItem(key, raw);
        return { ok: true, message: "Journey saved on this device." };
      } catch (e) {
        return {
          ok: false,
          message: "Your browser could not save this journey: " + e.message,
        };
      }
    }
    function load() {
      try {
        const raw = read(key);
        if (raw) {
          try {
            return {
              ok: true,
              state: migrate(JSON.parse(raw), registry),
              message: "Journey restored.",
              backupAvailable: !!read(backupKey),
            };
          } catch (e) {
            return {
              ok: false,
              state: null,
              message: "Saved journey needs recovery: " + e.message,
              backupAvailable: !!read(backupKey),
              diagnostics: e.diagnostics,
            };
          }
        }
        const legacy = read(legacyKey);
        if (!legacy)
          return {
            ok: true,
            state: null,
            message: "No saved journey.",
            backupAvailable: false,
          };
        let state;
        try {
          state = migrate(JSON.parse(legacy), registry);
        } catch (e) {
          return {
            ok: false,
            state: null,
            message: "Legacy save could not migrate: " + e.message,
            backupAvailable: true,
            diagnostics: e.diagnostics,
          };
        }
        // Preserve original bytes before any new format write; never modify the legacy key.
        if (!read(legacyBackupKey)) storage.setItem(legacyBackupKey, legacy);
        const result = save(state);
        return result.ok
          ? {
              ok: true,
              state,
              message: "Legacy journey migrated; original backup retained.",
              migrated: true,
              backupAvailable: true,
            }
          : {
              ok: false,
              state: null,
              message:
                result.message + " Your original legacy save is unchanged.",
              backupAvailable: true,
            };
      } catch (e) {
        return {
          ok: false,
          state: null,
          message: "Browser storage is unavailable: " + e.message,
          backupAvailable: false,
        };
      }
    }
    function importSave(text) {
      try {
        const state = migrate(JSON.parse(text), registry);
        return {
          ok: true,
          state,
          message:
            "Save validated. Importing does not overwrite storage until you save.",
        };
      } catch (e) {
        return {
          ok: false,
          state: null,
          message: "Cannot import save: " + e.message,
          diagnostics: e.diagnostics,
        };
      }
    }
    function restoreBackup() {
      try {
        const raw = read(backupKey) || read(legacyBackupKey) || read(legacyKey);
        if (!raw)
          return {
            ok: false,
            state: null,
            message: "No recovery backup is available.",
          };
        return importSave(raw);
      } catch (e) {
        return { ok: false, state: null, message: e.message };
      }
    }
    return {
      load,
      save,
      export: serialise,
      import: importSave,
      restoreBackup,
      legacyBackup: () => {
        try {
          return read(legacyBackupKey) || read(legacyKey);
        } catch {
          return null;
        }
      },
      keys: { key, backupKey, legacyKey, legacyBackupKey },
    };
  }
  root.HBPersistence = { SCHEMA_VERSION, validate, migrate, create };
})(globalThis);

/* SOURCE: content/extensions/inscription.js */
/* Original inscription extension. Uses only the documented RPG extension context
 * and public engine renderer APIs. No shared runtime or vendor patch is required. */
(() => {
  'use strict';
  function inscribe(ctx, command) {
    const target=ctx.state.entities[command.target];
    const definition=target&&ctx.registry.get('prefabs',target.definition);
    const spec=definition?.inscription;
    const advertised=Array.isArray(definition?.verbs)?definition.verbs.includes('inscribe'):!!definition?.verbs?.inscribe;
    if(!spec||!advertised)throw new Error('This surface does not accept an inscription.');
    if(target.state.inscribed)throw new Error('This remembrance is already written. Let its words stand.');
    if(typeof spec.words!=='string'||!spec.words.trim())throw new Error('Inscription content needs non-empty words.');
    const costs=definition.costs?.items||{};
    if(!Object.keys(costs).length)throw new Error('Inscription content needs at least one material.');
    for(const [item,count] of Object.entries(costs)) {
      const material=ctx.registry.require('items',item);
      if(!Number.isInteger(count)||count<1)throw new Error('Inscription material quantities must be positive integers.');
      if(!ctx.check({op:'item',item,count,owner:'$actor'}))throw new Error(`Requires ${count} ${material.name}. Gather fresh silverleaf in the garden.`);
    }
    // All effects participate in the caller's draft transaction. A later failure
    // discards material costs, the mark, the reward and every emitted event.
    ctx.apply([
      ...Object.entries(costs).map(([item,count])=>({op:'item',item,count:-count,owner:'$actor'})),
      {op:'entity',target:'$target',key:'inscribed',value:true},
      {op:'entity',target:'$target',key:'inscription',value:spec.words},
      ...(spec.effects||[])
    ]);
    ctx.emit({kind:'inscription',target:target.id,message:spec.message||spec.words});
  }
  function stone({renderer:r,entity,engine:E},visual) {
    const {x,y,z=0}=entity,lit=!!entity.state?.inscribed;
    r.prop('pillar',x,y,z,{size:visual.size||.65,color:lit?'#c5ad70':'#738b83',broken:true});
    r.queue(x,y,z,g=>{
      for(let row=0;row<3;row++) {
        const a=r.w(x-5,y+4,z+11+row*3),b=r.w(x+5-row,y+4,z+11+row*3);
        E.px.line(g,a[0],a[1],b[0],b[1],lit?'#f3d997':'#405c54');
      }
    });
  }
  (globalThis.HBExtensions ||= []).push({
    id:'inscription:extension',verbs:{inscribe},renderers:{'inscription:stone':stone}
  });
})();

/* SOURCE: content/extensions/shore-signal.js */
/* A saved lamp state changes its light. No simulation changes occur in rendering. */
(globalThis.HBExtensions ||= []).push({
  renderers: {
    'shore:signal'({renderer, entity}) {
      renderer.prop('pillar', entity.x, entity.y, entity.z || 0, {color: '#6f817b', size: 0.8});
      if (entity.state.lit) {
        renderer.prop('lantern', entity.x, entity.y, (entity.z || 0) + 24, {size: 1.2});
      } else {
        renderer.prop('pot', entity.x, entity.y, (entity.z || 0) + 24, {color: '#4c5e61'});
      }
    }
  }
});

/* SOURCE: src/rpg/narrative.js */
/* Small data-driven narrative projection. No story IDs or evaluated expressions. */
(function (root) {
  'use strict';

  const MAX_DEPTH = 24;

  function createNarrative(runtime) {
    const { registry, state } = runtime;
    const queries = Object.assign({}, ...registry.packs.map(pack => pack.queries || {}));
    const context = { lastMessage: '' };
    const check = condition => condition === undefined || runtime.check(condition);

    function objectives(questId, group) {
      const quest = registry.require('quests', questId);
      return (quest.objectives || []).filter(entry => !group || entry.group === group);
    }

    function query(name, depth = 0) {
      if (depth > MAX_DEPTH) throw new Error('Narrative query recursion exceeds 24 levels: ' + name);
      if (name === 'lastMessage') return context.lastMessage;
      const record = queries[name];
      if (!record) throw new Error('Unknown narrative query {{' + name + '}}. Add it to pack.queries.');
      switch (record.type) {
        case 'abilityCost': {
          const costs = registry.require('abilities', record.ability).costs || {};
          return record.item ? costs.items?.[record.item] || 0 : costs[record.key] || 0;
        }
        case 'objectiveCount':
          return objectives(record.quest, record.group).filter(entry => check(entry.condition)).length;
        case 'objectiveTotal':
          return objectives(record.quest, record.group).length;
        case 'objective':
          return objective(record.quest, depth + 1);
        case 'missing': {
          const quest = registry.require('quests', record.quest);
          const entries = [
            ...(record.includeRequirements ? quest.requirements || [] : []),
            ...objectives(record.quest, record.group)
          ];
          return entries.filter(entry => !check(entry.condition))
            .map(entry => text(entry.missingText || entry.text || entry.title, depth + 1))
            .filter(Boolean).join(record.separator || '\n\n');
        }
        case 'text':
          return text(record.value, depth + 1);
        case 'stat':
          return state[record.key] ?? '';
        default:
          throw new Error('Unsupported narrative query type: ' + record.type);
      }
    }

    function text(value, depth = 0) {
      if (depth > MAX_DEPTH) throw new Error('Narrative text nesting exceeds 24 levels.');
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') {
        return value.replace(/\{\{([\w:.-]+)\}\}/g, (_, name) => String(query(name, depth + 1)));
      }
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (Array.isArray(value.join)) {
        return value.join.map(part => text(part, depth + 1)).filter(Boolean)
          .join(value.separator === undefined ? '\n\n' : value.separator);
      }
      if (Array.isArray(value.cases)) {
        const branch = value.cases.find(entry => check(entry.when));
        return text(branch ? branch.text : value.default, depth + 1);
      }
      throw new Error('Narrative text must be a string, {cases,default}, or {join,separator}.');
    }

    function dialogue(id, depth = 0) {
      if (depth > MAX_DEPTH) throw new Error('Dialogue redirect loop near ' + id);
      if (!id) return null;
      const record = typeof id === 'object' ? id : registry.require('dialogues', id);
      const variant = (record.variants || []).find(entry => check(entry.when));
      const selected = variant ? { ...record, ...variant } : record;
      if (selected.redirect) return dialogue(selected.redirect, depth + 1);
      const choices = (selected.choices || []).filter(choice => check(choice.when)).map(choice => {
        const enabled = check(choice.conditions) && !(choice.disabledWhen && check(choice.disabledWhen));
        const reason = enabled ? '' : text(choice.reason) || runtime.explain(choice.conditions || { op: 'not', condition: choice.disabledWhen });
        const output = {
          ...choice,
          label: text(choice.label),
          ...(choice.action !== undefined ? { action: text(choice.action) } : {}),
          disabled: !enabled,
          reason
        };
        return output;
      });
      return {
        id: record.id,
        title: text(selected.title),
        subtitle: text(selected.subtitle),
        text: text(selected.text),
        portrait: selected.portrait || '',
        choices: choices.length ? choices : [{ label: 'Leave', action: 'close' }]
      };
    }

    function isComplete(quest) {
      const record = state.quests[quest.id];
      return record?.state === 'complete' || !!record?.rewarded.includes('completion');
    }

    function objective(questId, depth = 0) {
      if (questId === undefined) {
        const tracked = registry.get('quests', state.trackedQuest);
        questId = tracked && check(tracked.visibleWhen) && !isComplete(tracked)
          ? tracked.id : registry.settings.primaryQuest;
      }
      if (!questId) return 'Explore and speak to the people you meet.';
      const quest = registry.require('quests', questId);
      const entry = (quest.objectiveVariants || []).find(candidate => check(candidate.when));
      if (entry) return text(entry.text, depth + 1);
      const next = (quest.objectives || []).find(candidate => candidate.required !== false && check(candidate.visibleWhen) && !check(candidate.condition));
      return text(next ? next.text || next.title : quest.completedText || 'Quest complete.', depth + 1);
    }

    function journal(questId) {
      const quests = questId ? [registry.require('quests', questId)] : registry.all('quests');
      return quests.filter(quest => check(quest.visibleWhen)).flatMap(quest => {
        const entries = quest.objectives || [];
        return entries.filter(entry => check(entry.visibleWhen)).map(entry => {
          const done = check(entry.condition);
          return {
            id: quest.id + ':' + entry.id,
            quest: quest.id,
            questTitle: text(quest.title || quest.id),
            questComplete: isComplete(quest),
            tracked: state.trackedQuest === quest.id,
            primary: registry.settings.primaryQuest === quest.id,
            title: text(entry.title),
            text: text(done ? entry.completedText || entry.text : entry.text),
            done,
            optional: entry.required === false
          };
        });
      });
    }

    function progress(questId = registry.settings.primaryQuest, group = 'evidence') {
      if (!questId) return { count: 0, total: 0 };
      const entries = objectives(questId, group);
      return { count: entries.filter(entry => check(entry.condition)).length, total: entries.length };
    }

    return { dialogue, objective, journal, progress, text, query, context };
  }

  root.HBNarrative = { create: createNarrative };
})(globalThis);

/* SOURCE: src/rpg/content-api.js */
/* Public browser/test facade over the shared command and narrative systems. */
(function (root) {
  'use strict';

  let registryCache;
  let registeredPacks;

  function getRegistry() {
    if (!registryCache || registeredPacks !== root.HBPacks || registryCache.packs.length !== root.HBPacks.length) {
      registryCache = root.HBRPG.createRegistry(root.HBPacks || [], root.HBExtensions || {});
      registeredPacks = root.HBPacks;
    }
    return registryCache;
  }

  function createState(registry = getRegistry()) {
    return root.HBRPG.createState(registry);
  }

  function createModel(inputState, onChange, options = {}) {
    const registry = options.registry || getRegistry();
    const state = inputState || createState(registry);
    let narrative;
    const notify = typeof onChange === 'function' ? onChange : function () {};
    const runtime = root.HBRPG.createRuntime(registry, state, event => {
      const message = event.message && narrative ? narrative.text(event.message) : event.message;
      notify({ ...event, message });
    });
    narrative = root.HBNarrative.create(runtime);
    let lastResult = null;

    function command(input) {
      const result = runtime.command(input);
      narrative.context.lastMessage = result.message || '';
      if (result.message) result.message = narrative.text(result.message);
      if (result.dialogue) result.dialogue = narrative.dialogue(result.dialogue);
      lastResult = result;
      return result;
    }

    function interact(id) {
      const entity = state.entities && state.entities[id];
      if (entity) {
        const definition = registry.get(entity.kind === 'actor' ? 'actors' : 'prefabs', entity.definition);
        if (definition && definition.dialogue) return narrative.dialogue(definition.dialogue);
      }
      const record = registry.get('dialogues', id) || registry.get('dialogues', 'talk:' + id);
      return record ? narrative.dialogue(record.id) : null;
    }

    function choose(id, context = {}) {
      if (!id || id === 'close') return null;
      if (typeof id === 'object') return command(id).dialogue || null;
      if (id.startsWith('talk:')) return interact(id.slice(5));
      const definition = registry.get('actions', id);
      if (!definition) {
        lastResult = { ok: false, message: 'Unknown action "' + id + '". Define it in a loaded content pack.', events: [] };
        notify({ message: lastResult.message, kind: 'warning' });
        return null;
      }
      return command({ type: 'action', id: definition.id, ...context }).dialogue || null;
    }

    function cast(ability, context = {}) {
      return command({ type: 'cast', ability, ...context });
    }

    function items() {
      return Object.entries(state.inventory).filter(([, count]) => Number(count) > 0).map(([id, count]) => {
        const instance = state.itemInstances && state.itemInstances[id];
        const definition = registry.get('items', instance ? instance.definition : id);
        return {
          id,
          definition: definition ? definition.id : id,
          name: definition ? definition.name : id,
          description: definition ? definition.description || '' : 'A preserved item whose definition is unavailable.',
          count,
          icon: definition ? definition.icon || '◇' : '◇',
          ...(definition && (definition.useAction || definition.use) ? { action: id } : {})
        };
      });
    }

    function useItem(id) {
      const instance = state.itemInstances && state.itemInstances[id];
      const item = registry.get('items', instance ? instance.definition : id);
      if (item && item.useAction) return choose(item.useAction);
      if (item && item.use) return command({ type: 'useItem', item: id }).dialogue || null;
      return {
        title: item ? item.name : 'Empty pocket',
        subtitle: registry.settings.presentation?.fieldLocation || 'Field notes',
        text: item ? item.description : 'You are not carrying that item.',
        portrait: '',
        choices: [{ label: 'Leave', action: 'close' }]
      };
    }

    return {
      state,
      registry,
      runtime,
      narrative,
      command,
      interact,
      choose,
      cast,
      items,
      useItem,
      dialogue: narrative.dialogue,
      objective: narrative.objective,
      journal: narrative.journal,
      clueCount: () => narrative.progress().count,
      clueTotal: () => narrative.progress().total,
      get lastResult() { return lastResult; }
    };
  }

  const api = { getRegistry, createState, createModel };
  Object.defineProperty(api, 'registry', { get: getRegistry });
  root.HBContent = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
