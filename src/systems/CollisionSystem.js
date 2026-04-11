import * as THREE from 'three';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

export class CollisionSystem {
  // Check projectile vs enemy collisions
  // Returns array of { projectile, enemy } hit pairs
  checkProjectilesVsEnemies(projectiles, enemies) {
    const hits = [];
    for (const proj of projectiles) {
      if (!proj.active || !proj.isPlayerProjectile) continue;
      proj.mesh.getWorldPosition(_a);

      for (const enemy of enemies) {
        if (!enemy.active) continue;
        enemy.group.getWorldPosition(_b);

        const dist = _a.distanceTo(_b);
        if (dist < proj.collisionRadius + enemy.collisionRadius) {
          hits.push({ projectile: proj, enemy });
          break; // one hit per projectile
        }
      }
    }
    return hits;
  }

  // Check enemy projectiles vs player
  checkEnemyProjectilesVsPlayer(projectiles, playerPos, playerRadius) {
    const hits = [];
    for (const proj of projectiles) {
      if (!proj.active || proj.isPlayerProjectile) continue;
      const dist = proj.mesh.position.distanceTo(playerPos);
      if (dist < proj.collisionRadius + playerRadius) {
        hits.push(proj);
      }
    }
    return hits;
  }

  // Check loot vs player (magnet range)
  checkLootVsPlayer(lootDrops, playerPos, magnetRange) {
    const collected = [];
    for (const loot of lootDrops) {
      if (!loot.active) continue;
      const dist = loot.position.distanceTo(playerPos);
      if (dist < magnetRange) {
        collected.push(loot);
      }
    }
    return collected;
  }

  // Check enemies that reached the player (contact damage)
  checkEnemyContact(enemies, playerPos, playerRadius) {
    const contacts = [];
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const dist = enemy.group.position.distanceTo(playerPos);
      if (dist < enemy.collisionRadius + playerRadius + 0.3) {
        contacts.push(enemy);
      }
    }
    return contacts;
  }
}
