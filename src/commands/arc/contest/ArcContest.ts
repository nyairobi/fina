import { FinaCommandGroup } from 'core/FinaCommandGroup';
import {
    ArcContestLightAndConflictR3,
    ArcContestLightAndConflictR5
} from './ArcContestLNC';
import { ArcContest1v1, ArcContest2v2, ArcContestGroup } from './ArcContestStandard';

export default class ArcContest extends FinaCommandGroup {
    public constructor() {
        super('ninja.nairobi.arc.contest');
        this.name = 'contest';
        this.addSubcommand(ArcContest1v1);
        this.addSubcommand(ArcContest2v2);
        this.addSubcommand(ArcContestGroup);
        // this.addSubcommand(ArcContestLightAndConflictR3);
        // this.addSubcommand(ArcContestLightAndConflictR5);
    }
}
