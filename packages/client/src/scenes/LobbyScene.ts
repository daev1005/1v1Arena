import Phaser from "phaser";
import { Client as ColyseusClient, Room}  from "colyseus.js";

type HostRoomSceneData = {
    room?: Room
    isHost?: boolean;
}

export class LobbyScene extends Phaser.Scene {
    private netClient = new ColyseusClient( import.meta.env.VITE_SERVER_URL ?? "ws://localhost:2567" );
    private readonly uiTextResolution = 2;

    constructor() {
        super("LobbyScene");
    }

    create(): void {
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x111827);

        this.add.text(width / 2, 120, "1v1 Arena", {
            fontSize: "40px",
            color: "#fff",
            resolution: this.uiTextResolution
        }).setOrigin(0.5);

        const statusText = this.add.text(width / 2, 180, "Create or join a room", {
            fontSize: "18px",
            color: "#93c5fd",
            resolution: this.uiTextResolution
        }).setOrigin(0.5);

        const createButton = this.makeButton(width / 2, 300, "Create Room", 0x22c55e);
        const joinButton = this.makeButton(width / 2, 380, "Join Room", 0x3b82f6);

         createButton.on("pointerdown", () => {
            this.scene.start("HostRoomScene");
        });

        joinButton.on("pointerdown", async () => {
            const roomId = window.prompt("Enter room code");
            const code = roomId?.trim();

            if (!code) {
                statusText.setText("Join cancelled");
                return;
            }

            statusText.setText("Joining room...");
            try {
                const room = await this.netClient.joinById(code);
                this.scene.start("HostRoomScene", {
                    room,
                    isHost: false
                } satisfies HostRoomSceneData);
            } catch {
                statusText.setText("Failed to join room. Please check the code and try again.");
            }
        });
    }

    private makeButton(x: number, y: number, label: string, bgColor: number): Phaser.GameObjects.Text {
        const button = this.add.text(x, y, label, {
            fontSize: "24px",
            color: "#ffffff",
            backgroundColor: `#${bgColor.toString(16).padStart(6, "0")}`,
            padding: { x: 20, y: 10 },
            resolution: this.uiTextResolution
        }).setOrigin(0.5);

        button.setInteractive({ useHandCursor: true });
        button.on("pointerover", () => button.setAlpha(0.85));
        button.on("pointerout", () => button.setAlpha(1));

        return button;
    }
}
