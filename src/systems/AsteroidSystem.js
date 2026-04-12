import { Asteroid } from '../entities/Asteroid.js';
import { ASTEROID } from '../constants.js';
import { eventBus, EVENTS } from '../core/EventBus.js';

export class AsteroidSystem {
  constructor(threeScene) {
    this._scene = threeScene;
    this._asteroids = [];
    this._spawnTimer = 0;
  }

  /**
   * @param {number} delta
   * @param {Projectile[]} activeProjectiles - from ProjectilePool.active
   * @param {Enemy[]} activeEnemies - from RoundSystem.enemies
   */
  update(delta, activeProjectiles, activeEnemies) {
    // Spawn timer
    this._spawnTimer += delta;
    if (this._spawnTimer >= ASTEROID.SPAWN_INTERVAL) {
      this._spawnTimer = 0;
      this._spawnLarge();
    }

    // Update existing asteroids; collect dead indices
    for (let i = this._asteroids.length - 1; i >= 0; i--) {
      const ast = this._asteroids[i];
      ast.update(delta);
      if (!ast.active) {
        this._scene.remove(ast.mesh);
        this._asteroids.splice(i, 1);
      }
    }

    // Collision: player projectiles vs asteroids
    this._checkProjectileCollisions(activeProjectiles);

    // Collision: asteroids vs enemies
    this._checkEnemyCollisions(activeEnemies);
  }

  _spawnLarge() {
    const ast = new Asteroid('large');
    this._scene.add(ast.mesh);
    this._asteroids.push(ast);
  }

  _checkProjectileCollisions(projectiles) {
    if (!projectiles?.length) return;

    for (const proj of projectiles) {
      if (!proj.active || !proj.isPlayerProjectile) continue;

      for (let i = this._asteroids.length - 1; i >= 0; i--) {
        const ast = this._asteroids[i];
        if (!ast.active) continue;

        const dist = proj.mesh.position.distanceTo(ast.mesh.position);
        if (dist < proj.collisionRadius + ast.collisionRadius) {
          // Break the asteroid
          const frags = ast.break();
          for (const frag of frags) {
            this._scene.add(frag.mesh);
            this._asteroids.push(frag);
          }
          // Remove broken asteroid
          this._scene.remove(ast.mesh);
          this._asteroids.splice(i, 1);

          // Deactivate the projectile
          proj.deactivate();

          eventBus.emit(EVENTS.ASTEROID_BROKEN, { position: ast.mesh.position.clone() });
          break; // one asteroid per projectile
        }
      }
    }
  }

  _checkEnemyCollisions(enemies) {
    if (!enemies?.length) return;

    for (let i = this._asteroids.length - 1; i >= 0; i--) {
      const ast = this._asteroids[i];
      if (!ast.active) continue;

      for (const enemy of enemies) {
        if (!enemy.active) continue;

        const dist = ast.mesh.position.distanceTo(enemy.group.position);
        if (dist < ast.collisionRadius + enemy.collisionRadius) {
          const dmg = ast.damage;
          const died = enemy.takeDamage(dmg);

          eventBus.emit(EVENTS.ENEMY_DAMAGED, { enemy, damage: dmg, isCrit: false });
          if (died) {
            eventBus.emit(EVENTS.ENEMY_KILLED, { enemy });
          }

          eventBus.emit(EVENTS.ASTEROID_HIT_ENEMY, {
            position: ast.mesh.position.clone(),
            damage: dmg,
          });

          // Asteroid piece is consumed on enemy hit
          ast.active = false;
          this._scene.remove(ast.mesh);
          this._asteroids.splice(i, 1);
          break;
        }
      }
    }
  }

  /** Remove all active asteroids from the scene (call on round reset / game reset). */
  clear() {
    for (const ast of this._asteroids) {
      this._scene.remove(ast.mesh);
    }
    this._asteroids.length = 0;
    this._spawnTimer = 0;
  }
}
