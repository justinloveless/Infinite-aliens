import { Component } from '../../ecs/Component.js';

// Spring constant: fraction of overlap resolved per second (capped at 1 to avoid overshoot).
const SPRING = 12.0;
// Extra gap beyond the sum of radii before separation stops.
const PADDING = 0.3;

export class EnemySeparationComponent extends Component {
    onAttach() {
        this._radius = this.entity.collisionRadius ?? 0.6;
    }

    update(dt, ctx) {
        const myT = this.entity.get('TransformComponent');
        if (!myT) return;

        const enemies = this.world.getFrameEnemies();
        const px = myT.position.x;
        const pz = myT.position.z;
        const factor = Math.min(SPRING * dt, 1.0) * 0.5;

        for (const other of enemies) {
            if (other === this.entity) continue;
            const otherT = other.get('TransformComponent');
            if (!otherT) continue;

            const dx = px - otherT.position.x;
            const dz = pz - otherT.position.z;
            const distSq = dx * dx + dz * dz;
            const minDist = this._radius + (other.collisionRadius ?? 0.6) + PADDING;

            if (distSq >= minDist * minDist) continue;

            if (distSq < 0.0001) {
                // Exactly coincident — spread by entity id for deterministic direction
                const angle = (parseInt(this.entity.id.slice(2), 10) ?? 0) * 2.39996;
                myT.position.x += Math.cos(angle) * SPRING * dt * 0.5;
                myT.position.z += Math.sin(angle) * SPRING * dt * 0.5;
                continue;
            }

            const dist = Math.sqrt(distSq);
            const pushDist = factor * (minDist - dist);
            myT.position.x += (dx / dist) * pushDist;
            myT.position.z += (dz / dist) * pushDist;
        }
    }
}
