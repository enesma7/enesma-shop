# Credits

## Brand

- E SHOP lockup: ENESMA Realty (`assets/logo/eshop-lockup.svg`).
- ENESMA Realty wordmark and hexagon emblem, recolored for garment decals from the marks used on enesmarealty.com and the ENESMA apps.
- Inter, Latin subset, from the ENESMA marketing site. Licensed under the SIL Open Font License.

## 3D

Garment meshes (`models/t-shirt.glb`, `polo.glb`, `quarter-zip.glb`, `cap.glb`) are original geometry written for this shop in `scripts/garments.mjs`. They are not copied from a third-party model. Product stills in `assets/renders/` are renders of these meshes, plus simple original sign and card geometry in `tools/studio.js`.

- [three.js](https://github.com/threejs/three.js) r170 — MIT License. Vendored under `vendor/three/`.
- Closet lighting uses three.js `RoomEnvironment` (MIT).

No separate CC0 garment file was bundled. Permissively licensed downloads that were available were either low-poly props or not licensed for redistribution in a form we could verify, so the apparel was built for the shop instead.

## Tooling used to generate assets (not shipped to the site)

- [@gltf-transform/core](https://github.com/donmccurdy/glTF-Transform) — MIT.
- sharp — Apache-2.0.
