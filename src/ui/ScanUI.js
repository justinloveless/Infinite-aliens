import { SCAN } from '../constants.js';

/**
 * Fullscreen alien scan sequence after galaxy boss defeat.
 */
export class ScanUI {
  /** @param {import('../core/AudioManager.js').AudioManager} [audio] */
  constructor(audio) {
    this._audio = audio ?? null;
    this._root = document.createElement('div');
    this._root.id = 'scan-ui-overlay';
    this._root.className = 'scan-ui-overlay hidden';
    this._root.innerHTML = `
      <div class="scan-ui-inner">
        <div class="scan-ui-title">ALIEN SCAN DETECTED</div>
        <div class="scan-ui-beam"></div>
        <div class="scan-ui-section scan-ui-item-block hidden">
          <div class="scan-ui-label">ITEM COMPROMISED</div>
          <div class="scan-ui-item-row"><span class="scan-ui-icon"></span><span class="scan-ui-item-name"></span></div>
        </div>
        <div class="scan-ui-section scan-ui-threat-block hidden">
          <div class="scan-ui-label">NEW THREAT IDENTIFIED</div>
          <div class="scan-ui-threat-row"><span class="scan-ui-chip"></span><span class="scan-ui-threat-name"></span></div>
          <div class="scan-ui-threat-desc"></div>
        </div>
        <button type="button" class="scan-ui-continue hidden">CONTINUE</button>
      </div>
    `;
    document.body.appendChild(this._root);
    this._continueBtn = this._root.querySelector('.scan-ui-continue');
    this._continueBtn.addEventListener('click', () => this._finish());
  }

  show({ item, counterType, counterLabel, threatDescription, galaxyIndex }, onContinue) {
    this._onContinue = onContinue;
    this._root.classList.remove('hidden');
    this._root.querySelector('.scan-ui-title').textContent = 'ALIEN SCAN DETECTED';
    const itemBlock = this._root.querySelector('.scan-ui-item-block');
    const threatBlock = this._root.querySelector('.scan-ui-threat-block');
    const iconEl = this._root.querySelector('.scan-ui-icon');
    const nameEl = this._root.querySelector('.scan-ui-item-name');
    const chip = this._root.querySelector('.scan-ui-chip');
    const tname = this._root.querySelector('.scan-ui-threat-name');
    const tdesc = this._root.querySelector('.scan-ui-threat-desc');
    itemBlock.classList.add('hidden');
    threatBlock.classList.add('hidden');
    this._continueBtn.classList.add('hidden');
    iconEl.textContent = item?.icon ?? '◆';
    nameEl.textContent = item?.name ?? counterType;
    chip.textContent = ' ';
    chip.style.background = item?.color ? `linear-gradient(90deg, ${item.color}, #fff)` : '#ff6600';
    tname.textContent = counterLabel || counterType;
    tdesc.textContent = threatDescription || '';

    this._audio?.play('scanBeam');
    setTimeout(() => {
      this._audio?.play('scanReveal');
      itemBlock.classList.remove('hidden');
    }, SCAN.BEAM_PHASE * 1000);
    setTimeout(() => threatBlock.classList.remove('hidden'), (SCAN.BEAM_PHASE + SCAN.ITEM_REVEAL) * 1000);
    setTimeout(
      () => this._continueBtn.classList.remove('hidden'),
      (SCAN.BEAM_PHASE + SCAN.ITEM_REVEAL + SCAN.THREAT_REVEAL) * 1000,
    );
    void galaxyIndex;
  }

  showShipReplication(onContinue) {
    this._onContinue = onContinue;
    this._audio?.play('replication');
    this._root.classList.remove('hidden');
    this._root.querySelector('.scan-ui-title').textContent = 'YOUR SHIP HAS BEEN FULLY REPLICATED';
    this._root.querySelector('.scan-ui-item-block')?.classList.add('hidden');
    this._root.querySelector('.scan-ui-threat-block')?.classList.add('hidden');
    this._continueBtn.classList.remove('hidden');
  }

  _finish() {
    this._root.classList.add('hidden');
    const fn = this._onContinue;
    this._onContinue = null;
    if (fn) fn();
  }
}
