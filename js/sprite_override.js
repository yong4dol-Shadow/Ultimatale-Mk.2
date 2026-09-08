/* =====================================================================
   sprite_override.js - swap in your own artwork.

   Anything declared here REPLACES the generated sheet of the same name
   at load time, so you can drop a hand-drawn Shadow (or any other
   actor) into the game without touching the renderer.

   Generate the entry for a PNG you already have with:

       python3 tools/import_sheet.py shadow my_shadow_sheet.png \
               --fw 40 --fh 44 --cols 9

   That inlines the file as base64 so the game still runs from file://.
   Leave this file as-is to use the procedurally generated sprites.

   Frame layout expected for an actor sheet (left to right):
       0,1        idle
       2,3,4,5    walk / skate
       6,7        attack
       8          hurt
   `names` maps those roles to frame indices - adjust it if your sheet
   is laid out differently.
   ===================================================================== */
window.SH = window.SH || {};
SH.SpriteOverrides = {
  /* example - uncomment and point at your own file:

  shadow: {
    src: 'assets/sprites/shadow_custom.png',
    fw: 40, fh: 44, cols: 9, frames: 9,
    names: { idle: [0, 1], walk: [2, 3, 4, 5], attack: [6, 7], hurt: [8] }
  }

  */
};
