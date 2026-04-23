import { GenericItemMesh } from './GenericItemMesh.js';
import {
  LaserTurretItemMesh, MissileTurretItemMesh, PlasmaTurretItemMesh, BeamTurretItemMesh,
} from './weaponTurretMeshes.js';
import { MainCannonItemMesh, WingCannonItemMesh, RailgunItemMesh } from './weaponPrimaryMeshes.js';
import {
  HullPlatingItemMesh, CompositeArmorItemMesh, ShieldEmitterItemMesh,
  PhoenixDriveItemMesh, JuggernautItemMesh,
} from './defenseItemMeshes.js';
import {
  MagnetCoilItemMesh, ThrusterItemMesh, NanobotsItemMesh, RepulserItemMesh, ScannerItemMesh,
  SalvagingBeamItemMesh, MiningLaserItemMesh, GravityWellItemMesh, DroneItemMesh,
} from './utilityItemMeshes.js';
import {
  StellarGenItemMesh, ReactorItemMesh, SolarCellsItemMesh, BioLabItemMesh, PlasmaFarmItemMesh,
  ParticleColliderItemMesh, StellarBurstItemMesh, NovaCoreItemMesh,
} from './passiveItemMeshes.js';
import {
  EmpItemMesh, WarpDriveItemMesh, GravityBombItemMesh, DecoyItemMesh, SpeedBoosterItemMesh,
} from './abilityItemMeshes.js';

const _map = new Map();

function register(id, Cls) {
  _map.set(id, Cls);
}

export const ItemMeshRegistry = {
  register,
  get(id) {
    return _map.get(id) || null;
  },
  create(item, slot, ctx) {
    const key = (item && (item.meshId || item.id)) || '';
    const Cls = _map.get(key) || GenericItemMesh;
    return new Cls(item, slot, ctx);
  },
  registerDefaults() {
    if (_map.size) return;
    register('main_cannon', MainCannonItemMesh);
    register('laser_turret', LaserTurretItemMesh);
    register('missile_turret', MissileTurretItemMesh);
    register('plasma_turret', PlasmaTurretItemMesh);
    register('beam_laser', BeamTurretItemMesh);
    register('rail_gun', RailgunItemMesh);
    register('hull_plating', HullPlatingItemMesh);
    register('composite_armor', CompositeArmorItemMesh);
    register('shield_generator', ShieldEmitterItemMesh);
    register('magnet_coil', MagnetCoilItemMesh);
    register('thrusters', ThrusterItemMesh);
    register('nanobots', NanobotsItemMesh);
    register('repulser', RepulserItemMesh);
    register('scanner', ScannerItemMesh);
    register('salvaging_beam', SalvagingBeamItemMesh);
    register('mining_laser', MiningLaserItemMesh);
    register('stellar_gen', StellarGenItemMesh);
    register('reactor', ReactorItemMesh);
    register('solar_cells', SolarCellsItemMesh);
    register('bio_lab', BioLabItemMesh);
    register('plasma_farm', PlasmaFarmItemMesh);
    register('particle_collider', ParticleColliderItemMesh);
    register('emp', EmpItemMesh);
    register('warp_drive', WarpDriveItemMesh);
    register('gravity_bomb', GravityBombItemMesh);
    register('decoy', DecoyItemMesh);
    register('speed_booster', SpeedBoosterItemMesh);
    register('wing_cannons', WingCannonItemMesh);
    register('phoenix_drive', PhoenixDriveItemMesh);
    register('juggernaut', JuggernautItemMesh);
    register('gravity_well', GravityWellItemMesh);
    register('stellar_burst', StellarBurstItemMesh);
    register('nova_core', NovaCoreItemMesh);
    register('drone', DroneItemMesh);
  },
};
