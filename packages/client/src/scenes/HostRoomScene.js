import Phaser from "phaser";
import { Client as ColyseusClient } from "colyseus.js";
export class HostRoomScene extends Phaser.Scene {
    netClient = new ColyseusClient(import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567");
    room;
    isHost = true;
    roomCodeText;
    statusText;
    playersText;
    startButton;
    constructor() {
        super("HostRoomScene");
    }
    init(data) {
        this.room = data.room;
        this.isHost = data.isHost ?? true;
    }
    create() {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a);
        this.add.text(width / 2, 100, this.isHost ? "Host Room" : "Joined Room", {
            fontSize: "38px",
            color: "#ffffff"
        }).setOrigin(0.5);
        this.statusText = this.add.text(width / 2, 160, this.isHost ? "Creating room..." : "Joining room...", {
            fontSize: "18px",
            color: "#93c5fd"
        }).setOrigin(0.5);
        this.roomCodeText = this.add.text(width / 2, 230, "Code: ----", {
            fontSize: "30px",
            color: "#facc15"
        }).setOrigin(0.5);
        this.playersText = this.add.text(width / 2, 280, "Players: 1/2", {
            fontSize: "18px",
            color: "#e5e7eb"
        }).setOrigin(0.5);
        const copyButton = this.makeButton(width / 2, 360, "Copy Code", 0x3b82f6);
        this.startButton = this.makeButton(width / 2, 430, "Start Match", 0x22c55e);
        const backButton = this.makeButton(width / 2, 500, "Back", 0x6b7280);
        copyButton.setVisible(this.isHost);
        this.startButton.setVisible(this.isHost);
        copyButton.on("pointerdown", async () => {
            if (!this.room || !this.isHost)
                return;
            try {
                await navigator.clipboard.writeText(this.room.roomId);
                this.statusText.setText("Room code copied.");
            }
            catch {
                this.statusText.setText(`Copy failed. Code: ${this.room.roomId}`);
            }
        });
        this.startButton.on("pointerdown", () => {
            if (!this.room || !this.isHost)
                return;
            const playerCount = this.getPlayerCount();
            if (playerCount < 2) {
                this.statusText.setText("Need 2 players to start.");
                return;
            }
            this.room.send("match:start");
            this.statusText.setText("Starting match...");
        });
        backButton.on("pointerdown", async () => {
            await this.room?.leave();
            this.room = undefined;
            this.scene.start("LobbyScene");
        });
        this.setStartEnabled(false);
        if (this.isHost) {
            void this.createRoom();
        }
        else if (this.room) {
            this.bindRoom();
            this.roomCodeText.setText(`Code: ${this.room.roomId}`);
            this.statusText.setText("Waiting for host to start...");
        }
        else {
            this.statusText.setText("No room found. Returning to lobby...");
            this.time.delayedCall(800, () => this.scene.start("LobbyScene"));
        }
    }
    async createRoom() {
        try {
            this.room = await this.netClient.create("arena");
            this.roomCodeText.setText(`Code: ${this.room.roomId}`);
            this.statusText.setText("Waiting for players...");
            this.bindRoom();
        }
        catch (error) {
            console.error("Failed to create room:", error);
            this.statusText.setText("Failed to create room. Please try again.");
        }
    }
    bindRoom() {
        if (!this.room)
            return;
        this.room.onStateChange(() => {
            const count = this.getPlayerCount();
            this.playersText.setText(`Players: ${count}/2`);
            if (this.isHost) {
                this.setStartEnabled(count >= 2);
                if (count >= 2) {
                    this.statusText.setText("Ready to start!");
                }
            }
            else {
                this.statusText.setText("Waiting for host to start...");
            }
        });
        this.room.onMessage("match:start", () => {
            if (!this.room)
                return;
            this.scene.start("ArenaScene", { room: this.room });
        });
    }
    getPlayerCount() {
        if (!this.room)
            return 0;
        const players = this.room.state?.players;
        if (!players)
            return 0;
        return Array.from(players.entries()).length;
    }
    setStartEnabled(enabled) {
        this.startButton.setAlpha(enabled ? 1 : 0.5);
        this.startButton.disableInteractive();
        if (enabled) {
            this.startButton.setInteractive({ useHandCursor: true });
        }
    }
    makeButton(x, y, label, bgColor) {
        const button = this.add.text(x, y, label, {
            fontSize: "24px",
            color: "#ffffff",
            backgroundColor: `#${bgColor.toString(16).padStart(6, "0")}`,
            padding: { left: 20, right: 20, top: 10, bottom: 10 }
        }).setOrigin(0.5);
        button.setInteractive({ useHandCursor: true });
        button.on("pointerover", () => button.setAlpha(0.85));
        button.on("pointerout", () => button.setAlpha(1));
        return button;
    }
}
