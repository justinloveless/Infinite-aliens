// Floating damage numbers rendered as DOM elements
export class DamageNumbers {
  constructor() {
    this._pool = [];
    this._active = [];
  }

  spawn(screenX, screenY, damage, isCrit, isPlayer = false) {
    let el = this._pool.pop();
    if (!el) {
      el = document.createElement('div');
      el.className = 'damage-number';
      document.body.appendChild(el);
    }

    el.textContent = isCrit ? `${damage}!` : damage;
    el.className = `damage-number ${isCrit ? 'crit' : 'normal'} ${isPlayer ? 'player' : ''}`;
    el.style.left = `${screenX - 20 + (Math.random() - 0.5) * 30}px`;
    el.style.top = `${screenY - 20}px`;
    el.style.display = 'block';
    el.style.animation = 'none';
    el.offsetHeight; // force reflow
    el.style.animation = '';

    const entry = { el, timer: 0.9 };
    this._active.push(entry);

    setTimeout(() => {
      el.style.display = 'none';
      this._active.splice(this._active.indexOf(entry), 1);
      this._pool.push(el);
    }, 900);
  }

  spawnAtWorld(worldPos, damage, isCrit, isPlayer, sceneManager) {
    const screen = sceneManager.worldToScreen(worldPos);
    this.spawn(screen.x, screen.y, damage, isCrit, isPlayer);
  }
}
