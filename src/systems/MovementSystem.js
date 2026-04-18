export class MovementSystem {
  update(delta, enemies, playerPos, world) {
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const movement = world.getComponent(enemy.entityId, 'Movement');
      if (!movement) continue;
      const dx = playerPos.x - enemy.group.position.x;
      const dz = playerPos.z - enemy.group.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz) || 0.001;
      movement.update(enemy, delta, dx, dz, dist);
    }
  }
}
