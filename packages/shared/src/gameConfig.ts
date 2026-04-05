export const GAME_CONFIG = {
  arena: {
    width: 1000,
    height: 800,
    wallThickness: 20
  },
  player: {
    size: 30,
    speed: 300,
    startingHp: 100,
    maxHp: 100
  },
  dash: {
    speed: 1000,
    duration: 150,
    cooldown: 500
  },
  sword: {
    length: 50,
    width: 18,
    distance: 35,
    duration: 100,
    cooldown: 200,
    damage: 15
  },
  combat: {
    hitFlashDuration: 100,
    invincibilityDuration: 800,
    hitColor: 0xff0000,
    flashColor: 0xffffff,
    comboResetDelay: 1000,
    lightKnockback: 5,
    heavyKnockback: 100
  }
} as const;
