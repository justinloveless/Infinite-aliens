const GALAXY_MAP_POSITIONS = [
  { galaxyIndex: 0, name: 'Milky Way',              x: '10%', y: '50%', file: 'milky-way.jpg',              fallback: 'radial-gradient(circle, #ffe0a0 0%, #c8a040 40%, #604020 100%)',  description: 'Our home galaxy. A barred spiral 100,000 ly across.' },
  { galaxyIndex: 3, name: 'Large Magellanic Cloud', x: '20%', y: '70%', file: 'large-magellanic-cloud.jpg', fallback: 'radial-gradient(circle, #aaddff 0%, #6699cc 50%, #223355 100%)',  description: 'Irregular dwarf galaxy, ~160,000 ly away.' },
  { galaxyIndex: 4, name: 'Small Magellanic Cloud', x: '18%', y: '30%', file: 'small-magellanic-cloud.jpg', fallback: 'radial-gradient(circle, #bbddff 0%, #7799bb 50%, #223355 100%)',  description: 'Irregular dwarf galaxy, ~200,000 ly away.' },
  { galaxyIndex: 1, name: 'Andromeda',              x: '36%', y: '44%', file: 'andromeda.jpg',              fallback: 'radial-gradient(circle, #ffffff 0%, #9999cc 40%, #222244 100%)',  description: 'Nearest large spiral galaxy. ~2.5 million ly away.' },
  { galaxyIndex: 2, name: 'Triangulum',             x: '42%', y: '60%', file: 'triangulum.jpg',             fallback: 'radial-gradient(circle, #aaffcc 0%, #55aa77 40%, #113322 100%)',  description: 'Small spiral galaxy, ~2.7 million ly away.' },
  { galaxyIndex: 8, name: 'Centaurus A',            x: '54%', y: '26%', file: 'centaurus-a.jpg',            fallback: 'radial-gradient(circle, #ffddaa 0%, #aa7733 40%, #331100 100%)',  description: 'Giant elliptical with active nucleus. ~13 million ly.' },
  { galaxyIndex: 7, name: 'Pinwheel',               x: '63%', y: '40%', file: 'pinwheel.jpg',               fallback: 'radial-gradient(circle, #88ccff 0%, #4488bb 40%, #112244 100%)',  description: 'Face-on grand design spiral. ~21 million ly away.' },
  { galaxyIndex: 5, name: 'Whirlpool',              x: '67%', y: '65%', file: 'whirlpool.jpg',              fallback: 'radial-gradient(circle, #cc99ff 0%, #7744aa 40%, #220033 100%)',  description: 'Interacting spiral pair. ~23 million ly away.' },
  { galaxyIndex: 6, name: 'Sombrero',               x: '77%', y: '54%', file: 'sombrero.jpg',               fallback: 'radial-gradient(circle, #ffeecc 0%, #998855 40%, #332211 100%)',  description: 'Striking edge-on spiral with dust lane. ~29 million ly.' },
  { galaxyIndex: 9, name: 'Cartwheel',              x: '90%', y: '42%', file: 'cartwheel.jpg',              fallback: 'radial-gradient(circle, #ff9944 0%, #cc5500 40%, #441100 100%)',  description: 'Rare ring galaxy from ancient collision. ~500 million ly.' },
];

export class UIManager {
  constructor() {
    this._screens = {
      start: document.getElementById('start-screen'),
      hud: document.getElementById('hud'),
      transition: document.getElementById('round-transition'),
      death: document.getElementById('death-screen'),
      warpGate: document.getElementById('warp-gate-screen'),
      hangar: document.getElementById('hangar-screen'),
      store: document.getElementById('store-screen'),
      arenaHud: document.getElementById('arena-hud'),
    };
  }

  show(id) {
    const el = this._screens[id];
    if (el) el.classList.remove('hidden');
  }

  hide(id) {
    const el = this._screens[id];
    if (el) el.classList.add('hidden');
  }

  hideAll() {
    Object.values(this._screens).forEach(el => el?.classList.add('hidden'));
  }

  /**
   * @param {object|null} stats  - lastRun stats, or null for first-run "ready" state
   * @param {function} onLaunch   - start a new run
   * @param {function} [onViewHangar] - open hangar overlay
   */
  showDeath(stats, onLaunch, onViewHangar) {
    const title = document.getElementById('death-title');
    const statsEl = document.getElementById('death-stats');

    if (stats) {
      title.textContent = 'SHIP DESTROYED';
      const lootLines = Object.entries(stats.loot || {})
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `<span>${v} ${k}</span>`)
        .join('  ');
      statsEl.innerHTML = `
        <div class="death-stat">Distance: ${Math.floor(stats.distance)} ly  |  Tier ${stats.tier}</div>
        <div class="death-stat">Enemies: ${stats.enemiesDefeated}  |  Bosses: ${stats.bossesDefeated}</div>
        ${lootLines ? `<div class="death-stat">${lootLines}</div>` : ''}
      `;
    } else {
      title.textContent = 'READY FOR LAUNCH';
      statsEl.innerHTML = '<div class="death-stat">Your upgrades persist between runs. Good luck, Commander.</div>';
    }

    this.show('death');
    const hangarBtn = document.getElementById('view-hangar-btn');
    if (hangarBtn) hangarBtn.onclick = onViewHangar || null;
    document.getElementById('death-launch-btn').onclick = () => {
      this.hide('death');
      onLaunch();
    };
  }

  showStart(onStart) {
    this.show('start');
    document.getElementById('start-btn').onclick = () => {
      this.hide('start');
      if (onStart) onStart();
    };
  }

  /**
   * Show galaxy selection screen as an interactive map.
   * @param {{ outbound: Array, returnJourneys: Array, infiniteAvailable: boolean }} galaxyOptions
   * @param {function({ galaxyIndex: number, mode: string }): void} onSelect
   * @param {{ onBack?: function(): void }} [opts]
   */
  showGalaxySelect(galaxyOptions, onSelect, { onBack } = {}) {
    const options = Array.isArray(galaxyOptions)
      ? { outbound: galaxyOptions, returnJourneys: [], infiniteAvailable: false }
      : galaxyOptions;
    const { outbound = [], returnJourneys = [], infiniteAvailable = false } = options;

    const container = document.getElementById('galaxy-map-container');
    const launchBtn = document.getElementById('galaxy-launch-btn');
    const infoName = document.getElementById('galaxy-info-name');
    const infoTier = document.getElementById('galaxy-info-tier');
    const infoStatus = document.getElementById('galaxy-info-status');
    const infoImg = document.getElementById('galaxy-info-img');
    const closeBtn = document.getElementById('galaxy-map-close-btn');
    const subtitle = document.getElementById('galaxy-map-subtitle');

    closeBtn.classList.remove('hidden');
    closeBtn.onclick = () => { this.hide('warpGate'); onBack?.(); };

    const resetInfoPanel = () => {
      infoName.textContent = '—';
      infoTier.textContent = '';
      infoStatus.textContent = '';
      infoImg.style.backgroundImage = '';
      infoImg.style.filter = '';
      launchBtn.disabled = true;
      launchBtn.textContent = 'SELECT A GALAXY';
      launchBtn.className = 'neon-btn launch';
      launchBtn.onclick = null;
    };

    // --- Tab bar ---
    const mapUi = document.getElementById('galaxy-map-ui');
    const mapBody = document.getElementById('galaxy-map-body');
    document.getElementById('galaxy-map-tab-bar')?.remove();

    const hasReturn = returnJourneys.length > 0;
    const hasTabs = hasReturn || infiniteAvailable;

    const tabBar = document.createElement('div');
    tabBar.id = 'galaxy-map-tab-bar';

    const tabDefs = [{ id: 'outbound', label: 'OUTBOUND' }];
    if (hasReturn) tabDefs.push({ id: 'return', label: 'RETURN JOURNEY' });
    if (infiniteAvailable) tabDefs.push({ id: 'infinite', label: '∞ INFINITE' });

    const tabBtns = {};
    for (const { id, label } of tabDefs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'galaxy-tab-btn';
      btn.dataset.tab = id;
      btn.textContent = label;
      tabBar.appendChild(btn);
      tabBtns[id] = btn;
    }
    if (hasTabs) mapUi.insertBefore(tabBar, mapBody);

    // --- Galaxy map renderer ---
    const renderGalaxyMap = (galaxies, isReturn) => {
      container.innerHTML = '';
      resetInfoPanel();

      const unlockedSet = new Set(galaxies.map(g => g.galaxyIndex));
      const byIndex = [...GALAXY_MAP_POSITIONS].sort((a, b) => a.galaxyIndex - b.galaxyIndex);

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.cssText = 'position:absolute;width:100%;height:100%;left:0;top:0;pointer-events:none;overflow:visible';

      // Return journey lines flow right-to-left (galaxy 8 → 0)
      const lineSeq = isReturn
        ? byIndex.filter(p => p.galaxyIndex <= 8).reverse()
        : byIndex;
      const pfx = isReturn ? 'warp-line warp-line-return-' : 'warp-line warp-line-';

      for (let i = 0; i < lineSeq.length - 1; i++) {
        const from = lineSeq[i];
        const to   = lineSeq[i + 1];
        const fu = unlockedSet.has(from.galaxyIndex);
        const tu = unlockedSet.has(to.galaxyIndex);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', parseFloat(from.x));
        line.setAttribute('y1', parseFloat(from.y));
        line.setAttribute('x2', parseFloat(to.x));
        line.setAttribute('y2', parseFloat(to.y));
        line.setAttribute('class', fu && tu ? `${pfx}active` : fu ? `${pfx}frontier` : `${pfx}locked`);
        svg.appendChild(line);
      }
      container.appendChild(svg);

      for (const pos of GALAXY_MAP_POSITIONS) {
        if (isReturn && pos.galaxyIndex === 9) continue;

        const unlocked = unlockedSet.has(pos.galaxyIndex);
        const displayName = isReturn ? `Corrupted ${pos.name}` : pos.name;
        const node = document.createElement('div');
        node.className = 'galaxy-node'
          + (unlocked ? '' : ' galaxy-locked')
          + (isReturn ? ' galaxy-return' : '');
        node.style.left = pos.x;
        node.style.top  = pos.y;
        node.title = displayName;

        const imgWrap = document.createElement('div');
        imgWrap.className = 'galaxy-node-img';
        const img = document.createElement('img');
        img.src = `/images/galaxies/${pos.file}`;
        img.alt = pos.name;
        img.onerror = () => { img.style.display = 'none'; imgWrap.style.backgroundImage = pos.fallback; };
        imgWrap.appendChild(img);

        const label = document.createElement('div');
        label.className = 'galaxy-node-label';
        label.textContent = pos.name;
        node.appendChild(imgWrap);
        node.appendChild(label);

        if (unlocked) {
          node.onclick = () => {
            document.querySelectorAll('.galaxy-node.selected').forEach(n => n.classList.remove('selected'));
            node.classList.add('selected');
            infoImg.style.backgroundImage = `url('/images/galaxies/${pos.file}')`;
            infoImg.style.filter = isReturn ? 'hue-rotate(310deg) saturate(1.5) brightness(0.8)' : '';
            infoName.textContent = displayName;
            infoTier.textContent = pos.galaxyIndex === 0 && !isReturn
              ? 'Home Galaxy — Standard Launch'
              : `Starting Tier: ${pos.galaxyIndex * 10 + 1}`;
            infoStatus.textContent = isReturn
              ? 'Enemy forces have replicated your technology. Ship clones patrol this system.'
              : pos.description;
            launchBtn.disabled = false;
            launchBtn.textContent = isReturn ? '▶ RETURN LAUNCH' : '▶ LAUNCH';
            launchBtn.className = `neon-btn launch${isReturn ? ' return-launch' : ''}`;
            launchBtn.onclick = () => {
              this.hide('warpGate');
              onSelect({ galaxyIndex: pos.galaxyIndex, mode: isReturn ? 'return' : 'outbound' });
            };
          };
        }
        container.appendChild(node);
      }
    };

    const renderInfiniteTab = () => {
      container.innerHTML = '';
      resetInfoPanel();
      const panel = document.createElement('div');
      panel.className = 'galaxy-infinite-panel';
      panel.innerHTML = `
        <div class="galaxy-infinite-title">∞ INFINITE MODE</div>
        <div class="galaxy-infinite-desc">
          All galaxies have been conquered.<br>
          The replicated fleet grows without limit.<br>
          Enemies scale beyond the known universe.
        </div>
      `;
      container.appendChild(panel);
      infoImg.style.backgroundImage = `url('/images/galaxies/cartwheel.jpg')`;
      infoImg.style.filter = 'hue-rotate(260deg) saturate(1.5) brightness(0.9)';
      infoName.textContent = 'Infinite Sector';
      infoTier.textContent = 'Starting Tier: 91+';
      infoStatus.textContent = 'No end. No mercy. Ship clones grow stronger with every run.';
      launchBtn.disabled = false;
      launchBtn.textContent = '▶ LAUNCH INFINITE';
      launchBtn.className = 'neon-btn launch infinite-launch';
      launchBtn.onclick = () => {
        this.hide('warpGate');
        onSelect({ galaxyIndex: 9, mode: 'infinite' });
      };
    };

    const SUBTITLES = {
      outbound: 'Select your destination. Higher galaxies — stronger enemies, better rewards.',
      return:   'The enemy has replicated your ship. Fight through corrupted versions of explored systems.',
      infinite: 'The final frontier. Endless waves of ship clones. No ceiling.',
    };

    const switchTab = (tabId) => {
      for (const [id, btn] of Object.entries(tabBtns)) btn.classList.toggle('active', id === tabId);
      if (subtitle) subtitle.textContent = SUBTITLES[tabId] ?? SUBTITLES.outbound;
      if (tabId === 'outbound') renderGalaxyMap(outbound, false);
      else if (tabId === 'return') renderGalaxyMap(returnJourneys, true);
      else if (tabId === 'infinite') renderInfiniteTab();
    };

    tabBar.querySelectorAll('.galaxy-tab-btn').forEach(btn => {
      btn.onclick = () => switchTab(btn.dataset.tab);
    });

    switchTab('outbound');
    this.show('warpGate');
  }

  /** @deprecated Use showGalaxySelect instead */
  showWarpGateSelect(gates, onSelect) {
    this.showGalaxySelect(
      {
        outbound: [
          { galaxyIndex: 0, name: 'Milky Way', startTier: 1 },
          ...gates.map(g => ({ galaxyIndex: Math.floor(g.tier / 10), name: `Sector ${g.tier}`, startTier: g.tier })),
        ],
        returnJourneys: [],
        infiniteAvailable: false,
      },
      ({ galaxyIndex }) => onSelect(galaxyIndex * 10 + 1),
    );
  }

  bindMuteButton(audioManager, settingsManager) {
    const btn = document.getElementById('mute-btn');
    // Sync initial label
    btn.textContent = audioManager.muted ? '🔇' : '♪';
    btn.onclick = () => {
      const muted = audioManager.toggleMute();
      if (settingsManager) settingsManager.setMuted(muted);
      btn.textContent = muted ? '🔇' : '♪';
    };
    // Keep label in sync when settings panel changes the mute state
    if (settingsManager) {
      settingsManager.onChange((key) => {
        if (key === 'muted' || key === 'reset') {
          btn.textContent = audioManager.muted ? '🔇' : '♪';
        }
      });
    }
  }
}
