// Basic class content
function expandClass(names: string[], members: string[]) {
  return names.concat(names.map((c) => members.map((m) => `${c}.${m}`)).flat())
}
const members_C_NPC = [
  'ID',
  'NAME',
  'SLOT',
  'NPCTYPE',
  'FLAGS',
  'ATTRIBUTE',
  'PROTECTION',
  'DAMAGE',
  'DAMAGETYPE',
  'GUILD',
  'LEVEL',
  'MISSION',
  'FIGHT_TACTIC',
  'WEAPON',
  'VOICE',
  'VOICEPITCH',
  'BODYMASS',
  'DAILY_ROUTINE',
  'START_AISTATE',
  'SPAWNPOINT',
  'SPAWNDELAY',
  'SENSES',
  'SENSES_RANGE',
  'AIVAR',
  'WP',
  'EXP',
  'EXP_NEXT',
  'LP',
]
const members_C_ITEM = [
  'ID',
  'NAME',
  'NAMEID',
  'HP',
  'HP_MAX',
  'MAINFLAG',
  'FLAGS',
  'WEIGHT',
  'VALUE',
  'DAMAGETYPE',
  'DAMAGETOTAL',
  'DAMAGE',
  'WEAR',
  'PROTECTION',
  'NUTRITION',
  'COND_ATR',
  'COND_VALUE',
  'CHANGE_ATR',
  'CHANGE_VALUE',
  'MAGIC',
  'ON_EQUIP',
  'ON_UNEQUIP',
  'ON_STATE',
  'OWNER',
  'OWNERGUILD',
  'DISGUISEGUILD',
  'VISUAL',
  'VISUAL_CHANGE',
  'VISUAL_SKIN',
  'SCEMENAME',
  'MATERIAL',
  'MUNITION',
  'SPELL',
  'RANGE',
  'MAG_CIRCLE',
  'DESCRIPTION',
  'TEXT',
  'COUNT',
]
const members_C_INFO = ['NPC', 'NR', 'IMPORTANT', 'CONDITION', 'INFORMATION', 'DESCRIPTION', 'TRADE', 'PERMANENT']
const members_C_PARTICLEFX = [
  'PPSVALUE',
  'PPSSCALEKEYS_S',
  'PPSISLOOPING',
  'PPSISSMOOTH',
  'PPSFPS',
  'PPSCREATEEM_S',
  'PPSCREATEEMDELAY',
  'SHPTYPE_S',
  'SHPFOR_S',
  'SHPOFFSETVEC_S',
  'SHPDISTRIBTYPE_S',
  'SHPDISTRIBWALKSPEED',
  'SHPISVOLUME',
  'SHPDIM_S',
  'SHPMESH_S',
  'SHPMESHRENDER_B',
  'SHPSCALEKEYS_S',
  'SHPSCALEISLOOPING',
  'SHPSCALEISSMOOTH',
  'SHPSCALEFPS',
  'DIRMODE_S',
  'DIRFOR_S',
  'DIRMODETARGETFOR_S',
  'DIRMODETARGETPOS_S',
  'DIRANGLEHEAD',
  'DIRANGLEHEADVAR',
  'DIRANGLEELEV',
  'DIRANGLEELEVVAR',
  'VELAVG',
  'VELVAR',
  'LSPPARTAVG',
  'LSPPARTVAR',
  'FLYGRAVITY_S',
  'FLYCOLLDET_B',
  'VISNAME_S',
  'VISORIENTATION_S',
  'VISTEXISQUADPOLY',
  'VISTEXANIFPS',
  'VISTEXANIISLOOPING',
  'VISTEXCOLORSTART_S',
  'VISTEXCOLOREND_S',
  'VISSIZESTART_S',
  'VISSIZEENDSCALE',
  'VISALPHAFUNC_S',
  'VISALPHASTART',
  'VISALPHAEND',
  'TRLFADESPEED',
  'TRLTEXTURE_S',
  'TRLWIDTH',
  'MRKFADESPEED',
  'MRKTEXTURE_S',
]

// Gothic 2 Classic specific class content extensions
const G130_C_NPC = members_C_NPC.concat(['HITCHANCE', 'BODYSTATEINTERRUPTABLEOVERRIDE', 'NOFOCUS'])
const G130_C_ITEM = members_C_ITEM.concat(['INV_ZBIAS', 'INV_ROTX', 'INV_ROTY', 'INV_ROTZ', 'INV_ANIMATE'])
const G130_C_PARTICLEFX = members_C_PARTICLEFX.concat(['FLOCKMODE', 'FLOCKSTRENGTH', 'USEEMITTERSFOR', 'TIMESTARTEND_S', 'M_BISAMBIENTPFX'])

// Common symbols
const basic = {
  CONTENT: [
    ...expandClass(['C_NPC', 'SELF', 'OTHER', 'VICTIM', 'HERO'], members_C_NPC),
    ...expandClass(['C_ITEM', 'ITEM'], members_C_ITEM),
    ...expandClass(['C_INFO'], members_C_INFO),
  ],
  PFX: expandClass(['C_PARTICLEFX'], members_C_PARTICLEFX),
}

// Symbol lists per game version
const G1 = {
  CONTENT: basic.CONTENT.concat(['STARTUP_GLOBAL']),
  PFX: basic.PFX,
}

const G112 = basic

const G130 = {
  CONTENT: [
    ...expandClass(['C_NPC', 'SELF', 'OTHER', 'VICTIM', 'HERO'], G130_C_NPC),
    ...expandClass(['C_ITEM', 'ITEM'], G130_C_ITEM),
    ...expandClass(['C_INFO'], members_C_INFO),
    'STARTUP_GLOBAL',
    'INIT_GLOBAL',
  ],
  PFX: expandClass(['C_PARTICLEFX'], G130_C_PARTICLEFX),
}

const G2 = {
  CONTENT: [...G130.CONTENT, 'C_NPC.EFFECT', 'SELF.EFFECT', 'OTHER.EFFECT', 'VICTIM.EFFECT', 'HERO.EFFECT', 'C_ITEM.EFFECT', 'ITEM.EFFECT'],
  PFX: G130.PFX,
}

export interface SymbolList {
  [key: string]: Record<string, string[]>
}
const list: SymbolList = { G1, G112, G130, G2 }
export default list
