import Phaser from "phaser";
import { Room } from "colyseus.js";
type HostRoomSceneData = {
    room?: Room;
    isHost?: boolean;
};
export declare class HostRoomScene extends Phaser.Scene {
    private netClient;
    private room?;
    private isHost;
    private roomCodeText;
    private statusText;
    private playersText;
    private startButton;
    constructor();
    init(data: HostRoomSceneData): void;
    create(): void;
    private createRoom;
    private bindRoom;
    private getPlayerCount;
    private setStartEnabled;
    private makeButton;
}
export {};
