import { Client, Room } from "@colyseus/core";
import { GAME_CONFIG } from "@pvp/shared";
import { Player, ArenaState } from "./schema/ArenaState";

type MoveMessage = {
    x: number;
    y: number;
    facingAngle?: number;
}

type AttackMessage = {
    facingAngle?: number;
}

export class ArenaRoom extends Room<ArenaState> {
    private hostSessionId?: string;
    private roundActive = true;
    private readonly roundResetDelayMs = 1200;
    private readonly atkCooldown = GAME_CONFIG.sword.cooldown;
    private readonly atkReach =
        GAME_CONFIG.sword.distance +
        GAME_CONFIG.sword.length / 2 +
        GAME_CONFIG.player.size / 2;
    private readonly atkReachSquared = this.atkReach * this.atkReach;
    private readonly atkDamage = GAME_CONFIG.sword.damage;
    private readonly hitResetDelay = GAME_CONFIG.combat.comboResetDelay;
    private readonly lightKnockback = GAME_CONFIG.combat.lightKnockback;
    private readonly heavyKnockback = GAME_CONFIG.combat.heavyKnockback;
    private readonly invincibilityDuration = GAME_CONFIG.combat.invincibilityDuration;
    private readonly hitFlashDuration = GAME_CONFIG.combat.hitFlashDuration;
    private readonly halfPlayerSize = GAME_CONFIG.player.size / 2;
    private readonly minX = GAME_CONFIG.arena.wallThickness + this.halfPlayerSize;
    private readonly maxX =
        GAME_CONFIG.arena.width - GAME_CONFIG.arena.wallThickness - this.halfPlayerSize;
    private readonly minY = GAME_CONFIG.arena.wallThickness + this.halfPlayerSize;
    private readonly maxY =
        GAME_CONFIG.arena.height - GAME_CONFIG.arena.wallThickness - this.halfPlayerSize;
    maxClients = 2;

    onCreate(): void {
        this.state = new ArenaState();

        this.onMessage("player:move", (client: Client, message: MoveMessage) => {
            const player = this.state.players.get(client.sessionId);
            if (player && player.hp > 0) {
                player.x = message.x;
                player.y = message.y;
                if (typeof message.facingAngle === "number") {
                    player.facingAngle = message.facingAngle;
                }
                this.clampPlayerToArena(player);
            }
        });

        this.onMessage("player:attack", (client: Client, message: AttackMessage) => {
            const player = this.state.players.get(client.sessionId);
            if (!player || player.hp <= 0 || !this.roundActive) return; //dead players can't attack

            //since its just a 1v1 arena, the target is always the other player
            const targetEntry = Array.from(this.state.players.entries()).find(
                ([sessionId, player]) => sessionId !== client.sessionId && player.hp > 0
            );
            if (!targetEntry) return; //no target to attack

            const [, target] = targetEntry;
            const now = Date.now();

            if (now - player.lastAttack < this.atkCooldown) return; //attack is on cooldown

            if (typeof message?.facingAngle === "number") {
                player.facingAngle = message.facingAngle;
            }

            player.attackAimAngle = player.facingAngle;
            player.attackStartedAt = now;
            player.lastAttack = now; //consume cooldown on valid attack input
            
            const dx = target.x - player.x;
            const dy = target.y - player.y;
            const inRange = dx * dx + dy * dy <= this.atkReachSquared;
            if (!inRange) return;

            if (target.invincibleUntil > now) {
                return; //hits do not register during invincibility frames
            }

            if (now - target.lastHitAt > this.hitResetDelay) {
                target.hitCount = 0; //combo expired
            }

            target.hitCount += 1;
            target.lastHitAt = now;
            target.hitFlashUntil = now + this.hitFlashDuration;

            const isHeavyHit = target.hitCount >= 3;
            const knockbackDistance = isHeavyHit ? this.heavyKnockback : this.lightKnockback;
            this.applyKnockback(target, dx, dy, knockbackDistance);

            if (isHeavyHit) {
                target.hitCount = 0;
                target.invincibleUntil = now + this.invincibilityDuration;
            }

            target.hp = Math.max(target.hp - this.atkDamage, 0); //reduce target HP but not below 0

            if (target.hp <= 0) {
                this.endRound(client.sessionId);
            }
        });

        this.onMessage("match:start", (client: Client) => {
            if (client.sessionId !== this.hostSessionId) {
                return;
            }

            if (this.state.players.size < 2) {
                return;
            }

            this.broadcast("match:start", {});
        });
    }

    private endRound(winnerSessionId: string): void {
        if (!this.roundActive) return; //round already ended
        this.roundActive = false;
        this.broadcast("round:end", { winner: winnerSessionId });

        this.clock.setTimeout(() => {
            this.resetRound();
        }, this.roundResetDelayMs);
    }

    private resetRound(): void {
        const centerX = GAME_CONFIG.arena.width / 2;
        const centerY = GAME_CONFIG.arena.height / 2;

        let slot = 0;
        for (const [, player] of this.state.players.entries()) {
            player.x = slot === 0 ? centerX - 80 : centerX + 80;
            player.y = centerY;
            player.hp = player.maxHp;
            player.lastAttack = 0;
            this.resetCombatState(player);
            slot++;
        }
        this.roundActive = true;
        this.broadcast("round:start", {});
    }

    onJoin(client: Client): void {
        const player = new Player();
        player.sessionId = client.sessionId;

        if (!this.hostSessionId) {
            this.hostSessionId = client.sessionId;
        }

        const arenaCenterX = GAME_CONFIG.arena.width / 2;
        const arenaCenterY = GAME_CONFIG.arena.height / 2;

        player.x = this.clients.length === 1 ? arenaCenterX - 80 : arenaCenterX + 80;
        player.y = arenaCenterY;
        player.hp = GAME_CONFIG.player.startingHp;
        player.maxHp = GAME_CONFIG.player.maxHp;
        player.lastAttack = 0;
        this.resetCombatState(player);

        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client): void {
        this.state.players.delete(client.sessionId);

        if (client.sessionId === this.hostSessionId) {
            this.hostSessionId = this.clients[0]?.sessionId;
        }
    }

    private applyKnockback(target: Player, dx: number, dy: number, distance: number): void {
        const length = Math.sqrt(dx * dx + dy * dy);
        const dirX = length > 0 ? dx / length : 1;
        const dirY = length > 0 ? dy / length : 0;

        target.x += dirX * distance;
        target.y += dirY * distance;
        this.clampPlayerToArena(target);
    }

    private clampPlayerToArena(player: Player): void {
        player.x = Math.min(Math.max(player.x, this.minX), this.maxX);
        player.y = Math.min(Math.max(player.y, this.minY), this.maxY);
    }

    private resetCombatState(player: Player): void {
        player.hitCount = 0;
        player.lastHitAt = 0;
        player.invincibleUntil = 0;
        player.hitFlashUntil = 0;
        player.attackStartedAt = 0;
        player.attackAimAngle = player.facingAngle;
    }
}
