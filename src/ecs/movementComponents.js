export function createChargeMovement() {
  return {
    update(enemy, delta, dx, dz, dist) {
      enemy.group.position.x += (dx / dist) * enemy.speed * delta;
      enemy.group.position.z += (dz / dist) * enemy.speed * delta;
    },
  };
}

export function createSteadyMovement() {
  return {
    update(enemy, delta, dx, dz, dist) {
      enemy.group.position.x += (dx / dist) * enemy.speed * delta;
      enemy.group.position.z += (dz / dist) * enemy.speed * delta;
    },
  };
}

export function createZigzagMovement() {
  let timer = 0;
  let dir = 1;
  return {
    update(enemy, delta, dx, dz, dist) {
      timer += delta;
      if (timer > 0.6) { timer = 0; dir *= -1; }
      enemy.group.position.x += ((dx / dist) * enemy.speed + dir * enemy.speed * 0.8) * delta;
      enemy.group.position.z += (dz / dist) * enemy.speed * delta;
    },
  };
}

export function createKeepRangeMovement(rangeDist = 12) {
  return {
    update(enemy, delta, dx, dz, dist) {
      if (dist < rangeDist) {
        enemy.group.position.x -= (dx / dist) * enemy.speed * delta * 0.5;
        enemy.group.position.z -= (dz / dist) * enemy.speed * delta * 0.5;
      } else if (dist > rangeDist + 4) {
        enemy.group.position.x += (dx / dist) * enemy.speed * delta;
        enemy.group.position.z += (dz / dist) * enemy.speed * delta;
      }
    },
  };
}

export function createBossMovement() {
  let timer = 0;
  return {
    update(enemy, delta, dx, dz, dist) {
      timer += delta;
      const phase = Math.floor(timer / 4) % 3;
      if (phase === 0) {
        enemy.group.position.x += (dx / dist) * enemy.speed * delta;
        enemy.group.position.z += (dz / dist) * enemy.speed * delta;
      } else if (phase === 1) {
        enemy.group.position.x += Math.sin(timer * 2) * enemy.speed * 1.5 * delta;
        enemy.group.position.z += (dz / dist) * enemy.speed * 0.3 * delta;
      } else if (dist < 8) {
        enemy.group.position.x -= (dx / dist) * enemy.speed * 0.5 * delta;
        enemy.group.position.z -= (dz / dist) * enemy.speed * 0.5 * delta;
      } else {
        enemy.group.position.x += (dx / dist) * enemy.speed * delta;
        enemy.group.position.z += (dz / dist) * enemy.speed * delta;
      }
      enemy.group.rotation.y += delta * 0.8;
    },
  };
}
