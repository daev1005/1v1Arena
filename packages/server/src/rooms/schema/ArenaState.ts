import { MapSchema, Schema, type } from "@colyseus/schema";

export class Player extends Schema {
    @type("string") sessionId = "";
    @type("number") x = 0;
    @type("number") y = 0;
    @type("number") facingAngle = 0;
    @type("number") attackStartedAt = 0;
    @type("number") attackAimAngle = 0;
    @type("number") hp = 0;
    @type("number") maxHp = 0;
    @type("number") lastAttack = 0;
    @type("number") hitCount = 0;
    @type("number") lastHitAt = 0;
    @type("number") invincibleUntil = 0;
    @type("number") hitFlashUntil = 0;
}

export class ArenaState extends Schema {
    @type({ map: Player }) players = new MapSchema<Player>();
}
