import * as THREE from 'three';
import { Entity } from '../../ecs/Entity.js';
import { Component } from '../../ecs/Component.js';
import { TransformComponent } from '../core/TransformComponent.js';
import { ColliderComponent } from '../core/ColliderComponent.js';
import { eventBus, EVENTS } from '../../core/EventBus.js';
import { createProjectile } from '../../prefabs/createProjectile.js';

/** Pushes loot away within radius. */
export class ScatterAuraComponent extends Component {
  constructor({ radius = 12, push = 14 } = {}) {
    super();
    this.radius = radius;
    this.push = push;
  }

  update(dt, ctx) {
    const pt = ctx.playerEntity?.get('TransformComponent');
    if (!pt) return;
    const et = this.entity.get('TransformComponent');
    if (!et) return;
    const r2 = this.radius * this.radius;
    for (const loot of ctx.world.query('loot')) {
      const lt = loot.get('TransformComponent');
      if (!lt) continue;
      const dx = lt.position.x - pt.position.x;
      const dz = lt.position.z - pt.position.z;
      if (dx * dx + dz * dz > r2) continue;
      const ox = lt.position.x - et.position.x;
      const oz = lt.position.z - et.position.z;
      const d = Math.sqrt(ox * ox + oz * oz) || 0.001;
      lt.position.x += (ox / d) * this.push * dt;
      lt.position.z += (oz / d) * this.push * dt;
    }
  }
}

export class RegenJammerAuraComponent extends Component {
  constructor({ radius = 15, mult = 0.2 } = {}) {
    super();
    this.radius = radius;
    this.mult = mult;
  }

  update(dt, ctx) {
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    if (!ps || !pt || !et) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    if (dx * dx + dz * dz <= this.radius * this.radius) {
      ps.regenJammedMult = Math.min(ps.regenJammedMult, this.mult);
    }
  }
}

export class DampenAuraComponent extends Component {
  constructor({ radius = 20, mult = 0.75 } = {}) {
    super();
    this.radius = radius;
    this.mult = mult;
  }

  update(dt, ctx) {
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    if (!ps || !pt || !et) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    if (dx * dx + dz * dz <= this.radius * this.radius) {
      ps.projectileDampenMult = Math.min(ps.projectileDampenMult, this.mult);
    }
  }
}

export class WarpDisruptorAuraComponent extends Component {
  constructor({ radius = 25 } = {}) {
    super();
    this.radius = radius;
  }

  update(dt, ctx) {
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    if (!ps || !pt || !et) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    if (dx * dx + dz * dz <= this.radius * this.radius) {
      ps.warpDisruptorNearby = true;
    }
  }
}

export class EnemyGravityPullComponent extends Component {
  constructor({ radius = 18, strength = 6 } = {}) {
    super();
    this.radius = radius;
    this.strength = strength;
  }

  update(dt, ctx) {
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    if (!pt || !et) return;
    const dx = et.position.x - pt.position.x;
    const dz = et.position.z - pt.position.z;
    const d2 = dx * dx + dz * dz;
    if (d2 > this.radius * this.radius || d2 < 0.001) return;
    const d = Math.sqrt(d2);
    pt.position.x += (dx / d) * this.strength * dt;
    pt.position.z += (dz / d) * this.strength * dt;
  }
}

export class CorroderContactComponent extends Component {
  constructor({ stackDuration = 6, maxStacks = 10 } = {}) {
    super();
    this.stackDuration = stackDuration;
    this.maxStacks = maxStacks;
    this._cd = 0;
  }

  update(dt, ctx) {
    if (this._cd > 0) this._cd -= dt;
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    const col = this.entity.get('ColliderComponent');
    if (!ps || !pt || !et || !col) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    const r = (col.radius ?? 0.5) + 1.0;
    if (dx * dx + dz * dz > r * r) return;
    if (this._cd > 0) return;
    this._cd = 0.35;
    if (ps.corrosionStacks.length >= this.maxStacks) ps.corrosionStacks.shift();
    ps.corrosionStacks.push({ remain: this.stackDuration });
  }
}

export class CrystalLeechContactComponent extends Component {
  constructor() { super(); this._cd = 0; }
  update(dt, ctx) {
    if (this._cd > 0) this._cd -= dt;
    const st = ctx.state;
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    const col = this.entity.get('ColliderComponent');
    const h = this.entity.get('HealthComponent');
    if (!st?.currencies || !pt || !et || !col || !h) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    const r = (col.radius ?? 0.5) + 1.0;
    if (dx * dx + dz * dz > r * r) return;
    if (this._cd > 0) return;
    this._cd = 0.4;
    const steal = Math.min(3, Math.floor(st.currencies.plasmaCrystals || 0));
    if (steal > 0) {
      st.currencies.plasmaCrystals -= steal;
      h.heal(steal * 4);
    }
  }
}

export class OverloaderContactComponent extends Component {
  constructor({ duration = 3 } = {}) {
    super();
    this.duration = duration;
    this._cd = 0;
  }

  update(dt, ctx) {
    if (this._cd > 0) this._cd -= dt;
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    const col = this.entity.get('ColliderComponent');
    if (!pt || !et || !col) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    const r = (col.radius ?? 0.5) + 1.0;
    if (dx * dx + dz * dz > r * r) return;
    if (this._cd > 0) return;
    this._cd = 2;
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    if (ps) ps.weaponsDisabledTimer = Math.max(ps.weaponsDisabledTimer || 0, this.duration);
  }
}

export class EMPReflectorComponent extends Component {
  constructor({ disableSec = 2 } = {}) {
    super();
    this.disableSec = disableSec;
    this._unsub = null;
  }

  onAttach() {
    this._unsub = eventBus.on(EVENTS.EMP_FIRED, () => {
      if (!this.entity?.active) return;
      const ps = this.world?.ctx?.playerEntity?.get('PlayerStatsComponent');
      if (ps) ps.weaponsDisabledTimer = Math.max(ps.weaponsDisabledTimer || 0, this.disableSec);
      eventBus.emit(EVENTS.WEAPONS_FORCE_DISABLED, { seconds: this.disableSec });
    });
  }

  onDetach() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
  }
}

export class FlareLauncherComponent extends Component {
  constructor({ radius = 15 } = {}) {
    super();
    this.radius = radius;
  }

  update(dt, ctx) {
    const et = this.entity.get('TransformComponent');
    if (!et) return;
    const r2 = this.radius * this.radius;
    for (const pr of ctx.world.query('playerProjectile')) {
      if (pr.projectileKind !== 'missile' || !pr.active) continue;
      const t = pr.get('TransformComponent');
      if (!t) continue;
      const dx = t.position.x - et.position.x;
      const dz = t.position.z - et.position.z;
      if (dx * dx + dz * dz <= r2) pr.destroy();
    }
  }
}

export class ViralContactComponent extends Component {
  constructor() { super(); this._cd = 0; }
  update(dt, ctx) {
    if (this._cd > 0) this._cd -= dt;
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    const col = this.entity.get('ColliderComponent');
    if (!ps || !pt || !et || !col) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    const r = (col.radius ?? 0.5) + 1.0;
    if (dx * dx + dz * dz > r * r) return;
    if (this._cd > 0) return;
    this._cd = 0.6;
    ps.bioLabInvertTimer = Math.max(ps.bioLabInvertTimer || 0, 5);
  }
}

export class EclipserAuraComponent extends Component {
  constructor({ radius = 20 } = {}) {
    super();
    this.radius = radius;
  }

  update(dt, ctx) {
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    if (!ps || !pt || !et) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    if (dx * dx + dz * dz <= this.radius * this.radius) {
      ps.solarCellsSuppressed = true;
      ps.eclipseRegenMult = 0;
    }
  }
}

export class MineLifetimeComponent extends Component {
  constructor({ life = 8 } = {}) {
    super();
    this.life = life;
  }
  update(dt) {
    this.life -= dt;
    if (this.life <= 0) this.entity.destroy();
  }
}

export class SlowMineFieldComponent extends Component {
  constructor({ radius = 5, slowMult = 0.5 } = {}) {
    super();
    this.radius = radius;
    this.slowMult = slowMult;
  }
  update(dt, ctx) {
    const ps = ctx.playerEntity?.get('PlayerStatsComponent');
    const pt = ctx.playerEntity?.get('TransformComponent');
    const et = this.entity.get('TransformComponent');
    if (!ps || !pt || !et) return;
    const dx = pt.position.x - et.position.x;
    const dz = pt.position.z - et.position.z;
    if (dx * dx + dz * dz <= this.radius * this.radius) {
      ps.jammerSlowMult = Math.min(ps.jammerSlowMult, this.slowMult);
    }
  }
}

export class AnchorMineDropperComponent extends Component {
  constructor({ interval = 4 } = {}) {
    super();
    this.interval = interval;
    this._t = 0;
  }

  update(dt, ctx) {
    this._t += dt;
    if (this._t < this.interval) return;
    this._t = 0;
    const et = this.entity.get('TransformComponent');
    if (!et) return;
    const pos = et.position.clone();
    pos.x += (Math.random() - 0.5) * 4;
    pos.z += (Math.random() - 0.5) * 4;
    const mine = new Entity(['slow_mine']);
    mine.add(new TransformComponent({ position: pos }));
    mine.add(new ColliderComponent({ radius: 0.01, layer: 'effect', mask: [] }));
    mine.add(new SlowMineFieldComponent({ radius: 6, slowMult: 0.48 }));
    mine.add(new MineLifetimeComponent({ life: 8 }));
    ctx.world.spawn(mine);
  }
}

export class DenseCoreEnrageComponent extends Component {
  constructor() {
    super();
    this._enrageT = 0;
    this._unsub = null;
    this._beh = null;
    this._baseSpeed = null;
  }

  onAttach() {
    for (const c of this.entity.components.values()) {
      if (typeof c.speed === 'number' && typeof c.update === 'function') {
        this._beh = c;
        this._baseSpeed = c.speed;
        break;
      }
    }
    this._unsub = eventBus.on(EVENTS.GRAVITY_BOMB_EXPLODED, ({ origin, radius }) => {
      const t = this.entity.get('TransformComponent');
      if (!t || !origin) return;
      if (t.position.distanceTo(origin) <= (radius || 12) + 2) {
        this._enrageT = 2;
      }
    });
  }

  onDetach() {
    if (this._unsub) { this._unsub(); this._unsub = null; }
  }

  update(dt) {
    if (!this._beh) return;
    if (this._enrageT > 0) {
      this._enrageT -= dt;
      this._beh.speed = (this._baseSpeed ?? this._beh.speed) * 4;
    } else {
      this._beh.speed = this._baseSpeed ?? this._beh.speed;
    }
  }
}
