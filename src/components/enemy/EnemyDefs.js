import * as THREE from 'three';

// ── Boss composite mesh builders ─────────────────────────────────────────────

function mat(color, emissiveMult = 0.5, metalness = 0.55, roughness = 0.35) {
  return new THREE.MeshStandardMaterial({
    color,
    emissive: new THREE.Color(color).multiplyScalar(emissiveMult),
    metalness,
    roughness,
  });
}

/** Base boss: purple command cruiser with central sphere, side nacelles, engine pods. */
function buildBaseBossGroup() {
  const g = new THREE.Group();

  // Central core sphere
  const core = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 12), mat(0xaa00ff));
  g.add(core);

  // Armored side nacelles
  const nacelleGeo = new THREE.BoxGeometry(6, 1.2, 2.5);
  const nacelleL = new THREE.Mesh(nacelleGeo, mat(0x7700cc));
  nacelleL.position.set(-4.5, 0, 0.5);
  g.add(nacelleL);
  const nacelleR = new THREE.Mesh(nacelleGeo, mat(0x7700cc));
  nacelleR.position.set(4.5, 0, 0.5);
  g.add(nacelleR);

  // Engine pods (rear)
  const podGeo = new THREE.CylinderGeometry(0.8, 1.2, 2.5, 8);
  [-3.5, 3.5].forEach(x => {
    const pod = new THREE.Mesh(podGeo, mat(0x440066));
    pod.rotation.x = Math.PI / 2;
    pod.position.set(x, -0.3, 2.8);
    g.add(pod);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.75, 12),
      new THREE.MeshBasicMaterial({ color: 0xcc44ff })
    );
    glow.rotation.y = Math.PI;
    glow.position.set(x, -0.3, 4.2);
    g.add(glow);
  });

  // Command bridge (top-front)
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2.2), mat(0x880099));
  bridge.position.set(0, 2.2, -1.2);
  g.add(bridge);

  // Forward cannon
  const cannon = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.7, 2.8, 6), mat(0x550077));
  cannon.rotation.x = Math.PI / 2;
  cannon.position.set(0, 0, -4.2);
  g.add(cannon);

  return g;
}

/** Fortress boss: gray-blue space station with command deck, dome, side wings, turrets. */
function buildFortressBossGroup() {
  const g = new THREE.Group();

  // Main command deck
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 6), mat(0x556677));
  g.add(deck);

  // Armored dome on top
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x445566));
  dome.position.set(0, 1.5, -0.5);
  g.add(dome);

  // Side wing extensions
  const wingGeo = new THREE.BoxGeometry(4, 1.5, 5.5);
  const wingL = new THREE.Mesh(wingGeo, mat(0x445566));
  wingL.position.set(-6, -0.5, 0);
  g.add(wingL);
  const wingR = new THREE.Mesh(wingGeo, mat(0x445566));
  wingR.position.set(6, -0.5, 0);
  g.add(wingR);

  // Corner turrets (4x)
  const turretGeo = new THREE.CylinderGeometry(0.6, 0.8, 2.5, 6);
  [[-3.5, -3], [3.5, -3], [-3.5, 3], [3.5, 3]].forEach(([x, z]) => {
    const turret = new THREE.Mesh(turretGeo, mat(0x667788));
    turret.position.set(x, 1.5, z);
    g.add(turret);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.5, 6), mat(0x778899));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(x, 2.5, z - 1.8);
    g.add(barrel);
  });

  // Rear thruster array (3x)
  const thrusterGeo = new THREE.CylinderGeometry(1, 1.3, 1.8, 8);
  [-2.5, 0, 2.5].forEach(x => {
    const thr = new THREE.Mesh(thrusterGeo, mat(0x334455));
    thr.rotation.x = Math.PI / 2;
    thr.position.set(x, -0.5, 3.8);
    g.add(thr);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(0.9, 10),
      new THREE.MeshBasicMaterial({ color: 0x4488cc })
    );
    glow.rotation.y = Math.PI;
    glow.position.set(x, -0.5, 4.8);
    g.add(glow);
  });

  return g;
}

/** Titan boss: steel-blue dreadnought with long spine, command bridge, heavy engines, side guns. */
function buildTitanBossGroup() {
  const g = new THREE.Group();

  // Primary spine hull
  const spine = new THREE.Mesh(new THREE.BoxGeometry(4, 2.5, 12), mat(0x6688aa));
  g.add(spine);

  // Elevated command bridge
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3, 4.5), mat(0x557799));
  bridge.position.set(0, 2.2, -2.5);
  g.add(bridge);

  // Sensor array on bridge nose
  const sensor = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), mat(0x7799bb));
  sensor.position.set(0, 2.5, -5.2);
  g.add(sensor);

  // Heavy engine clusters (rear)
  const engineGeo = new THREE.CylinderGeometry(1, 1.5, 3.5, 8);
  [-3, 3].forEach(x => {
    const eng = new THREE.Mesh(engineGeo, mat(0x445566));
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, -0.5, 5.2);
    g.add(eng);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1, 10),
      new THREE.MeshBasicMaterial({ color: 0x44aaff })
    );
    glow.rotation.y = Math.PI;
    glow.position.set(x, -0.5, 7.0);
    g.add(glow);
  });

  // Side gun emplacements
  const gunGeo = new THREE.BoxGeometry(1.2, 1.2, 4);
  [-3.5, 3.5].forEach(x => {
    const gun = new THREE.Mesh(gunGeo, mat(0x7799bb));
    gun.position.set(x, 0.5, -1.5);
    g.add(gun);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2, 6), mat(0x5577aa));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(x, 0.5, -4);
    g.add(barrel);
  });

  // Armor plating (side skirts)
  const plateGeo = new THREE.BoxGeometry(1, 1.5, 7);
  [-3, 3].forEach(x => {
    const plate = new THREE.Mesh(plateGeo, mat(0x4a6680));
    plate.position.set(x, -1.5, 0.5);
    g.add(plate);
  });

  return g;
}

/** Eclipser boss: near-black shadow carrier — flat disc hull, swept wings, center void orb, energy ring. */
function buildEclipserBossGroup() {
  const g = new THREE.Group();

  // Flat primary disc hull
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.8, 20), mat(0x222233));
  g.add(disc);

  // Swept wing panels
  const wingGeo = new THREE.BoxGeometry(4.5, 0.5, 7.5);
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(wingGeo, mat(0x1a1a2a));
    wing.position.set(side * 6.5, 0, 0.5);
    wing.rotation.y = side * 0.15;
    g.add(wing);
  });

  // Elevated center void orb
  const orb = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), mat(0x110011, 0.3));
  orb.position.set(0, 1.2, 0);
  g.add(orb);

  // Pulsing energy ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.3, 8, 24), mat(0x444488, 0.8));
  ring.position.set(0, 1.0, 0);
  g.add(ring);

  // Secondary inner ring
  const innerRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.2, 6, 18), mat(0x333366, 0.7));
  innerRing.position.set(0, 1.0, 0);
  g.add(innerRing);

  // Underbelly keel fins
  const finGeo = new THREE.BoxGeometry(0.7, 1.8, 6);
  [-2, 0, 2].forEach(x => {
    const fin = new THREE.Mesh(finGeo, mat(0x333344));
    fin.position.set(x, -1.2, 0);
    g.add(fin);
  });

  // Wing-tip void emitters
  [-7, 7].forEach(x => {
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), mat(0x222244, 0.9));
    emitter.position.set(x, 0.2, 0.5);
    g.add(emitter);
  });

  return g;
}

/** Zigzagger boss: orange speed interceptor — swept delta wings, narrow fuselage, twin afterburners. */
function buildZigzaggerBossGroup() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 14), mat(0xff6600)));
  // Delta wings
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 7), mat(0xcc4400));
    wing.position.set(side * 5, -0.2, 1.5);
    wing.rotation.y = side * 0.25;
    g.add(wing);
  });
  // Nose spike
  const nose = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.7, 5, 5), mat(0xff8820));
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, 0, -8.5);
  g.add(nose);
  // Twin afterburner pods
  [-1.4, 1.4].forEach(x => {
    const eng = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1, 4, 8), mat(0x882200));
    eng.rotation.x = Math.PI / 2;
    eng.position.set(x, 0, 7);
    g.add(eng);
    const flame = new THREE.Mesh(new THREE.CircleGeometry(0.65, 10), new THREE.MeshBasicMaterial({ color: 0xff6600 }));
    flame.position.set(x, 0, 9.1);
    flame.rotation.set(0, Math.PI, 0);
    g.add(flame);
  });
  // Cockpit
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), mat(0xff4400, 0.8));
  cockpit.position.set(0, 0.8, -4.5);
  g.add(cockpit);
  return g;
}

/** Mirror drone boss: cyan reflector array — central orb flanked by large angled mirror panels. */
function buildMirrorDroneBossGroup() {
  const g = new THREE.Group();
  // Central emitter orb
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.5, 12, 10), mat(0x88eeff));
  g.add(core);
  // Large flat mirror panels (4x, angled outward)
  const panelAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  panelAngles.forEach(angle => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(5.5, 5, 0.2), mat(0x44ccdd, 0.7, 0.9, 0.05));
    panel.position.set(Math.sin(angle) * 6, 0, Math.cos(angle) * 6);
    panel.rotation.y = angle;
    g.add(panel);
    // Frame
    const frame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.3, 0.3), mat(0x227788));
    frame.position.copy(panel.position);
    frame.rotation.y = angle;
    frame.position.y = 2.7;
    g.add(frame);
  });
  // Connecting arms
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(angle => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 5.5, 5), mat(0x336677));
    arm.rotation.z = Math.PI / 2;
    arm.position.set(Math.sin(angle) * 3, 0, Math.cos(angle) * 3);
    arm.rotation.y = angle;
    arm.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    g.add(arm);
  });
  return g;
}

/** Flare ship boss: amber launch platform — elongated body, forward ring launcher, flare tube battery. */
function buildFlareShipBossGroup() {
  const g = new THREE.Group();
  // Main hull
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 12, 7), mat(0xffaa44));
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  // Nose cone
  const nose = new THREE.Mesh(new THREE.ConeGeometry(2.5, 5, 7), mat(0xee8822));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -8.5;
  g.add(nose);
  // Launch ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5, 0.7, 7, 20), mat(0xcc6600));
  ring.position.z = 2;
  g.add(ring);
  // Flare tubes (6x around the ring)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.6, 4, 6), mat(0xdd7700));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(Math.sin(angle) * 5, Math.cos(angle) * 5, 0);
    g.add(tube);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.4, 8), new THREE.MeshBasicMaterial({ color: 0xff8800 }));
    glow.rotation.y = Math.PI;
    glow.position.set(Math.sin(angle) * 5, Math.cos(angle) * 5, -2.1);
    g.add(glow);
  }
  // Rear engine bell
  const engine = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 3, 8), mat(0x884400));
  engine.rotation.x = Math.PI / 2;
  engine.position.z = 7.5;
  g.add(engine);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 10), new THREE.MeshBasicMaterial({ color: 0xffaa44 }));
  glow.rotation.y = Math.PI;
  glow.position.z = 9.1;
  g.add(glow);
  return g;
}

/** Plasma eater boss: magenta organic consumer — bulbous body, three intake maws, conduit tubes. */
function buildPlasmaEaterBossGroup() {
  const g = new THREE.Group();
  // Bulbous main body
  const body = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 10), mat(0xff00cc));
  body.scale.set(1, 0.8, 1);
  g.add(body);
  // Intake maw rings (3x front)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const maw = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.6, 7, 14), mat(0xcc0099));
    maw.position.set(Math.sin(angle) * 3, Math.cos(angle) * 3, -4);
    g.add(maw);
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.5, 3.5, 7), mat(0x880066));
    throat.rotation.x = Math.PI / 2;
    throat.position.set(Math.sin(angle) * 3, Math.cos(angle) * 3, -2.5);
    g.add(throat);
  }
  // Conduit tubes along body
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 7, 5), mat(0xaa0077));
    tube.position.set(Math.sin(angle) * 4.5, Math.cos(angle) * 3.5, 0);
    g.add(tube);
  }
  // Rear propulsion nub
  const nub = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), mat(0xdd00bb));
  nub.position.z = 5.5;
  g.add(nub);
  return g;
}

/** Prism shard boss: red crystalline entity — tetrahedron core with radiating crystal spikes. */
function buildPrismShardBossGroup() {
  const g = new THREE.Group();
  // Crystal core
  const core = new THREE.Mesh(new THREE.TetrahedronGeometry(4), mat(0xff1133));
  g.add(core);
  // Radiating crystal shards (8x)
  const shardDirs = [
    [1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]
  ].map(d => new THREE.Vector3(...d).normalize());
  shardDirs.forEach(dir => {
    const shard = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 5.5), mat(0xcc0022, 0.4));
    shard.position.copy(dir.clone().multiplyScalar(5.5));
    shard.lookAt(dir.clone().multiplyScalar(12));
    g.add(shard);
  });
  // Inner glow sphere
  const glow = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), mat(0xff4455, 0.9));
  g.add(glow);
  // Outer crystal cage rings
  [Math.PI / 2, 0, Math.PI / 4].forEach(rx => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.25, 6, 18), mat(0xff2244, 0.6));
    ring.rotation.x = rx;
    g.add(ring);
  });
  return g;
}

/** Corroder boss: acid-green ship — icosahedron hull, acid vent chimneys, corrosive drip pods. */
function buildCorrorderBossGroup() {
  const g = new THREE.Group();
  // Icosahedron hull
  const hull = new THREE.Mesh(new THREE.IcosahedronGeometry(5, 1), mat(0x88aa44));
  g.add(hull);
  // Acid vent chimneys (4x top)
  const ventGeo = new THREE.CylinderGeometry(0.6, 1, 3.5, 6);
  [[-2,2],[-2,-2],[2,2],[2,-2]].forEach(([x,z]) => {
    const vent = new THREE.Mesh(ventGeo, mat(0x99bb33));
    vent.position.set(x, 4, z);
    g.add(vent);
    const cloud = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5), mat(0xaacc22, 0.8));
    cloud.position.set(x, 6.2, z);
    g.add(cloud);
  });
  // Drip pods (3x bottom)
  [-2.5, 0, 2.5].forEach(x => {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(1.3, 7, 6), mat(0x66aa11));
    pod.position.set(x, -5.5, 0);
    pod.scale.y = 1.4;
    g.add(pod);
  });
  // Corroded side plates
  [-1, 1].forEach(side => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.6, 5), mat(0x7a9933));
    plate.position.set(side * 5.5, 0, 0);
    plate.rotation.y = side * 0.2;
    g.add(plate);
  });
  return g;
}

/** Nullifier boss: cyan energy suppressor — tall column, stacked suppression rings, antenna spires. */
function buildNullifierBossGroup() {
  const g = new THREE.Group();
  // Central column
  const col = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 12, 10), mat(0x00ccff));
  g.add(col);
  // Stacked suppression rings (3x)
  [-3, 0, 3].forEach(y => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.5, 7, 22), mat(0x0099cc, 0.7));
    ring.position.y = y;
    g.add(ring);
  });
  // Top emitter dome
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x22ddff, 0.8));
  dome.position.y = 6;
  g.add(dome);
  // Antenna spires (4x)
  [[-2,-2],[-2,2],[2,-2],[2,2]].forEach(([x,z]) => {
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.35, 7, 4), mat(0x007799));
    spire.position.set(x, 5, z);
    g.add(spire);
  });
  // Base anchor
  const base = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.5, 1.5, 10), mat(0x005588));
  base.position.y = -6.8;
  g.add(base);
  return g;
}

/** Scatter drone boss: yellow explosive carrier — ring hull with core sphere, perimeter launch bays. */
function buildScatterDroneBossGroup() {
  const g = new THREE.Group();
  // Torus ring hull
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.5, 2, 9, 22), mat(0xffcc00));
  g.add(ring);
  // Central command sphere
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.5, 10, 8), mat(0xdd9900));
  g.add(core);
  // Connecting spokes (4x)
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(angle => {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 5, 5), mat(0xcc8800));
    spoke.rotation.z = Math.PI / 2;
    spoke.position.set(Math.sin(angle) * 3.5, Math.cos(angle) * 3.5, 0);
    spoke.rotation.copy(new THREE.Euler(0, 0, angle));
    g.add(spoke);
  });
  // Launch bays (6x around outer ring)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const bay = new THREE.Mesh(new THREE.BoxGeometry(2, 1.2, 1.2), mat(0xee9900));
    bay.position.set(Math.sin(angle) * 5.5, Math.cos(angle) * 5.5, 0);
    bay.rotation.z = angle;
    g.add(bay);
  }
  // Detonator fin cross
  [0, Math.PI / 2].forEach(r => {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.5, 4, 0.5), mat(0xffdd33));
    fin.rotation.z = r;
    g.add(fin);
  });
  return g;
}

/** Anchor mine boss: brown spiked mine — heavy sphere with radiating spike arms and trigger nodes. */
function buildAnchorMineBossGroup() {
  const g = new THREE.Group();
  // Mine body
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(5, 0), mat(0x886644));
  g.add(body);
  // Spike arms (8x, in cube-diagonal directions)
  [
    [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1],
    [1,1,0].map(v=>v/Math.SQRT2),[-1,1,0].map(v=>v/Math.SQRT2),
  ].forEach(raw => {
    const dir = new THREE.Vector3(...raw).normalize();
    const spike = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 6, 5), mat(0x997755));
    spike.position.copy(dir.clone().multiplyScalar(6));
    spike.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(spike);
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.7, 6, 5), mat(0xaabb77));
    node.position.copy(dir.clone().multiplyScalar(9.5));
    g.add(node);
  });
  // Equatorial band
  const band = new THREE.Mesh(new THREE.TorusGeometry(5.5, 0.5, 5, 20), mat(0x665533));
  g.add(band);
  return g;
}

/** Repair jammer boss: bright-green signal tower — tall column, cross-arm antenna, jamming dish. */
function buildRepairJammerBossGroup() {
  const g = new THREE.Group();
  // Central tower
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 14, 8), mat(0x44ff66));
  g.add(tower);
  // Horizontal cross arms
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(9, 0.8, 0.8), mat(0x33cc55));
    arm.position.set(0, side * 3, 0);
    g.add(arm);
    // Tip antennae
    [-4.5, 4.5].forEach(x => {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 5, 4), mat(0x22ff44));
      ant.position.set(x, side * 3 + 2.5, 0);
      g.add(ant);
    });
  });
  // Jamming dish
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 0.8, 1.5, 14), mat(0x55ee77));
  dish.rotation.x = Math.PI;
  dish.position.y = 2.5;
  g.add(dish);
  // Base stabilizers
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(angle => {
    const stab = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 4), mat(0x228844));
    stab.position.set(Math.sin(angle) * 4, -7.5, Math.cos(angle) * 4);
    stab.rotation.y = angle;
    g.add(stab);
  });
  return g;
}

/** Gravity anchor boss: violet singularity — massive sphere with interlocking orbital rings. */
function buildGravityAnchorBossGroup() {
  const g = new THREE.Group();
  // Singularity core
  const core = new THREE.Mesh(new THREE.SphereGeometry(4.5, 14, 10), mat(0x6633ff));
  g.add(core);
  // Inner bright core
  const inner = new THREE.Mesh(new THREE.SphereGeometry(2.5, 10, 8), mat(0x9955ff, 0.9));
  g.add(inner);
  // Orbital rings (3x, different axes)
  [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(Math.PI / 2, 0, 0),
    new THREE.Euler(Math.PI / 4, Math.PI / 4, 0),
  ].forEach(rot => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.55, 7, 26), mat(0x4422cc, 0.6));
    ring.rotation.copy(rot);
    g.add(ring);
  });
  // Graviton emitter nodes (4x on outer ring)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const node = new THREE.Mesh(new THREE.SphereGeometry(1.2, 8, 6), mat(0x8844ff));
    node.position.set(Math.sin(angle) * 7, Math.cos(angle) * 7, 0);
    g.add(node);
  }
  return g;
}

/** Ghost ship boss: gray spectral wraith — elongated tapered hull, gossamer wings, phase emitters. */
function buildGhostShipBossGroup() {
  const g = new THREE.Group();
  // Elongated wraith hull
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1, 3, 18, 6), mat(0x888899));
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  // Gossamer thin wings
  [-1, 1].forEach(side => {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(8, 0.2, 7), mat(0x667788, 0.3));
    wing.position.set(side * 6, 0, 1);
    wing.rotation.y = side * 0.1;
    g.add(wing);
  });
  // Phase shift emitters along hull (3x)
  [-4, 0, 4].forEach(z => {
    const emitter = new THREE.Mesh(new THREE.SphereGeometry(0.8, 7, 6), mat(0xaabbcc, 0.7));
    emitter.position.set(0, 1.2, z);
    g.add(emitter);
  });
  // Ectoplasmic bow orb
  const bow = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), mat(0x99aabb, 0.6));
  bow.position.z = -9.5;
  g.add(bow);
  // Trailing wake fin
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 5), mat(0x556677));
  fin.position.z = 8;
  g.add(fin);
  return g;
}

/** Wreck animator boss: green scrap-metal hulk — asymmetric salvaged body, mismatched components. */
function buildWreckAnimatorBossGroup() {
  const g = new THREE.Group();
  // Main salvaged block
  const main = new THREE.Mesh(new THREE.BoxGeometry(8, 4.5, 11), mat(0x88ff44));
  g.add(main);
  // Offset secondary block (asymmetric)
  const sec = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 7), mat(0x66cc33));
  sec.position.set(4, 1.5, -1.5);
  sec.rotation.y = 0.2;
  g.add(sec);
  // Cobbled-on top slab
  const top = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.5, 6), mat(0x55aa22));
  top.position.set(-1.5, 3.5, 1);
  g.add(top);
  // Exposed engine (sideways, offset)
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2, 5, 7), mat(0x446611));
  eng.rotation.z = Math.PI / 2;
  eng.position.set(-6, -0.5, 2);
  g.add(eng);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.4, 9), new THREE.MeshBasicMaterial({ color: 0x88ff44 }));
  glow.rotation.y = Math.PI / 2;
  glow.position.set(-8.7, -0.5, 2);
  g.add(glow);
  // Junk protrusions
  [[3, 3, -4],[-2, 2.5, 4.5],[5, -1.5, 3]].forEach(([x,y,z]) => {
    const junk = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 2.5), mat(0x77ee33));
    junk.position.set(x, y, z);
    junk.rotation.y = x * 0.4;
    g.add(junk);
  });
  return g;
}

/** Rock slinger boss: tan heavy artillery — fortified bunker body, triple barrel array, ammo magazines. */
function buildRockSlingerBossGroup() {
  const g = new THREE.Group();
  // Bunker body
  const bunker = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 9), mat(0xccaa66));
  g.add(bunker);
  // Slanted front armor
  const armor = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 2), mat(0xbbaa55));
  armor.position.set(0, 1, -5.5);
  armor.rotation.x = 0.3;
  g.add(armor);
  // Triple barrel array
  [-2.5, 0, 2.5].forEach(x => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 9, 8), mat(0x998844));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(x, 1.5, -6.5);
    g.add(barrel);
    // Muzzle ring
    const muzzle = new THREE.Mesh(new THREE.TorusGeometry(1, 0.3, 5, 12), mat(0x887733));
    muzzle.position.set(x, 1.5, -11.2);
    g.add(muzzle);
  });
  // Rear ammo magazines
  [-3, 3].forEach(x => {
    const mag = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4, 5), mat(0xaa9955));
    mag.position.set(x, 0.5, 5.5);
    g.add(mag);
  });
  // Turret cupola
  const cupola = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.5, 2, 8), mat(0xbbaa66));
  cupola.position.set(0, 4.5, -1);
  g.add(cupola);
  return g;
}

/** Power siphon boss: gold energy vampire — collection dish array feeding a glowing central core. */
function buildPowerSiphonBossGroup() {
  const g = new THREE.Group();
  // Central storage core
  const core = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10), mat(0xffd700));
  g.add(core);
  // Outer energy ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.8, 7, 22), mat(0xcc9900));
  g.add(ring);
  // Collection dishes (4x, axis-aligned)
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(angle => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 5, 5), mat(0xbb8800));
    arm.rotation.z = Math.PI / 2;
    arm.position.set(Math.sin(angle) * 4.5, Math.cos(angle) * 4.5, 0);
    arm.rotation.y = angle;
    arm.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    g.add(arm);
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(3, 0.5, 1.2, 14), mat(0xddbb00, 0.4, 0.9, 0.05));
    dish.position.set(Math.sin(angle) * 8, Math.cos(angle) * 8, 0);
    dish.rotation.copy(new THREE.Euler(Math.PI / 2, 0, angle));
    g.add(dish);
  });
  // Conduit tubes (connecting core to ring)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4, 4), mat(0xffcc00));
    tube.rotation.z = Math.PI / 2;
    tube.position.set(Math.sin(angle) * 4.5, Math.cos(angle) * 4.5, 0);
    tube.rotation.y = angle;
    tube.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    g.add(tube);
  }
  return g;
}

/** Overloader boss: orange electrical overcharger — capacitor column, arc generator towers, discharge coils. */
function buildOverloaderBossGroup() {
  const g = new THREE.Group();
  // Capacitor bank body
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 9, 9), mat(0xff6600));
  g.add(body);
  // Arc generator towers (4 corners)
  const towerGeo = new THREE.BoxGeometry(1.2, 7, 1.2);
  [[-3.5,-3.5],[3.5,-3.5],[-3.5,3.5],[3.5,3.5]].forEach(([x,z]) => {
    const tower = new THREE.Mesh(towerGeo, mat(0xcc4400));
    tower.position.set(x, 1.5, z);
    g.add(tower);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.8, 7, 6), mat(0xff9900, 0.9));
    cap.position.set(x, 5.5, z);
    g.add(cap);
  });
  // Horizontal discharge coils (2x)
  [-2, 2].forEach(y => {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(4, 0.55, 7, 18), mat(0xee5500, 0.7));
    coil.position.y = y;
    g.add(coil);
  });
  // Central emitter glow
  const emitter = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), mat(0xffbb00, 0.95));
  g.add(emitter);
  return g;
}

/** Viral agent boss: neon-green infection ship — organic icosahedron core, spore pods on stalks, tendrils. */
function buildViralAgentBossGroup() {
  const g = new THREE.Group();
  // Organic hull
  const hull = new THREE.Mesh(new THREE.IcosahedronGeometry(4.5, 1), mat(0x39ff14));
  g.add(hull);
  // Viral core glow
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.5, 10, 8), mat(0x88ff44, 0.9));
  g.add(core);
  // Spore pods on stalks (6x)
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.5, 4, 5), mat(0x22cc00));
    stalk.position.set(Math.sin(angle) * 5.5, Math.cos(angle) * 3, 0);
    stalk.lookAt(new THREE.Vector3(Math.sin(angle) * 10, Math.cos(angle) * 6, 0));
    g.add(stalk);
    const pod = new THREE.Mesh(new THREE.SphereGeometry(1.3, 7, 6), mat(0x55ff22, 0.7));
    pod.position.set(Math.sin(angle) * 7.5, Math.cos(angle) * 4.5, 0);
    g.add(pod);
  }
  // Infection tendrils (4x front)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 5, 4), mat(0x33dd00));
    tendril.rotation.x = Math.PI / 2 + Math.sin(angle) * 0.5;
    tendril.rotation.y = angle;
    tendril.position.set(Math.sin(angle) * 3.5, Math.cos(angle) * 3.5, -5);
    g.add(tendril);
  }
  return g;
}

/** Crystal leech boss: cyan crystalline parasite — octahedron body, suction maws, leech spine, crystal growths. */
function buildCrystalLeechBossGroup() {
  const g = new THREE.Group();
  // Crystal body
  const body = new THREE.Mesh(new THREE.OctahedronGeometry(5, 1), mat(0x00f5ff));
  g.add(body);
  // Inner core
  const inner = new THREE.Mesh(new THREE.SphereGeometry(2.8, 10, 8), mat(0x44ffff, 0.8));
  g.add(inner);
  // Suction maw array (3x front)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const maw = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 2.5, 9), mat(0x0099aa));
    maw.rotation.x = Math.PI / 2;
    maw.position.set(Math.sin(angle) * 3.5, Math.cos(angle) * 3.5, -4.5);
    g.add(maw);
  }
  // Leech dorsal spine
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 1.2, 9, 6), mat(0x00bbcc));
  spine.rotation.x = Math.PI / 2;
  spine.position.z = 3;
  g.add(spine);
  // Crystal growths (6x, random-ish angles)
  [
    [6,0,0],[-6,0,0],[0,6,0],[0,-6,0],[3.5,3.5,3],[-3.5,3.5,-3],
  ].forEach(([x,y,z]) => {
    const dir = new THREE.Vector3(x,y,z).normalize();
    const crystal = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.5), mat(0x00ddee, 0.5));
    crystal.position.copy(dir.clone().multiplyScalar(6.5));
    crystal.lookAt(dir.clone().multiplyScalar(14));
    g.add(crystal);
  });
  return g;
}

/** Dampener boss: purple force suppressor — wide absorption dish, heavy pillars, dampener field emitter. */
function buildDampenerBossGroup() {
  const g = new THREE.Group();
  // Central emitter core
  const core = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 10), mat(0x9b30ff));
  g.add(core);
  // Wide primary dish
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(7, 4.5, 2, 14), mat(0x7722cc));
  dish.position.y = -1;
  g.add(dish);
  // Dampener field ring
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.6, 7, 24), mat(0xaa44ff, 0.7));
  ring.position.y = 1;
  g.add(ring);
  // Heavy absorption pillars (4x)
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(angle => {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 7, 7), mat(0x6611aa));
    pillar.position.set(Math.sin(angle) * 6, 1.5, Math.cos(angle) * 6);
    g.add(pillar);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 6), mat(0xcc55ff, 0.8));
    cap.position.set(Math.sin(angle) * 6, 5.2, Math.cos(angle) * 6);
    g.add(cap);
  });
  return g;
}

/** EMP reflector boss: yellow pulse reflector — cubic charge core, four reflector dishes, EMP coil rings. */
function buildEmpReflectorBossGroup() {
  const g = new THREE.Group();
  // Charge core cube
  const core = new THREE.Mesh(new THREE.BoxGeometry(5.5, 5.5, 5.5), mat(0xffff66));
  g.add(core);
  // EMP coil rings (3x)
  [0, Math.PI / 2, Math.PI / 4].forEach(rot => {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(4.5, 0.5, 7, 18), mat(0xdddd00, 0.7));
    coil.rotation.x = rot;
    g.add(coil);
  });
  // Reflector dishes (4x sides)
  [0, Math.PI / 2, Math.PI, -Math.PI / 2].forEach(angle => {
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 0.6, 1, 14), mat(0xeeee55, 0.4, 0.9, 0.05));
    dish.rotation.x = Math.PI / 2;
    dish.position.set(Math.sin(angle) * 7, Math.cos(angle) * 7, 0);
    dish.rotation.copy(new THREE.Euler(0, angle + Math.PI / 2, Math.PI / 2));
    g.add(dish);
  });
  // Charge spires (4x corners, vertical)
  [[-3,-3],[3,-3],[-3,3],[3,3]].forEach(([x,z]) => {
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 6, 4), mat(0xffff99));
    spire.position.set(x, 5.5, z);
    g.add(spire);
  });
  return g;
}

/** Warp disruptor boss: violet space-folder — dual phase-cone hull, layered disruption rings, nexus core. */
function buildWarpDisruptorBossGroup() {
  const g = new THREE.Group();
  // Forward phase cone
  const fwd = new THREE.Mesh(new THREE.ConeGeometry(3.5, 9, 8), mat(0xaa44ff));
  fwd.rotation.x = -Math.PI / 2;
  fwd.position.z = -5;
  g.add(fwd);
  // Rear phase cone
  const rear = new THREE.Mesh(new THREE.ConeGeometry(3.5, 7, 8), mat(0x8833cc));
  rear.rotation.x = Math.PI / 2;
  rear.position.z = 4;
  g.add(rear);
  // Central nexus
  const nexus = new THREE.Mesh(new THREE.SphereGeometry(2.8, 12, 10), mat(0xcc66ff, 0.8));
  g.add(nexus);
  // Layered disruption rings (3x)
  [-3, 0, 3].forEach(y => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.5, 7, 22), mat(0x883399, 0.6));
    ring.position.y = y;
    g.add(ring);
  });
  // Phase disruption nodes (4x on middle ring)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const node = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 6), mat(0xdd77ff));
    node.position.set(Math.sin(angle) * 6, 0, Math.cos(angle) * 6);
    g.add(node);
  }
  return g;
}

/** Dense core boss: dark-violet compressed singularity — massive gravity sphere, tight compression rings, dark matter pods. */
function buildDenseCoreBossGroup() {
  const g = new THREE.Group();
  // Hyper-dense primary sphere
  const core = new THREE.Mesh(new THREE.SphereGeometry(5.5, 14, 12), mat(0x440088));
  g.add(core);
  // Compressed inner sphere
  const inner = new THREE.Mesh(new THREE.SphereGeometry(3, 10, 8), mat(0x220044, 0.2));
  g.add(inner);
  // Tight compression rings (3x different axes)
  [
    new THREE.Euler(0, 0, 0),
    new THREE.Euler(Math.PI / 2, 0, 0),
    new THREE.Euler(0, 0, Math.PI / 3),
  ].forEach(rot => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, 0.6, 6, 22), mat(0x6600aa, 0.5));
    ring.rotation.copy(rot);
    g.add(ring);
  });
  // Dark matter pods (4x)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const pod = new THREE.Mesh(new THREE.SphereGeometry(1.5, 8, 6), mat(0x330066));
    pod.position.set(Math.sin(angle) * 7.5, Math.cos(angle) * 7.5, 0);
    g.add(pod);
    const connector = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 3, 5), mat(0x550088));
    connector.rotation.z = Math.PI / 2;
    connector.position.set(Math.sin(angle) * 6, Math.cos(angle) * 6, 0);
    connector.rotation.y = angle;
    connector.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    g.add(connector);
  }
  return g;
}

/** Target analyzer boss: cyan scanning platform — forward sensor array, multi-dish analysis rig, probe launchers. */
function buildTargetAnalyzerBossGroup() {
  const g = new THREE.Group();
  // Main scanner hull
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(2, 3.5, 9, 7), mat(0x00ccff));
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  // Forward sensor array (3x dishes)
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 0.5, 1.2, 12), mat(0x0099bb, 0.4));
    dish.position.set(Math.sin(angle) * 4, Math.cos(angle) * 4, -6.5);
    g.add(dish);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 4.5, 5), mat(0x007799));
    arm.rotation.copy(new THREE.Euler(0, 0, Math.PI / 2));
    arm.position.set(Math.sin(angle) * 2.5, Math.cos(angle) * 2.5, -6.5);
    arm.rotation.y = angle;
    arm.rotateOnAxis(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    g.add(arm);
  }
  // Central data relay spire
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 10, 4), mat(0x00eeff));
  spire.position.y = 6;
  g.add(spire);
  // Probe launcher tubes (4x rear)
  [[-2,-2],[2,-2],[-2,2],[2,2]].forEach(([x,y]) => {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 4.5, 6), mat(0x0088aa));
    tube.rotation.x = Math.PI / 2;
    tube.position.set(x, y, 5.5);
    g.add(tube);
  });
  // Rear engine
  const eng = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.8, 2.5, 8), mat(0x005577));
  eng.rotation.x = Math.PI / 2;
  eng.position.z = 6.5;
  g.add(eng);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.1, 10), new THREE.MeshBasicMaterial({ color: 0x00ccff }));
  glow.rotation.y = Math.PI;
  glow.position.z = 7.9;
  g.add(glow);
  return g;
}

/** Speed matcher boss: silver velocity racer — sleek elongated hull, twin speed nacelles, swept velocity fins. */
function buildSpeedMatcherBossGroup() {
  const g = new THREE.Group();
  // Sleek primary hull
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.5, 16, 8), mat(0xeeeeff));
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  // Sharp nose spike
  const nose = new THREE.Mesh(new THREE.ConeGeometry(1.5, 6, 7), mat(0xccccee));
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -11;
  g.add(nose);
  // Twin speed nacelles
  [-3, 3].forEach(x => {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.5, 10, 8), mat(0xccddff));
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(x, 0, 1);
    g.add(nacelle);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 10), new THREE.MeshBasicMaterial({ color: 0xaaccff }));
    glow.rotation.y = Math.PI;
    glow.position.set(x, 0, 6.1);
    g.add(glow);
  });
  // Swept velocity fins (4x)
  [0.8, -0.8].forEach(y => {
    [-1, 1].forEach(side => {
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3, 7), mat(0xaabbdd));
      fin.position.set(side * 1.2, y * 2.5, 3);
      fin.rotation.z = side * y * 0.3;
      g.add(fin);
    });
  });
  // Cockpit bubble
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(1.2, 9, 7), mat(0xddeeff, 0.7));
  cockpit.position.set(0, 1.5, -5.5);
  g.add(cockpit);
  return g;
}

// ─────────────────────────────────────────────────────────────────────────────

/** Shared enemy type definitions used by the createEnemy prefab. */
export const ENEMY_DEFS = {
  scout: {
    type: 'scout',
    geometry: new THREE.ConeGeometry(0.45, 1.3, 5),
    color: 0x44ee44,
    baseHp: 20,
    baseDamage: 5,
    baseSpeed: 4.5,
    collisionRadius: 0.55,
    behavior: 'charge',
    eyeZ: 0.35,
    scale: 1,
    loot: [
      { currency: 'credits', min: 1, max: 3 },
      { currency: 'scrapMetal', min: 2, max: 5 },
      { currency: 'plasmaCrystals', min: 0, max: 1 },
      { currency: 'bioEssence', min: 0, max: 1 },
    ],
    spawnWeight: 40,
  },
  tank: {
    type: 'tank',
    geometry: new THREE.BoxGeometry(1.3, 0.8, 1.5),
    color: 0x888899,
    baseHp: 80,
    baseDamage: 10,
    baseSpeed: 1.6,
    collisionRadius: 1.1,
    behavior: 'steady',
    eyeZ: 0.45,
    scale: 1,
    loot: [
      { currency: 'credits', min: 4, max: 8 },
      { currency: 'scrapMetal', min: 5, max: 12 },
    ],
    spawnWeight: 20,
  },
  swarm: {
    type: 'swarm',
    geometry: new THREE.TetrahedronGeometry(0.5),
    color: 0x88ff88,
    baseHp: 10,
    baseDamage: 3,
    baseSpeed: 5.5,
    collisionRadius: 0.45,
    behavior: 'zigzag',
    eyeZ: 0.25,
    scale: 0.9,
    loot: [
      { currency: 'credits', min: 1, max: 2 },
      { currency: 'bioEssence', min: 1, max: 3 },
    ],
    spawnWeight: 25,
    spawnCount: 3,
  },
  sniper: {
    type: 'sniper',
    geometry: new THREE.OctahedronGeometry(0.6),
    color: 0xff4499,
    baseHp: 30,
    baseDamage: 15,
    attackSpeed: 0.5,
    baseSpeed: 2.2,
    collisionRadius: 0.65,
    behavior: 'keepRange',
    keepRangeDist: 14,
    eyeZ: 0.35,
    scale: 1,
    loot: [
      { currency: 'credits', min: 3, max: 6 },
      { currency: 'plasmaCrystals', min: 2, max: 5 },
      { currency: 'scrapMetal', min: 1, max: 3 },
    ],
    spawnWeight: 15,
  },
  boss: {
    type: 'boss',
    geometry: new THREE.TorusKnotGeometry(5, 1.8, 100, 16),
    buildGroup: buildBaseBossGroup,
    color: 0xaa00ff,
    baseHp: 300,
    baseDamage: 20,
    baseSpeed: 1.2,
    collisionRadius: 9,
    behavior: 'boss',
    attackSpeed: 0.35,
    attackPattern: 'spread',
    scale: 1,
    loot: [
      { currency: 'credits', min: 25, max: 50 },
      { currency: 'darkMatter', min: 1, max: 3 },
      { currency: 'scrapMetal', min: 15, max: 30 },
      { currency: 'plasmaCrystals', min: 8, max: 15 },
      { currency: 'bioEssence', min: 5, max: 10 },
    ],
    spawnWeight: 0,
  },

  // —— Counter campaign enemies (spawnWeight > 0 in pool when injected) ——
  zigzagger: {
    type: 'zigzagger',
    geometry: new THREE.ConeGeometry(0.35, 1.0, 4),
    color: 0xff6600,
    baseHp: 25, baseDamage: 8, baseSpeed: 6.5, collisionRadius: 0.4,
    behavior: 'zigzag_fast', eyeZ: 0.3, scale: 0.85, spawnWeight: 16,
    loot: [{ currency: 'credits', min: 2, max: 4 }],
  },
  mirror_drone: {
    type: 'mirror_drone',
    geometry: new THREE.OctahedronGeometry(0.55),
    color: 0x88eeff,
    baseHp: 32, baseDamage: 6, baseSpeed: 3.2, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 14, attackSpeed: 0.35, eyeZ: 0.3, scale: 0.9, spawnWeight: 14,
    loot: [{ currency: 'plasmaCrystals', min: 1, max: 3 }],
  },
  flare_ship: {
    type: 'flare_ship',
    geometry: new THREE.ConeGeometry(0.4, 1.1, 5),
    color: 0xffaa44,
    baseHp: 28, baseDamage: 7, baseSpeed: 4.0, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 16, eyeZ: 0.35, scale: 0.88, spawnWeight: 12,
    loot: [{ currency: 'scrapMetal', min: 2, max: 5 }],
  },
  plasma_eater: {
    type: 'plasma_eater',
    geometry: new THREE.DodecahedronGeometry(0.5),
    color: 0xff00cc,
    baseHp: 40, baseDamage: 9, baseSpeed: 2.8, collisionRadius: 0.55,
    behavior: 'steady', eyeZ: 0.3, scale: 1, spawnWeight: 14,
    loot: [{ currency: 'plasmaCrystals', min: 2, max: 6 }],
  },
  prism_shard: {
    type: 'prism_shard',
    geometry: new THREE.TetrahedronGeometry(0.55),
    color: 0xff1133,
    baseHp: 30, baseDamage: 10, baseSpeed: 3.4, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 13, attackSpeed: 0.45, eyeZ: 0.28, scale: 0.92, spawnWeight: 13,
    loot: [{ currency: 'credits', min: 3, max: 6 }],
  },
  fortress: {
    type: 'fortress',
    geometry: new THREE.BoxGeometry(2.0, 2.0, 2.5),
    color: 0x556677,
    baseHp: 180, baseDamage: 15, baseSpeed: 0.8, baseArmor: 50, collisionRadius: 1.6,
    behavior: 'steady', eyeZ: 0.55, scale: 1, spawnWeight: 10,
    loot: [{ currency: 'scrapMetal', min: 10, max: 20 }],
  },
  titan: {
    type: 'titan',
    geometry: new THREE.BoxGeometry(1.4, 1.6, 1.2),
    color: 0x6688aa,
    baseHp: 90, baseDamage: 18, baseSpeed: 1.4, collisionRadius: 1.0,
    behavior: 'charge', eyeZ: 0.4, scale: 1, spawnWeight: 12,
    loot: [{ currency: 'scrapMetal', min: 4, max: 10 }],
  },
  corroder: {
    type: 'corroder',
    geometry: new THREE.IcosahedronGeometry(0.45, 0),
    color: 0x88aa44,
    baseHp: 35, baseDamage: 5, baseSpeed: 3.0, collisionRadius: 0.48,
    behavior: 'charge', eyeZ: 0.25, scale: 0.95, spawnWeight: 14,
    loot: [{ currency: 'bioEssence', min: 1, max: 3 }],
  },
  nullifier: {
    type: 'nullifier',
    geometry: new THREE.CylinderGeometry(0.35, 0.45, 0.9, 8),
    color: 0x00ccff,
    baseHp: 34, baseDamage: 6, baseSpeed: 2.6, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 15, attackSpeed: 0.28, eyeZ: 0.32, scale: 0.9, spawnWeight: 12,
    stripPlayerShield: true,
    loot: [{ currency: 'plasmaCrystals', min: 1, max: 4 }],
  },
  scatter_drone: {
    type: 'scatter_drone',
    geometry: new THREE.TorusGeometry(0.35, 0.12, 6, 16),
    color: 0xffcc00,
    baseHp: 22, baseDamage: 4, baseSpeed: 4.2, collisionRadius: 0.45,
    behavior: 'zigzag', eyeZ: 0.22, scale: 0.85, spawnWeight: 14,
    loot: [{ currency: 'credits', min: 2, max: 5 }],
  },
  anchor_mine: {
    type: 'anchor_mine',
    geometry: new THREE.OctahedronGeometry(0.5),
    color: 0x886644,
    baseHp: 38, baseDamage: 8, baseSpeed: 2.2, collisionRadius: 0.52,
    behavior: 'steady', eyeZ: 0.3, scale: 1, spawnWeight: 11,
    loot: [{ currency: 'scrapMetal', min: 3, max: 7 }],
  },
  repair_jammer: {
    type: 'repair_jammer',
    geometry: new THREE.ConeGeometry(0.4, 1.0, 6),
    color: 0x44ff66,
    baseHp: 26, baseDamage: 5, baseSpeed: 3.6, collisionRadius: 0.46,
    behavior: 'keepRange', keepRangeDist: 16, eyeZ: 0.3, scale: 0.88, spawnWeight: 13,
    loot: [{ currency: 'bioEssence', min: 1, max: 2 }],
  },
  gravity_anchor: {
    type: 'gravity_anchor',
    geometry: new THREE.SphereGeometry(0.55, 10, 10),
    color: 0x6633ff,
    baseHp: 45, baseDamage: 7, baseSpeed: 2.0, collisionRadius: 0.58,
    behavior: 'keepRange', keepRangeDist: 14, eyeZ: 0.3, scale: 1, spawnWeight: 12,
    loot: [{ currency: 'darkMatter', min: 0, max: 1 }],
  },
  ghost_ship: {
    type: 'ghost_ship',
    geometry: new THREE.ConeGeometry(0.42, 1.2, 5),
    color: 0xaaaaee,
    baseHp: 20, baseDamage: 6, baseSpeed: 4.8, collisionRadius: 0.48,
    behavior: 'charge', eyeZ: 0.3, scale: 0.82, spawnWeight: 15,
    loot: [{ currency: 'credits', min: 2, max: 4 }],
  },
  wreck_animator: {
    type: 'wreck_animator',
    geometry: new THREE.BoxGeometry(0.7, 0.5, 0.9),
    color: 0x88ff44,
    baseHp: 36, baseDamage: 6, baseSpeed: 2.5, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 18, eyeZ: 0.28, scale: 0.95, spawnWeight: 10,
    loot: [{ currency: 'scrapMetal', min: 2, max: 6 }],
  },
  rock_slinger: {
    type: 'rock_slinger',
    geometry: new THREE.DodecahedronGeometry(0.48),
    color: 0xccaa66,
    baseHp: 32, baseDamage: 9, baseSpeed: 2.4, collisionRadius: 0.5,
    behavior: 'keepRange', keepRangeDist: 14, attackSpeed: 0.4, eyeZ: 0.3, scale: 0.9, spawnWeight: 12,
    loot: [{ currency: 'credits', min: 1, max: 3 }],
  },
  power_siphon: {
    type: 'power_siphon',
    geometry: new THREE.TetrahedronGeometry(0.5),
    color: 0xffd700,
    baseHp: 24, baseDamage: 5, baseSpeed: 3.8, collisionRadius: 0.44,
    behavior: 'zigzag', eyeZ: 0.25, scale: 0.88, spawnWeight: 14,
    loot: [{ currency: 'stellarDust', min: 0, max: 1 }],
  },
  overloader: {
    type: 'overloader',
    geometry: new THREE.BoxGeometry(0.9, 0.6, 1.1),
    color: 0xff6600,
    baseHp: 42, baseDamage: 10, baseSpeed: 2.6, collisionRadius: 0.55,
    behavior: 'charge', eyeZ: 0.35, scale: 1, spawnWeight: 12,
    loot: [{ currency: 'scrapMetal', min: 3, max: 8 }],
  },
  eclipser: {
    type: 'eclipser',
    geometry: new THREE.RingGeometry(0.35, 0.65, 16),
    color: 0x333344,
    baseHp: 30, baseDamage: 5, baseSpeed: 2.8, collisionRadius: 0.55,
    behavior: 'keepRange', keepRangeDist: 17, eyeZ: 0.2, scale: 1, spawnWeight: 11,
    loot: [{ currency: 'credits', min: 2, max: 5 }],
  },
  viral_agent: {
    type: 'viral_agent',
    geometry: new THREE.IcosahedronGeometry(0.42, 1),
    color: 0x39ff14,
    baseHp: 28, baseDamage: 4, baseSpeed: 3.2, collisionRadius: 0.48,
    behavior: 'keepRange', keepRangeDist: 15, attackSpeed: 0.32, eyeZ: 0.26, scale: 0.9, spawnWeight: 12,
    loot: [{ currency: 'bioEssence', min: 2, max: 5 }],
  },
  crystal_leech: {
    type: 'crystal_leech',
    geometry: new THREE.OctahedronGeometry(0.52),
    color: 0x00f5ff,
    baseHp: 33, baseDamage: 7, baseSpeed: 3.0, collisionRadius: 0.5,
    behavior: 'charge', eyeZ: 0.3, scale: 0.92, spawnWeight: 13,
    loot: [{ currency: 'plasmaCrystals', min: 0, max: 2 }],
  },
  dampener: {
    type: 'dampener',
    geometry: new THREE.CylinderGeometry(0.4, 0.5, 0.75, 10),
    color: 0x9b30ff,
    baseHp: 38, baseDamage: 6, baseSpeed: 2.2, collisionRadius: 0.52,
    behavior: 'keepRange', keepRangeDist: 18, eyeZ: 0.3, scale: 1, spawnWeight: 11,
    loot: [{ currency: 'darkMatter', min: 0, max: 1 }],
  },
  emp_reflector: {
    type: 'emp_reflector',
    geometry: new THREE.BoxGeometry(0.75, 0.55, 0.75),
    color: 0xffff66,
    baseHp: 40, baseDamage: 8, baseSpeed: 2.5, collisionRadius: 0.52,
    behavior: 'steady', eyeZ: 0.32, scale: 0.95, spawnWeight: 11,
    loot: [{ currency: 'plasmaCrystals', min: 1, max: 3 }],
  },
  warp_disruptor: {
    type: 'warp_disruptor',
    geometry: new THREE.ConeGeometry(0.38, 1.05, 6),
    color: 0xaa44ff,
    baseHp: 26, baseDamage: 5, baseSpeed: 3.5, collisionRadius: 0.46,
    behavior: 'keepRange', keepRangeDist: 20, eyeZ: 0.3, scale: 0.88, spawnWeight: 13,
    loot: [{ currency: 'darkMatter', min: 0, max: 1 }],
  },
  dense_core: {
    type: 'dense_core',
    geometry: new THREE.DodecahedronGeometry(0.65),
    color: 0x440088,
    baseHp: 55, baseDamage: 12, baseSpeed: 1.5, collisionRadius: 0.62,
    behavior: 'steady', eyeZ: 0.35, scale: 1, spawnWeight: 10,
    loot: [{ currency: 'plasmaCrystals', min: 2, max: 5 }],
  },
  target_analyzer: {
    type: 'target_analyzer',
    geometry: new THREE.ConeGeometry(0.45, 1.15, 5),
    color: 0x00ccff,
    baseHp: 30, baseDamage: 8, baseSpeed: 4.2, collisionRadius: 0.5,
    behavior: 'charge', eyeZ: 0.32, scale: 0.9, spawnWeight: 14,
    loot: [{ currency: 'credits', min: 2, max: 5 }],
  },
  speed_matcher: {
    type: 'speed_matcher',
    geometry: new THREE.TetrahedronGeometry(0.48),
    color: 0xffffff,
    baseHp: 25, baseDamage: 7, baseSpeed: 3.5, collisionRadius: 0.45,
    behavior: 'speed_match', eyeZ: 0.28, scale: 0.85, spawnWeight: 15,
    loot: [{ currency: 'credits', min: 2, max: 4 }],
  },
  ship_clone: {
    type: 'ship_clone',
    geometry: new THREE.ConeGeometry(0.5, 1.4, 5),
    color: 0xffffff,
    baseHp: 80, baseDamage: 12, baseSpeed: 3.5, collisionRadius: 0.6,
    behavior: 'charge', eyeZ: 0.35, scale: 1, spawnWeight: 20,
    loot: [
      { currency: 'credits', min: 5, max: 10 },
      { currency: 'darkMatter', min: 1, max: 2 },
    ],
  },
};

function mothershipDef(counterType, color, geometry) {
  const b = ENEMY_DEFS.boss;
  return {
    type: `${counterType}_boss`,
    geometry: geometry ?? b.geometry.clone(),
    color,
    baseHp: b.baseHp,
    baseDamage: b.baseDamage,
    baseSpeed: b.baseSpeed,
    collisionRadius: b.collisionRadius,
    behavior: 'boss',
    scale: b.scale,
    loot: [...b.loot],
    spawnWeight: 0,
    mothershipFor: counterType,
  };
}

// behavior / attackPattern / attackSpeed legend:
//   boss_rusher   — hold range → dash → retreat (fast/agile)
//   boss_orbiter  — circles player at fixed radius (ring/disc/gravity)
//   boss_sniper   — keeps long range, strafes laterally (ranged specialists)
//   boss_aggressor— slow relentless advance (heavy armored)
//   boss          — original 3-phase behavior (generalists)
//
//   single  — one aimed shot      burst  — 3 rapid-fire shots
//   spread  — 3-shot 30° fan      spray  — 5-shot 50° fan

ENEMY_DEFS.zigzagger_boss     = Object.assign(mothershipDef('zigzagger',      0xff6600, new THREE.ConeGeometry(5, 12, 4)),            { buildGroup: buildZigzaggerBossGroup,    behavior: 'boss_rusher',   attackSpeed: 1.0,  attackPattern: 'single'  });
ENEMY_DEFS.mirror_drone_boss  = Object.assign(mothershipDef('mirror_drone',   0x88eeff, new THREE.OctahedronGeometry(7, 2)),         { buildGroup: buildMirrorDroneBossGroup,  behavior: 'boss_sniper',   attackSpeed: 0.5,  attackPattern: 'spread'  });
ENEMY_DEFS.flare_ship_boss    = Object.assign(mothershipDef('flare_ship',     0xffaa44, new THREE.ConeGeometry(4, 14, 6)),            { buildGroup: buildFlareShipBossGroup,    behavior: 'boss_sniper',   attackSpeed: 0.3,  attackPattern: 'spray'   });
ENEMY_DEFS.plasma_eater_boss  = Object.assign(mothershipDef('plasma_eater',   0xff00cc, new THREE.DodecahedronGeometry(7, 1)),        { buildGroup: buildPlasmaEaterBossGroup,  behavior: 'boss_orbiter',  attackSpeed: 0.4,  attackPattern: 'spread'  });
ENEMY_DEFS.prism_shard_boss   = Object.assign(mothershipDef('prism_shard',    0xff1133, new THREE.TetrahedronGeometry(8)),            { buildGroup: buildPrismShardBossGroup,   behavior: 'boss_rusher',   attackSpeed: 0.55, attackPattern: 'spread'  });
ENEMY_DEFS.fortress_boss      = Object.assign(mothershipDef('fortress',       0x556677, new THREE.BoxGeometry(12, 10, 14)),           { buildGroup: buildFortressBossGroup,     behavior: 'boss_aggressor',attackSpeed: 0.3,  attackPattern: 'spray'   });
ENEMY_DEFS.titan_boss         = Object.assign(mothershipDef('titan',          0x6688aa, new THREE.BoxGeometry(10, 14, 9)),            { buildGroup: buildTitanBossGroup,        behavior: 'boss_aggressor',attackSpeed: 0.4,  attackPattern: 'burst'   });
ENEMY_DEFS.corroder_boss      = Object.assign(mothershipDef('corroder',       0x88aa44, new THREE.IcosahedronGeometry(7, 2)),         { buildGroup: buildCorrorderBossGroup,    behavior: 'boss_orbiter',  attackSpeed: 0.4,  attackPattern: 'single'  });
ENEMY_DEFS.nullifier_boss     = Object.assign(mothershipDef('nullifier',      0x00ccff, new THREE.CylinderGeometry(3, 6, 14, 12)),    { buildGroup: buildNullifierBossGroup,    behavior: 'boss_sniper',   attackSpeed: 0.6,  attackPattern: 'single'  });
ENEMY_DEFS.scatter_drone_boss = Object.assign(mothershipDef('scatter_drone',  0xffcc00, new THREE.TorusGeometry(7, 3, 8, 24)),        { buildGroup: buildScatterDroneBossGroup, behavior: 'boss_orbiter',  attackSpeed: 0.4,  attackPattern: 'spray'   });
ENEMY_DEFS.anchor_mine_boss   = Object.assign(mothershipDef('anchor_mine',    0x886644, new THREE.OctahedronGeometry(8, 0)),          { buildGroup: buildAnchorMineBossGroup,   behavior: 'boss_orbiter',  attackSpeed: 0.35, attackPattern: 'single'  });
ENEMY_DEFS.repair_jammer_boss = Object.assign(mothershipDef('repair_jammer',  0x44ff66, new THREE.CylinderGeometry(2.5, 2.5, 14, 8)), { buildGroup: buildRepairJammerBossGroup, behavior: 'boss',          attackSpeed: 0.4,  attackPattern: 'spread'  });
ENEMY_DEFS.gravity_anchor_boss= Object.assign(mothershipDef('gravity_anchor', 0x6633ff, new THREE.SphereGeometry(7, 20, 20)),         { buildGroup: buildGravityAnchorBossGroup,behavior: 'boss_orbiter',  attackSpeed: 0.3,  attackPattern: 'single'  });
ENEMY_DEFS.ghost_ship_boss    = Object.assign(mothershipDef('ghost_ship',     0x888899, new THREE.ConeGeometry(5, 16, 6)),            { buildGroup: buildGhostShipBossGroup,    behavior: 'boss_rusher',   attackSpeed: 0.65, attackPattern: 'single'  });
ENEMY_DEFS.wreck_animator_boss= Object.assign(mothershipDef('wreck_animator', 0x88ff44, new THREE.BoxGeometry(14, 7, 10)),            { buildGroup: buildWreckAnimatorBossGroup,behavior: 'boss_aggressor',attackSpeed: 0.35, attackPattern: 'burst'   });
ENEMY_DEFS.rock_slinger_boss  = Object.assign(mothershipDef('rock_slinger',   0xccaa66, new THREE.DodecahedronGeometry(7)),           { buildGroup: buildRockSlingerBossGroup,  behavior: 'boss_aggressor',attackSpeed: 0.3,  attackPattern: 'spray'   });
ENEMY_DEFS.power_siphon_boss  = Object.assign(mothershipDef('power_siphon',   0xffd700, new THREE.TetrahedronGeometry(7)),            { buildGroup: buildPowerSiphonBossGroup,  behavior: 'boss_sniper',   attackSpeed: 0.35, attackPattern: 'burst'   });
ENEMY_DEFS.overloader_boss    = Object.assign(mothershipDef('overloader',     0xff6600, new THREE.BoxGeometry(10, 7, 12)),            { buildGroup: buildOverloaderBossGroup,   behavior: 'boss_aggressor',attackSpeed: 0.45, attackPattern: 'burst'   });
ENEMY_DEFS.eclipser_boss      = Object.assign(mothershipDef('eclipser',       0x222233, new THREE.TorusGeometry(8, 3.5, 12, 32)),     { buildGroup: buildEclipserBossGroup,     behavior: 'boss_orbiter',  attackSpeed: 0.35, attackPattern: 'spread'  });
ENEMY_DEFS.viral_agent_boss   = Object.assign(mothershipDef('viral_agent',    0x39ff14, new THREE.IcosahedronGeometry(6, 2)),         { buildGroup: buildViralAgentBossGroup,   behavior: 'boss_orbiter',  attackSpeed: 0.5,  attackPattern: 'single'  });
ENEMY_DEFS.crystal_leech_boss = Object.assign(mothershipDef('crystal_leech',  0x00f5ff, new THREE.OctahedronGeometry(7, 1)),          { buildGroup: buildCrystalLeechBossGroup, behavior: 'boss',          attackSpeed: 0.4,  attackPattern: 'spread'  });
ENEMY_DEFS.dampener_boss      = Object.assign(mothershipDef('dampener',       0x9b30ff, new THREE.CylinderGeometry(5, 6, 12, 16)),    { buildGroup: buildDampenerBossGroup,     behavior: 'boss_orbiter',  attackSpeed: 0.3,  attackPattern: 'single'  });
ENEMY_DEFS.emp_reflector_boss = Object.assign(mothershipDef('emp_reflector',  0xffff66, new THREE.BoxGeometry(12, 8, 12)),            { buildGroup: buildEmpReflectorBossGroup, behavior: 'boss_aggressor',attackSpeed: 0.45, attackPattern: 'burst'   });
ENEMY_DEFS.warp_disruptor_boss= Object.assign(mothershipDef('warp_disruptor', 0xaa44ff, new THREE.ConeGeometry(5, 16, 8)),            { buildGroup: buildWarpDisruptorBossGroup,behavior: 'boss_orbiter',  attackSpeed: 0.4,  attackPattern: 'spread'  });
ENEMY_DEFS.dense_core_boss    = Object.assign(mothershipDef('dense_core',     0x440088, new THREE.DodecahedronGeometry(8, 1)),         { buildGroup: buildDenseCoreBossGroup,    behavior: 'boss_aggressor',attackSpeed: 0.35, attackPattern: 'single'  });
ENEMY_DEFS.target_analyzer_boss=Object.assign(mothershipDef('target_analyzer',0x00ccff, new THREE.ConeGeometry(4, 14, 7)),            { buildGroup: buildTargetAnalyzerBossGroup,behavior:'boss_sniper',   attackSpeed: 0.65, attackPattern: 'single'  });
ENEMY_DEFS.speed_matcher_boss = Object.assign(mothershipDef('speed_matcher',  0xeeeeff, new THREE.TetrahedronGeometry(7, 1)),         { buildGroup: buildSpeedMatcherBossGroup, behavior: 'boss_rusher',   attackSpeed: 0.8,  attackPattern: 'single'  });
ENEMY_DEFS.ship_clone_boss    = Object.assign(mothershipDef('ship_clone',     0xffffff, new THREE.ConeGeometry(6, 18, 5)),            {                                         behavior: 'boss',          attackSpeed: 0.45, attackPattern: 'spread'  });

export const DEBUG_ENEMY_SPAWN_TYPES = [
  'scout', 'tank', 'swarm', 'sniper', 'boss',
  'zigzagger', 'mirror_drone', 'flare_ship', 'plasma_eater', 'prism_shard', 'fortress',
  'titan', 'corroder', 'nullifier', 'scatter_drone', 'anchor_mine', 'repair_jammer',
  'gravity_anchor', 'ghost_ship', 'wreck_animator', 'rock_slinger', 'power_siphon',
  'overloader', 'eclipser', 'viral_agent', 'crystal_leech', 'dampener', 'emp_reflector',
  'warp_disruptor', 'dense_core', 'target_analyzer', 'speed_matcher', 'ship_clone',
];

export function getAvailableTypes(tier) {
  const types = ['scout'];
  if (tier >= 4) types.push('tank');
  if (tier >= 7) types.push('swarm');
  if (tier >= 10) types.push('sniper');
  return types;
}

/** Corridor spawns: Milky Way (galaxy 0) stays scout-only; later galaxies use tier table. */
export function getCorridorBaseEnemyTypes(tier, galaxyIndex) {
  if (galaxyIndex === 0) return ['scout'];
  return getAvailableTypes(tier);
}

export function weightedPick(types, rng = Math.random) {
  const defs = types
    .map(t => ENEMY_DEFS[t])
    .filter(d => d && (d.spawnWeight ?? 0) > 0);
  if (!defs.length) return ENEMY_DEFS.scout;
  const total = defs.reduce((s, d) => s + d.spawnWeight, 0);
  let r = rng() * total;
  for (let i = 0; i < defs.length; i++) {
    r -= defs[i].spawnWeight;
    if (r <= 0) return defs[i];
  }
  return defs[0];
}
