import { eventBus, EVENTS } from '../core/EventBus.js';

/**
 * Manages active abilities (keys 1–4). Each ability is built from computed flags
 * set by upgrade nodes and ordered by when they were unlocked.
 *
 * Abilities:
 *   speed_booster — temporary speed burst
 *   emp           — stun + damage all enemies
 *   warp_drive    — teleport ship forward
 *   gravity_bomb  — pull enemies inward for N seconds
 *   decoy         — spawn a hologram that draws fire
 */
export class AbilitySystem {
  constructor() {
    /** @type {Array<{id:string, icon:string, remaining:number, cooldown:number, energyCost:number}>} */
    this._slots = [];
  }

  /**
   * Rebuild the ability slot list from computed. Called whenever upgrades change.
   * @param {object} computed
   */
  syncAbilities(computed) {
    const defs = this._buildDefs(computed);
    // Preserve cooldown state for abilities that persist across recomputes
    const prevRemaining = {};
    for (const s of this._slots) prevRemaining[s.id] = s.remaining;

    this._slots = defs.slice(0, 4).map(d => ({
      ...d,
      remaining: prevRemaining[d.id] ?? 0,
    }));
    this._updateHudSlots(computed);
  }

  _buildDefs(computed) {
    const defs = [];
    if (computed.speedBoosterUnlocked) {
      defs.push({
        id: 'speed_booster',
        icon: '⚡',
        cooldown: computed.speedBoostCooldown,
        energyCost: 15,
      });
    }
    if (computed.empUnlocked) {
      defs.push({
        id: 'emp',
        icon: '☇',
        cooldown: computed.empCooldown,
        energyCost: 30,
      });
    }
    if (computed.warpDriveUnlocked) {
      defs.push({
        id: 'warp_drive',
        icon: '⌖',
        cooldown: computed.warpDriveCooldown,
        energyCost: 20,
      });
    }
    if (computed.gravityBombUnlocked) {
      defs.push({
        id: 'gravity_bomb',
        icon: '◉',
        cooldown: computed.gravityBombCooldown,
        energyCost: 25,
      });
    }
    if (computed.decoyUnlocked) {
      defs.push({
        id: 'decoy',
        icon: '◈',
        cooldown: 40,
        energyCost: computed.decoyEnergyCost,
      });
    }
    return defs;
  }

  /**
   * Tick cooldowns down each frame.
   * @param {number} dt
   */
  update(dt) {
    for (const slot of this._slots) {
      if (slot.remaining > 0) {
        slot.remaining = Math.max(0, slot.remaining - dt);
      }
    }
  }

  /**
   * Attempt to activate the ability in slot index (0-based).
   * @param {number} slotIdx
   * @param {object} state
   * @param {object} computed
   * @param {object} combat - CombatSystem reference for effects
   * @param {object} ship   - Ship entity reference
   */
  activate(slotIdx, state, computed, combat, ship) {
    const slot = this._slots[slotIdx];
    if (!slot) return;
    if (slot.remaining > 0) return;
    if ((state.player.energy ?? 0) < slot.energyCost) return;

    state.player.energy -= slot.energyCost;
    slot.remaining = slot.cooldown;

    this._execute(slot.id, state, computed, combat, ship);
    this._updateHudSlots(computed);
  }

  _execute(id, state, computed, combat, ship) {
    switch (id) {
      case 'speed_booster': {
        state.player._speedBoostTimer = computed.speedBoostDuration;
        state.player._speedBoostMult = computed.speedBoostMult;
        break;
      }
      case 'emp': {
        if (combat) {
          combat.triggerEmp(computed.empDuration, computed.empDamage);
        }
        eventBus.emit(EVENTS.EMP_FIRED, {
          duration: computed.empDuration,
          damage: computed.empDamage,
        });
        break;
      }
      case 'warp_drive': {
        if (ship) {
          const pos = ship.group.position;
          // Warp forward (toward lower Z)
          pos.z -= computed.warpDistance;
        }
        break;
      }
      case 'gravity_bomb': {
        // Emit event; CombatSystem or a future GravityBombEntity handles the pull
        eventBus.emit('ability:gravity_bomb', {
          position: ship?.group?.position?.clone?.() ?? null,
          radius: computed.gravityBombRadius,
          damage: computed.gravityBombDamage,
          duration: computed.gravityBombDuration,
        });
        break;
      }
      case 'decoy': {
        eventBus.emit('ability:decoy', {
          position: ship?.group?.position?.clone?.() ?? null,
          duration: computed.decoyDuration,
          count: computed.decoyCount,
        });
        break;
      }
    }
  }

  // Update ability slot HUD elements
  _updateHudSlots(_computed) {
    const container = document.getElementById('ability-slots');
    if (!container) return;
    if (this._slots.length === 0) {
      container.style.display = 'none';
      return;
    }
    container.style.display = 'flex';

    for (let i = 0; i < 4; i++) {
      const el = document.getElementById(`ability-slot-${i}`);
      if (!el) continue;
      const slot = this._slots[i];
      const iconEl = el.querySelector('.ability-icon');
      const overlayEl = el.querySelector('.ability-cooldown-overlay');

      if (!slot) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      if (iconEl) iconEl.textContent = slot.icon;

      const frac = slot.cooldown > 0 ? slot.remaining / slot.cooldown : 0;
      if (overlayEl) overlayEl.style.transform = `scaleY(${frac})`;
      el.classList.toggle('ready', slot.remaining <= 0);
    }
  }

  /** Called every frame to keep the cooldown overlays in sync. */
  tickHud() {
    for (let i = 0; i < 4; i++) {
      const slot = this._slots[i];
      const el = document.getElementById(`ability-slot-${i}`);
      if (!el || !slot) continue;
      const overlayEl = el.querySelector('.ability-cooldown-overlay');
      const frac = slot.cooldown > 0 ? slot.remaining / slot.cooldown : 0;
      if (overlayEl) overlayEl.style.transform = `scaleY(${frac})`;
      el.classList.toggle('ready', slot.remaining <= 0);
    }
  }
}
