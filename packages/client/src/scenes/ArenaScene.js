import Phaser from "phaser";
import { GAME_CONFIG } from "@pvp/shared";
import { tickTimer } from "../utils/timer";
import { getStateCallbacks } from "colyseus.js";
export class ArenaScene extends Phaser.Scene {
    room;
    init(data) {
        this.room = data.room;
        this.lastSentX = -1;
        this.lastSentY = -1;
        this.lastSentFacingAngle = Number.NaN;
    }
    netPlayers = new Map();
    remoteTargets = new Map();
    remoteLerpSpeed = 14; // higher = snappier
    remotePlayers = new Map();
    remoteFacingIndicators = new Map();
    remoteSwordHitboxes = new Map();
    lastSentX = -1;
    lastSentY = -1;
    lastSentFacingAngle = Number.NaN;
    playerHpText;
    enemyHpText;
    roundBannerText;
    localPlayerColor = 0xffcc00;
    remotePlayerColor = 0x6666ff;
    playerHitColor = GAME_CONFIG.combat.hitColor;
    playerFlashColor = GAME_CONFIG.combat.flashColor;
    invincibilityFlashFrequency = 80;
    facingIndicatorLength = 20;
    swordSwingArc = Phaser.Math.DegToRad(90);
    player; //! means “this will be assigned later”
    wKey;
    aKey;
    sKey;
    dKey;
    spaceKey;
    //game scene constants
    gameWidth = GAME_CONFIG.arena.width;
    gameHeight = GAME_CONFIG.arena.height;
    wallThickness = GAME_CONFIG.arena.wallThickness;
    playerSize = GAME_CONFIG.player.size;
    playerSpeed = GAME_CONFIG.player.speed;
    //for dash mechanic constants
    dashSpeed = GAME_CONFIG.dash.speed;
    dashDuration = GAME_CONFIG.dash.duration;
    dashCooldown = GAME_CONFIG.dash.cooldown;
    isDashing = false;
    dashTimeRemaining = 0;
    dashCooldownRemaining = 0;
    dashDirection = new Phaser.Math.Vector2(0, 0);
    //aim constants
    facingIndicator;
    facingAngle = 0;
    //sword attack constants
    swordHitbox;
    swordLength = GAME_CONFIG.sword.length;
    swordWidth = GAME_CONFIG.sword.width;
    swordDistance = GAME_CONFIG.sword.distance;
    attackDuration = GAME_CONFIG.sword.duration;
    attackCooldown = GAME_CONFIG.sword.cooldown;
    attackAimAngle = 0;
    isAttacking = false;
    attackTimeRemaining = 0;
    attackCooldownRemaining = 0;
    constructor() {
        super("ArenaScene");
    }
    create() {
        this.add.rectangle(this.gameWidth / 2, this.gameHeight / 2, this.gameWidth, this.gameHeight, 0x1e1e1e);
        this.add.rectangle(this.gameWidth / 2, this.wallThickness / 2, this.gameWidth, this.wallThickness, 0xef4444); //top
        this.add.rectangle(this.gameWidth / 2, this.gameHeight - this.wallThickness / 2, this.gameWidth, this.wallThickness, 0xef4444); //bottom 
        this.add.rectangle(this.wallThickness / 2, this.gameHeight / 2, this.wallThickness, this.gameHeight, 0xef4444); //left
        this.add.rectangle(this.gameWidth - this.wallThickness / 2, this.gameHeight / 2, this.wallThickness, this.gameHeight, 0xef4444); //right
        this.player = this.add.rectangle(this.gameWidth / 2, this.gameHeight / 2, this.playerSize, this.playerSize, this.localPlayerColor); //player
        this.playerHpText = this.add.text(16, 16, "You HP: --", { fontSize: "16px", color: "#ffffff" });
        this.enemyHpText = this.add.text(16, 40, "Enemy HP: --", { fontSize: "16px", color: "#ffffff" });
        this.roundBannerText = this.add.text(this.gameWidth / 2, 16, "", {
            fontSize: "24px",
            color: "#ffffff"
        }).setOrigin(0.5, 0).setVisible(false);
        this.facingIndicator = this.add.graphics();
        this.createSwordHitbox();
        if (!this.input.keyboard) {
            throw new Error("Keyboard input is not available.");
        }
        this.wKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.aKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.sKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.dKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        //ensures only one swipe is registered per click
        this.input.on("pointerdown", this.handleSwordInput, this);
        //multiclient setup
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.cleanupNetwork();
        });
        if (!this.room) {
            this.add.text(16, 16, "No room selected. Returning to lobby...", {
                fontSize: "16px",
                color: "#ff6666"
            });
            this.time.delayedCall(900, () => this.scene.start("LobbyScene"));
            return;
        }
        if (this.room.state?.players) {
            this.bindRoomState();
        }
        else {
            this.room.onStateChange.once(() => this.bindRoomState());
        }
    }
    update(_time, delta) {
        //movement and dashing
        const moveDirection = this.getMoveDirection();
        this.checkForDashInput(moveDirection);
        this.updateDashState(delta);
        this.movePlayer(moveDirection, delta);
        this.clampPlayerToArena();
        this.updateFacingAngle();
        this.syncMovementToServer();
        //aiming
        this.drawFacingIndicator();
        //sword
        this.updateSwordState(delta);
        this.updateRemotePlayerSmoothing(delta);
        this.updateRemoteFacingAndSwordVisuals();
        this.updatePlayerHitVisuals();
    }
    //directions and movements helpers
    getMoveDirection() {
        let xDirection = 0;
        let yDirection = 0;
        if (!this.isDashing) {
            if (this.wKey.isDown) {
                yDirection = -1;
            }
            if (this.sKey.isDown) {
                yDirection = 1;
            }
            if (this.aKey.isDown) {
                xDirection = -1;
            }
            if (this.dKey.isDown) {
                xDirection = 1;
            }
        }
        const moveDirection = new Phaser.Math.Vector2(xDirection, yDirection);
        if (moveDirection.length() > 0) {
            moveDirection.normalize();
        }
        return moveDirection;
    }
    updateDashState(delta) {
        if (this.isDashing) {
            this.dashTimeRemaining = tickTimer(this.dashTimeRemaining, delta);
            if (this.dashTimeRemaining <= 0) {
                this.isDashing = false;
                this.dashDirection.set(0, 0);
            }
        }
        if (this.dashCooldownRemaining > 0) {
            this.dashCooldownRemaining = tickTimer(this.dashCooldownRemaining, delta);
        }
    }
    movePlayer(moveDirection, delta) {
        const activeDirection = this.isDashing ? this.dashDirection : moveDirection;
        const currentSpeed = this.isDashing ? this.dashSpeed : this.playerSpeed;
        const moveDistance = currentSpeed * (delta / 1000);
        this.player.x += activeDirection.x * moveDistance;
        this.player.y += activeDirection.y * moveDistance;
    }
    clampPlayerToArena() {
        const halfPlayerSize = this.playerSize / 2;
        this.player.x = Phaser.Math.Clamp(this.player.x, this.wallThickness + halfPlayerSize, this.gameWidth - this.wallThickness - halfPlayerSize);
        this.player.y = Phaser.Math.Clamp(this.player.y, this.wallThickness + halfPlayerSize, this.gameHeight - this.wallThickness - halfPlayerSize);
    }
    //dashing mechanic helpers
    checkForDashInput(moveDirection) {
        if (Phaser.Input.Keyboard.JustDown(this.spaceKey) &&
            moveDirection.length() > 0) {
            this.startDash(moveDirection.x, moveDirection.y);
        }
    }
    startDash(x, y) {
        if (this.isDashing || this.dashCooldownRemaining > 0) {
            return;
        }
        this.isDashing = true;
        this.dashTimeRemaining = this.dashDuration;
        this.dashCooldownRemaining = this.dashCooldown;
        this.dashDirection.set(x, y).normalize();
    }
    //aiming helpers
    updateFacingAngle() {
        const pointer = this.input.activePointer;
        const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
        this.facingAngle = angle;
    }
    drawFacingIndicator() {
        this.drawFacingLine(this.facingIndicator, this.player.x, this.player.y, this.facingAngle, 0xff0000, 4);
    }
    //sword attack mechanic
    createSwordHitbox() {
        this.swordHitbox = this.add.rectangle(this.player.x, this.player.y, this.swordLength, this.swordWidth, 0xffffff);
        this.swordHitbox.setVisible(false);
    }
    startSwordAttack() {
        this.isAttacking = true;
        this.attackTimeRemaining = this.attackDuration;
        this.attackCooldownRemaining = this.attackCooldown;
        this.attackAimAngle = this.facingAngle;
        this.swordHitbox.setVisible(true);
    }
    handleSwordInput() {
        if (!this.isDashing && !this.isAttacking && this.attackCooldownRemaining <= 0) {
            this.startSwordAttack();
            this.room?.send("player:attack", {
                facingAngle: this.facingAngle
            });
        }
    }
    updateSwordState(delta) {
        if (this.attackCooldownRemaining > 0) {
            this.attackCooldownRemaining = tickTimer(this.attackCooldownRemaining, delta);
        }
        //no attack happening, do nothing
        if (!this.isAttacking) {
            return;
        }
        this.attackTimeRemaining -= delta;
        const progress = 1 - this.attackTimeRemaining / this.attackDuration;
        const currentAngle = this.getSwordSwingAngle(this.attackAimAngle, progress);
        this.setSwordVisual(this.swordHitbox, this.player.x, this.player.y, currentAngle);
        //attack finished
        if (this.attackTimeRemaining <= 0) {
            this.isAttacking = false;
            this.swordHitbox.setVisible(false);
        }
    }
    bindRoomState() {
        if (!this.room) {
            return;
        }
        const room = this.room;
        const $ = getStateCallbacks(room);
        const players = $(room.state).players;
        players.onAdd((player, sessionId) => {
            const isLocal = sessionId === room.sessionId;
            this.netPlayers.set(sessionId, player);
            if (!isLocal) {
                const remote = this.add.rectangle(player.x, player.y, this.playerSize, this.playerSize, this.remotePlayerColor);
                this.remotePlayers.set(sessionId, remote);
                this.remoteTargets.set(sessionId, new Phaser.Math.Vector2(player.x, player.y));
                const remoteFacing = this.add.graphics();
                this.remoteFacingIndicators.set(sessionId, remoteFacing);
                const remoteSword = this.add.rectangle(player.x, player.y, this.swordLength, this.swordWidth, 0xffffff);
                remoteSword.setVisible(false);
                this.remoteSwordHitboxes.set(sessionId, remoteSword);
            }
            const syncFromState = () => {
                if (isLocal) {
                    this.player.setPosition(player.x, player.y);
                    this.playerHpText.setText(`You HP: ${player.hp}`);
                }
                else {
                    const target = this.remoteTargets.get(sessionId);
                    if (target) {
                        target.set(player.x, player.y);
                    }
                    this.enemyHpText.setText(`Enemy HP: ${player.hp}`);
                }
            };
            syncFromState(); //initial sync
            $(player).onChange(syncFromState); //sync on every state change
        }, true);
        players.onRemove((_player, sessionId) => {
            this.netPlayers.delete(sessionId);
            const remote = this.remotePlayers.get(sessionId);
            if (remote) {
                remote.destroy();
                this.remotePlayers.delete(sessionId);
                this.remoteTargets.delete(sessionId);
                this.enemyHpText.setText("Enemy HP: --");
            }
            const facing = this.remoteFacingIndicators.get(sessionId);
            if (facing) {
                facing.destroy();
                this.remoteFacingIndicators.delete(sessionId);
            }
            const sword = this.remoteSwordHitboxes.get(sessionId);
            if (sword) {
                sword.destroy();
                this.remoteSwordHitboxes.delete(sessionId);
            }
        });
        room.onMessage("round:end", (message) => {
            const didWin = message.winner === room.sessionId;
            this.roundBannerText.setText(didWin ? "You Win" : "You Lose").setVisible(true);
        });
        room.onMessage("round:start", () => {
            this.roundBannerText.setText("Fight!").setVisible(true);
            this.time.delayedCall(500, () => {
                this.roundBannerText.setVisible(false);
            });
        });
    }
    syncMovementToServer() {
        if (!this.room)
            return;
        const dx = Math.abs(this.player.x - this.lastSentX);
        const dy = Math.abs(this.player.y - this.lastSentY);
        const facingDiff = Number.isNaN(this.lastSentFacingAngle)
            ? Number.POSITIVE_INFINITY
            : Math.abs(Phaser.Math.Angle.Wrap(this.facingAngle - this.lastSentFacingAngle));
        if (dx < 0.5 && dy < 0.5 && facingDiff < 0.02)
            return;
        this.lastSentX = this.player.x;
        this.lastSentY = this.player.y;
        this.lastSentFacingAngle = this.facingAngle;
        this.room.send("player:move", {
            x: this.player.x,
            y: this.player.y,
            facingAngle: this.facingAngle
        });
    }
    cleanupNetwork() {
        for (const remote of this.remotePlayers.values()) {
            remote.destroy();
        }
        for (const remoteFacing of this.remoteFacingIndicators.values()) {
            remoteFacing.destroy();
        }
        for (const remoteSword of this.remoteSwordHitboxes.values()) {
            remoteSword.destroy();
        }
        this.remotePlayers.clear();
        this.remoteTargets.clear();
        this.remoteFacingIndicators.clear();
        this.remoteSwordHitboxes.clear();
        this.netPlayers.clear();
        if (this.room) {
            this.room.leave();
            this.room = undefined;
        }
    }
    updateRemotePlayerSmoothing(delta) {
        const t = 1 - Math.exp(-this.remoteLerpSpeed * (delta / 1000));
        for (const [sessionId, remote] of this.remotePlayers.entries()) {
            const target = this.remoteTargets.get(sessionId);
            if (!target)
                continue;
            remote.x = Phaser.Math.Linear(remote.x, target.x, t);
            remote.y = Phaser.Math.Linear(remote.y, target.y, t);
        }
    }
    drawFacingLine(graphics, x, y, angle, color, width) {
        const endX = x + Math.cos(angle) * this.facingIndicatorLength;
        const endY = y + Math.sin(angle) * this.facingIndicatorLength;
        graphics.clear();
        graphics.lineStyle(width, color, 1);
        graphics.beginPath();
        graphics.moveTo(x, y);
        graphics.lineTo(endX, endY);
        graphics.strokePath();
    }
    getSwordSwingAngle(aimAngle, progress) {
        const start = aimAngle - this.swordSwingArc / 2;
        const end = aimAngle + this.swordSwingArc / 2;
        return Phaser.Math.Linear(start, end, progress);
    }
    setSwordVisual(sword, ownerX, ownerY, angle) {
        const swordX = ownerX + Math.cos(angle) * this.swordDistance;
        const swordY = ownerY + Math.sin(angle) * this.swordDistance;
        sword.setPosition(swordX, swordY);
        sword.setRotation(angle);
    }
    updateRemoteFacingAndSwordVisuals() {
        const now = Date.now();
        for (const [sessionId, remote] of this.remotePlayers.entries()) {
            const netPlayer = this.netPlayers.get(sessionId);
            if (!netPlayer) {
                continue;
            }
            const facingAngle = typeof netPlayer.facingAngle === "number" ? netPlayer.facingAngle : 0;
            const facing = this.remoteFacingIndicators.get(sessionId);
            if (facing) {
                this.drawFacingLine(facing, remote.x, remote.y, facingAngle, 0x60a5fa, 3);
            }
            const sword = this.remoteSwordHitboxes.get(sessionId);
            if (!sword) {
                continue;
            }
            const attackStartedAt = typeof netPlayer.attackStartedAt === "number" ? netPlayer.attackStartedAt : 0;
            const attackAimAngle = typeof netPlayer.attackAimAngle === "number"
                ? netPlayer.attackAimAngle
                : facingAngle;
            const elapsed = now - attackStartedAt;
            if (attackStartedAt <= 0 || elapsed < 0 || elapsed > this.attackDuration) {
                sword.setVisible(false);
                continue;
            }
            const progress = Phaser.Math.Clamp(elapsed / this.attackDuration, 0, 1);
            const currentAngle = this.getSwordSwingAngle(attackAimAngle, progress);
            this.setSwordVisual(sword, remote.x, remote.y, currentAngle);
            sword.setVisible(true);
        }
    }
    updatePlayerHitVisuals() {
        if (!this.room) {
            return;
        }
        const now = Date.now();
        for (const [sessionId, netPlayer] of this.netPlayers.entries()) {
            const isLocal = sessionId === this.room.sessionId;
            const sprite = isLocal ? this.player : this.remotePlayers.get(sessionId);
            if (!sprite) {
                continue;
            }
            const baseColor = isLocal ? this.localPlayerColor : this.remotePlayerColor;
            const isInvincible = netPlayer.invincibleUntil > now;
            if (isInvincible) {
                const useFlashColor = Math.floor((netPlayer.invincibleUntil - now) / this.invincibilityFlashFrequency) % 2 === 0;
                sprite.setFillStyle(useFlashColor ? this.playerFlashColor : baseColor);
                continue;
            }
            if (netPlayer.hitFlashUntil > now) {
                sprite.setFillStyle(this.playerHitColor);
                continue;
            }
            sprite.setFillStyle(baseColor);
        }
    }
}
