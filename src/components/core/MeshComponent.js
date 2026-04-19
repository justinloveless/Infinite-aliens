import * as THREE from 'three';
import { Component } from '../../ecs/Component.js';

/**
 * Owns a THREE.js Object3D that mirrors the TransformComponent each frame.
 * Auto-adds to the configured scene group on attach, removes on detach, and
 * disposes geometry/material on detach.
 */
export class MeshComponent extends Component {
  /**
   * @param {{ object3d: THREE.Object3D, group?: string, dispose?: boolean }} opts
   *   - object3d: THREE.Group/Mesh/etc. to attach
   *   - group: scene.groups[group] to parent under (default: 'effects')
   *   - dispose: whether to dispose geometry/material on detach (default: true)
   */
  constructor({ object3d, group = 'effects', dispose = true } = {}) {
    super();
    this.object3d = object3d || new THREE.Group();
    this.groupName = group;
    this._dispose = dispose;
    this._parent = null;
    this.visible = true;
  }

  setGroup(name) { this.groupName = name; }

  onAttach(ctx) {
    const scene = ctx?.scene;
    if (!scene) return;
    this._parent = scene.groups[this.groupName] || scene.groups.effects;
    this._parent.add(this.object3d);
    this._syncFromTransform();
  }

  onDetach() {
    if (this._parent) this._parent.remove(this.object3d);
    this._parent = null;
    if (this._dispose) {
      this.object3d.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose?.();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose?.());
          else obj.material.dispose?.();
        }
      });
    }
  }

  update() {
    this._syncFromTransform();
  }

  _syncFromTransform() {
    const t = this.entity?.get('TransformComponent');
    if (!t) return;
    this.object3d.position.copy(t.position);
    this.object3d.rotation.copy(t.rotation);
    this.object3d.scale.copy(t.scale);
    this.object3d.visible = this.visible;
  }
}
