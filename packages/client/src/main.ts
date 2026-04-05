import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { ArenaScene } from "./scenes/ArenaScene";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1000,
    height: 800,
    parent: "app",
    backgroundColor: "#1a1a1a",
    scene: [BootScene, ArenaScene]
};

new Phaser.Game(config);
