import { HexColorString } from 'discord.js';

export const PollConfig = {
    MAX_CHOICES: 15,
    PIECHART_RADIUS: 200,
    PIECHART_MARGIN: 5,
    DEFAULT_COLORS: [
        '#485DD3',
        '#5266D6',
        '#5C6FD9',
        '#6678DC',
        '#7181E0',
        '#7B8AE3',
        '#8593E6',
        '#8F9DE9',
        '#99A6EC',
        '#A3AFEF',
        '#ADB8F2',
        '#B8C1F6',
        '#C2CAF9',
        '#CCD3FC',
        '#D6DCFF'
    ] as HexColorString[],
    POLL_THUMB:
        'https://cdn.discordapp.com/attachments/391366975936397314/938916279102898186/unknown.png',
    ROLE_PICKER_THUMB:
        'https://cdn.discordapp.com/attachments/391366975936397314/954002247346434138/unknown.png'
};
