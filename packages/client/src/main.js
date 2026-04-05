import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { LobbyScene } from "./scenes/LobbyScene";
import { HostRoomScene } from "./scenes/HostRoomScene";
import { ArenaScene } from "./scenes/ArenaScene";
const config = {
    type: Phaser.AUTO,
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 1000,
        height: 800
    },
    parent: "app",
    backgroundColor: "#1a1a1a",
    scene: [BootScene, LobbyScene, HostRoomScene, ArenaScene]
};
new Phaser.Game(config);
