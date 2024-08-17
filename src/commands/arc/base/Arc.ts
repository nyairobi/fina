import { FinaCommandGroup } from 'core/FinaCommandGroup';
// import { ArcResult } from './ArcResult';
import { ArcEdit } from '../registration/ArcEdit';
import { ArcRoll } from '../other/ArcRoll';
import { ArcSync } from '../registration/ArcSync';
import { ArcSong } from '../other/ArcSong';
import { ArcCourse } from '../other/ArcCourse';

export default class Arc extends FinaCommandGroup {
    public constructor() {
        super('ninja.nairobi.arc.arc');
        this.name = 'arc';
        this.keys = ['ninja.nairobi.arc.roll', 'ninja.nairobi.arc.contest'];
        this.dataUsageDescription =
            'Stores your Arcaea friend code, username, potential and the list of charts you own';

        this.addSubcommand(ArcRoll);
        this.addSubcommand(ArcSong);
        // this.addSubcommand(ArcCourse);

        // this.addSubcommand(ArcRegister);
        this.addSubcommand(ArcSync);

        if (process.env.CHARON_DISABLE_SYNC === '1') {
            this.addSubcommand(ArcEdit);
        }

        // this.addComponentTarget(ArcSession);
    }
}
